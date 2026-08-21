import { GraphSchedulerError } from '../../scheduler/errors.js';
import type { RunEvent } from '../../observers/types.js';
import {
	compileTestGraph,
	controlled,
	failure,
	flushMicrotasks,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

const phaseSuccess = <T>(value: T) => ({
	kind: 'success' as const,
	value,
});

const effectGraph = () =>
	compileTestGraph({
		effectKeys: ['write'],
		nodes: [
			{
				key: 'node',
				effectKeys: ['write'],
				executor: () => ({
					...success('done'),
					effects: [{ participant: 'write', payload: 'payload' }],
				}),
			},
		],
	});

describe('v2 effect adversarial boundaries', () => {
	it('validates and snapshots exact participant phase authority at admission', async () => {
		const graph = effectGraph();
		expect(() => runTestGraph({ graph, participants: {} })).toThrow(
			GraphSchedulerError
		);
		expect(() =>
			runTestGraph({
				graph,
				participants: {
					write: {
						prepare: 42,
						commit: jest.fn(),
						compensate: jest.fn(),
					},
				},
			})
		).toThrow('callable prepare');
		const hostile = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('hostile');
				},
			}
		);
		expect(() => runTestGraph({ graph, participants: hostile })).toThrow(
			'inspectable plain record'
		);
		const validParticipant = {
			prepare: () => phaseSuccess('prepared'),
			commit: () => phaseSuccess(undefined),
			compensate: () => phaseSuccess(undefined),
		};
		expect(() =>
			runTestGraph({
				graph,
				participants: {
					write: validParticipant,
					extra: validParticipant,
				},
			})
		).toThrow('not declared by the compiled graph');
		const declaredUnused = compileTestGraph({
			effectKeys: ['write', 'unused'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => success('done'),
				},
			],
		});
		expect(() =>
			runTestGraph({
				graph: declaredUnused,
				participants: { write: validParticipant },
			})
		).toThrow('participant "unused" is required');

		const gate = controlled<unknown>();
		const originalPrepare = jest.fn(() => phaseSuccess('original'));
		const replacement = jest.fn(() => phaseSuccess('replacement'));
		const participants = {
			write: {
				prepare: originalPrepare,
				commit: () => phaseSuccess(undefined),
				compensate: () => phaseSuccess(undefined),
			},
		};
		const delayedGraph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => gate.promise,
				},
			],
		});
		const result = runTestGraph({ graph: delayedGraph, participants });
		participants.write.prepare = replacement;
		gate.resolve({
			...success('done'),
			effects: [{ participant: 'write', payload: 'payload' }],
		});
		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
		expect(originalPrepare).toHaveBeenCalledTimes(1);
		expect(replacement).not.toHaveBeenCalled();
	});

	it('adopts a hostile prepare thenable exactly once and recursively', async () => {
		let outerReads = 0;
		let outerCalls = 0;
		let innerCalls = 0;
		const inner = {
			then(resolve: (value: unknown) => void) {
				innerCalls += 1;
				resolve(phaseSuccess('prepared'));
			},
		};
		const outer = Object.defineProperty({}, 'then', {
			get() {
				outerReads += 1;
				return (resolve: (value: unknown) => void) => {
					outerCalls += 1;
					resolve(inner);
				};
			},
		});
		const result = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => outer,
					commit: () => phaseSuccess(undefined),
					compensate: () => phaseSuccess(undefined),
				},
			},
		});

		expect(result).toBeInstanceOf(Promise);
		expect(outerReads).toBe(1);
		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
		expect({ outerReads, outerCalls, innerCalls }).toEqual({
			outerReads: 1,
			outerCalls: 1,
			innerCalls: 1,
		});
	});

	it('keeps non-callable then synchronous and contains a throwing getter', () => {
		const synchronous = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => ({
						...phaseSuccess('prepared'),
						then: 42,
					}),
					commit: () => phaseSuccess(undefined),
					compensate: () => phaseSuccess(undefined),
				},
			},
		});
		expect(synchronous).not.toBeInstanceOf(Promise);
		expect(synchronous).toMatchObject({ kind: 'succeeded' });

		const original = new Error('then getter');
		const hostile = Object.defineProperty({}, 'then', {
			get() {
				throw original;
			},
		});
		const failed = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => hostile,
					commit: () => phaseSuccess(undefined),
					compensate: () => phaseSuccess(undefined),
				},
			},
		});
		expect(failed).not.toBeInstanceOf(Promise);
		expect(failed).toMatchObject({
			kind: 'failed',
			primaryFailure: {
				kind: 'effect',
				error: { kind: 'thrown', error: original },
			},
		});
	});

	it('adopts a hostile commit thenable once and uses first settlement', async () => {
		let reads = 0;
		let calls = 0;
		const later = new Error('later');
		const thenable = Object.defineProperty({}, 'then', {
			get() {
				reads += 1;
				return (
					resolve: (value: unknown) => void,
					reject: (error: unknown) => void
				) => {
					calls += 1;
					resolve(phaseSuccess('receipt'));
					reject(later);
				};
			},
		});
		const result = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => phaseSuccess('prepared'),
					commit: () => thenable,
					compensate: () => phaseSuccess(undefined),
				},
			},
		});

		expect(reads).toBe(1);
		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
		expect({ reads, calls }).toEqual({ reads: 1, calls: 1 });
	});

	it('retains invalid phase results as thrown validation failures', () => {
		const invalidPrepare = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => 42,
					commit: () => phaseSuccess(undefined),
					compensate: () => phaseSuccess(undefined),
				},
			},
		});
		expect(invalidPrepare).toMatchObject({
			kind: 'failed',
			primaryFailure: {
				error: {
					kind: 'thrown',
					phase: 'prepare',
					error: { code: 'invalid-effect-result' },
				},
			},
		});

		const invalidCommit = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => phaseSuccess('prepared'),
					commit: () => ({ kind: 'success' }),
					compensate: () => phaseSuccess(undefined),
				},
			},
		});
		expect(invalidCommit).toMatchObject({
			kind: 'failed',
			primaryFailure: {
				kind: 'thrown',
				phase: 'commit',
				error: { code: 'invalid-effect-result' },
			},
		});

		const original = new Error('graph');
		const graph = compileTestGraph({
			maxConcurrency: 2,
			effectKeys: ['write'],
			nodes: [
				{
					key: 'a',
					effectKeys: ['write'],
					executor: () => ({
						...success('a'),
						effects: [{ participant: 'write', payload: 'x' }],
					}),
				},
				{ key: 'b', executor: () => failure(original) },
			],
		});
		const invalidCompensation = runTestGraph({
			graph,
			participants: {
				write: {
					prepare: () => phaseSuccess('prepared'),
					commit: () => phaseSuccess(undefined),
					compensate: () => phaseSuccess('not-void'),
				},
			},
		});
		expect(invalidCompensation).toMatchObject({
			kind: 'failed',
			primaryFailure: { error: original },
			effectFailures: [
				{
					kind: 'thrown',
					phase: 'compensate',
					error: { code: 'invalid-effect-result' },
				},
			],
		});
	});

	it('retains rejections without rejecting the public run and compensates exactly once', async () => {
		const rejected = new Error('commit rejected');
		const compensate = jest.fn(() => phaseSuccess(undefined));
		const result = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => phaseSuccess('prepared'),
					commit: () => Promise.reject(rejected),
					compensate,
				},
			},
		});

		await expect(result).resolves.toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'thrown', error: rejected },
		});
		expect(compensate).toHaveBeenCalledTimes(1);
	});

	it('passes frozen options without participant this and hides process-local values', () => {
		const seenThis: unknown[] = [];
		const prepared = { local: true };
		const receipt = { receipt: true };
		const graph = effectGraph();
		const result = runTestGraph({
			graph,
			participants: {
				write: {
					prepare(this: unknown, options: unknown) {
						seenThis.push(this);
						expect(Object.isFrozen(options)).toBe(true);
						return phaseSuccess(prepared);
					},
					commit(this: unknown, options: unknown) {
						seenThis.push(this);
						expect(Object.isFrozen(options)).toBe(true);
						return phaseSuccess(receipt);
					},
					compensate(this: unknown) {
						seenThis.push(this);
						return phaseSuccess(undefined);
					},
				},
			},
		});

		expect(result).toMatchObject({ kind: 'succeeded' });
		if (result instanceof Promise) {
			throw new Error('Expected synchronous result.');
		}
		expect(seenThis).toEqual([undefined, undefined]);
		expect(result.effectJournal[0]).not.toHaveProperty('prepared');
		expect(result.effectJournal[0]).not.toHaveProperty('receipt');
		expect(Object.isFrozen(result.effectJournal[0])).toBe(true);
	});

	it('publishes frozen FIFO effect events without gating work and waits at terminal', async () => {
		const gate = controlled<void>();
		const events: RunEvent[] = [];
		const calls: string[] = [];
		const observerFailure = new Error('observer');
		const result = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => {
						calls.push('prepare');
						return phaseSuccess('prepared');
					},
					commit: () => {
						calls.push('commit');
						return phaseSuccess(undefined);
					},
					compensate: () => phaseSuccess(undefined),
				},
			},
			observers: [
				(event) => {
					events.push(event);
					expect(Object.isFrozen(event)).toBe(true);
					return event.kind === 'effect-transition' &&
						event.phase === 'prepare'
						? gate.promise
						: undefined;
				},
				(event) => {
					if (
						event.kind === 'effect-transition' &&
						event.phase === 'commit'
					) {
						throw observerFailure;
					}
				},
			],
		});
		let settled = false;
		void Promise.resolve(result).then(() => {
			settled = true;
		});

		expect(calls).toEqual(['prepare', 'commit']);
		expect(settled).toBe(false);
		gate.resolve(undefined);
		await flushMicrotasks();
		await expect(result).resolves.toMatchObject({
			kind: 'succeeded',
			observerFailures: [
				expect.objectContaining({ error: observerFailure }),
			],
		});
		expect(events.map(({ kind }) => kind)).toEqual([
			'node-transition',
			'effect-transition',
			'node-transition',
			'effect-transition',
			'run-terminal',
		]);
	});
});
