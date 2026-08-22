import {
	commitEffectJournal,
	compileEffectParticipants,
	compensateEffectJournal,
	createEffectJournalRuntime,
	orderedJournalEntries,
	prepareEffect,
	projectEffectJournal,
	projectPreparedEffects,
	settleGraphEffects,
} from '../../effects/index.js';
import { createObserverRuntime } from '../../observers/dispatcher.js';
import {
	compileTestGraph,
	controlled,
	failure,
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

const createPreparedRuntime = (options: {
	readonly commit: () => unknown;
	readonly compensate: () => unknown;
	readonly observers?: ReturnType<typeof createObserverRuntime>;
}) => {
	const graph = effectGraph();
	const runtime = createEffectJournalRuntime({
		participants: compileEffectParticipants({
			graph,
			participants: {
				write: {
					prepare: () => phaseSuccess('prepared'),
					commit: options.commit,
					compensate: options.compensate,
				},
			},
		}),
		observers: options.observers ?? createObserverRuntime({}),
	});
	const prepared = prepareEffect({
		runtime,
		effect: Object.freeze({
			node: 'node',
			nodeOrdinal: 0,
			effectOrdinal: 0,
			request: Object.freeze({
				participant: 'write',
				payload: 'payload',
			}),
		}) as never,
		signal: new AbortController().signal,
	});
	if (prepared instanceof Promise || !prepared.ok) {
		throw new Error('Expected synchronous test preparation.');
	}
	return runtime;
};

describe('v2 effect settlement boundaries', () => {
	it('contains non-record participant registries and participant values', () => {
		const graph = effectGraph();
		expect(() =>
			runTestGraph({ graph, participants: 42 as never })
		).toThrow('inspectable plain record');
		expect(() =>
			runTestGraph({
				graph,
				participants: { write: 42 } as never,
			})
		).toThrow('inspectable plain record');
		expect(() =>
			compileEffectParticipants({
				graph: { ...graph } as never,
				participants: {},
			})
		).toThrow('effect authority is unavailable');
	});

	it('contains hostile result inspection and an asynchronous prepare rejection', async () => {
		const hostile = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('hostile result');
				},
			}
		);
		const inspected = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => hostile,
					commit: () => phaseSuccess(undefined),
					compensate: () => phaseSuccess(undefined),
				},
			},
		});
		expect(inspected).toMatchObject({
			kind: 'failed',
			primaryFailure: {
				error: {
					kind: 'thrown',
					phase: 'prepare',
					error: { code: 'invalid-effect-result' },
				},
			},
		});

		const rejected = new Error('prepare rejected');
		const asynchronous = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => Promise.reject(rejected),
					commit: () => phaseSuccess(undefined),
					compensate: () => phaseSuccess(undefined),
				},
			},
		});
		await expect(asynchronous).resolves.toMatchObject({
			kind: 'failed',
			primaryFailure: {
				error: { kind: 'thrown', phase: 'prepare', error: rejected },
			},
		});
	});

	it('contains synchronous throws and makes compensation primary after cancellation', () => {
		const commitError = new Error('commit threw');
		const commitFailure = runTestGraph({
			graph: effectGraph(),
			participants: {
				write: {
					prepare: () => phaseSuccess('prepared'),
					commit: () => {
						throw commitError;
					},
					compensate: () => phaseSuccess(undefined),
				},
			},
		});
		expect(commitFailure).toMatchObject({
			kind: 'failed',
			primaryFailure: {
				kind: 'thrown',
				phase: 'commit',
				error: commitError,
			},
		});

		const controller = new AbortController();
		const compensationError = new Error('compensation');
		const cancelled = runTestGraph({
			graph: effectGraph(),
			signal: controller.signal,
			participants: {
				write: {
					prepare: () => {
						controller.abort('cancel');
						return phaseSuccess('prepared');
					},
					commit: () => phaseSuccess(undefined),
					compensate: () => ({
						kind: 'failure' as const,
						error: compensationError,
					}),
				},
			},
		});
		expect(cancelled).toMatchObject({
			kind: 'failed',
			primaryFailure: {
				kind: 'declared',
				phase: 'compensate',
				error: compensationError,
			},
		});
	});

	it('keeps graph primacy when compensation throws synchronously', () => {
		const graphError = new Error('graph');
		const compensationError = new Error('compensation threw');
		const graph = compileTestGraph({
			maxConcurrency: 2,
			effectKeys: ['write'],
			nodes: [
				{
					key: 'prepared',
					effectKeys: ['write'],
					executor: () => ({
						...success('done'),
						effects: [{ participant: 'write', payload: 'payload' }],
					}),
				},
				{ key: 'failed', executor: () => failure(graphError) },
			],
		});
		const result = runTestGraph({
			graph,
			participants: {
				write: {
					prepare: () => phaseSuccess('prepared'),
					commit: () => phaseSuccess(undefined),
					compensate: () => {
						throw compensationError;
					},
				},
			},
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { error: graphError },
			effectFailures: [
				{
					kind: 'thrown',
					phase: 'compensate',
					error: compensationError,
				},
			],
		});
	});

	it('joins overlapping commit and contains one controlled rejection', async () => {
		const gate = controlled<unknown>();
		const commit = jest.fn(() => gate.promise);
		const compensate = jest.fn(() => phaseSuccess(undefined));
		const runtime = createPreparedRuntime({ commit, compensate });
		const signal = new AbortController().signal;
		const first = commitEffectJournal({ runtime, signal });
		const second = commitEffectJournal({ runtime, signal });

		expect(first).toBeInstanceOf(Promise);
		expect(second).toBe(first);
		expect(commit).toHaveBeenCalledTimes(1);
		const rejected = new Error('commit rejected');
		gate.reject(rejected);
		await expect(first).resolves.toMatchObject({
			kind: 'compensated',
			trigger: 'commit',
			triggerFailure: { kind: 'thrown', error: rejected },
		});
		await expect(second).resolves.toMatchObject({
			kind: 'compensated',
			trigger: 'commit',
		});
		const settled = commitEffectJournal({ runtime, signal });
		expect(settled).not.toBeInstanceOf(Promise);
		expect(settled).toMatchObject({
			kind: 'compensated',
			trigger: 'commit',
		});
		expect({ commit, compensate }).toMatchObject({
			commit: expect.any(Function),
			compensate: expect.any(Function),
		});
		expect(commit).toHaveBeenCalledTimes(1);
		expect(compensate).toHaveBeenCalledTimes(1);
		expect(projectEffectJournal(runtime)).toMatchObject([
			{ commit: 'failed', compensation: 'succeeded' },
		]);
	});

	it('joins overlapping compensation and contains one controlled rejection', async () => {
		const gate = controlled<unknown>();
		const commit = jest.fn(() => phaseSuccess('receipt'));
		const compensate = jest.fn(() => gate.promise);
		const runtime = createPreparedRuntime({ commit, compensate });
		const signal = new AbortController().signal;
		const first = compensateEffectJournal({
			runtime,
			signal,
			trigger: 'graph',
		});
		const second = compensateEffectJournal({
			runtime,
			signal,
			trigger: 'graph',
		});

		expect(first).toBeInstanceOf(Promise);
		expect(second).toBe(first);
		expect(compensate).toHaveBeenCalledTimes(1);
		const rejected = new Error('compensation rejected');
		gate.reject(rejected);
		await expect(first).resolves.toMatchObject({
			kind: 'compensated',
			trigger: 'graph',
		});
		await expect(second).resolves.toMatchObject({
			kind: 'compensated',
			trigger: 'graph',
		});
		const settled = compensateEffectJournal({
			runtime,
			signal,
			trigger: 'graph',
		});
		expect(settled).not.toBeInstanceOf(Promise);
		expect(settled).toMatchObject({
			kind: 'compensated',
			trigger: 'graph',
		});
		expect(commit).not.toHaveBeenCalled();
		expect(compensate).toHaveBeenCalledTimes(1);
		expect(runtime.failures).toMatchObject([
			{ phase: 'compensate', kind: 'thrown', error: rejected },
		]);
		expect(projectEffectJournal(runtime)).toMatchObject([
			{ commit: 'not-attempted', compensation: 'failed' },
		]);
	});

	it('joins calls re-entered before an asynchronous commit is returned', async () => {
		const gate = controlled<unknown>();
		let nestedFirst!: Promise<unknown>;
		let nestedSecond!: Promise<unknown>;
		const signal = new AbortController().signal;
		const commit = jest.fn(() => gate.promise);
		const runtime = createPreparedRuntime({
			commit,
			compensate: () => phaseSuccess(undefined),
		});
		commit.mockImplementation(() => {
			nestedFirst = commitEffectJournal({
				runtime,
				signal,
			}) as Promise<unknown>;
			nestedSecond = commitEffectJournal({
				runtime,
				signal,
			}) as Promise<unknown>;
			return gate.promise;
		});

		const outer = commitEffectJournal({ runtime, signal });
		expect(outer).toBeInstanceOf(Promise);
		expect(nestedFirst).toBeInstanceOf(Promise);
		expect(nestedSecond).toBe(nestedFirst);
		expect(commit).toHaveBeenCalledTimes(1);
		gate.resolve(phaseSuccess('receipt'));
		await expect(outer).resolves.toEqual({ kind: 'committed' });
		await expect(nestedFirst).resolves.toEqual({ kind: 'committed' });
		expect(commitEffectJournal({ runtime, signal })).toEqual({
			kind: 'committed',
		});
	});

	it('rejects re-entrant joins and retains an unexpected synchronous failure', async () => {
		const internalError = new Error('observer authority failed');
		let nested!: Promise<unknown>;
		const signal = new AbortController().signal;
		const commit = jest.fn(() => phaseSuccess('receipt'));
		const runtime = createPreparedRuntime({
			commit,
			compensate: () => phaseSuccess(undefined),
		});
		commit.mockImplementation(() => {
			nested = commitEffectJournal({
				runtime,
				signal,
			}) as Promise<unknown>;
			return phaseSuccess('receipt');
		});
		runtime.observers.events.push = () => {
			throw internalError;
		};

		expect(() => commitEffectJournal({ runtime, signal })).toThrow(
			internalError
		);
		await expect(nested).rejects.toBe(internalError);
		expect(() => commitEffectJournal({ runtime, signal })).toThrow(
			internalError
		);
	});

	it('retains an unexpected asynchronous settlement failure', async () => {
		const gate = controlled<unknown>();
		const internalError = new Error('async observer authority failed');
		const runtime = createPreparedRuntime({
			commit: () => gate.promise,
			compensate: () => phaseSuccess(undefined),
		});
		runtime.observers.events.push = () => {
			throw internalError;
		};
		const signal = new AbortController().signal;
		const settlement = commitEffectJournal({ runtime, signal });

		expect(settlement).toBeInstanceOf(Promise);
		gate.resolve(phaseSuccess('receipt'));
		await expect(settlement).rejects.toBe(internalError);
		expect(() => commitEffectJournal({ runtime, signal })).toThrow(
			internalError
		);
	});

	it('caches synchronous settlement and retains reasonless cancellation projection', () => {
		const commit = jest.fn(() => phaseSuccess('receipt'));
		const compensate = jest.fn(() => phaseSuccess(undefined));
		const runtime = createPreparedRuntime({ commit, compensate });
		const signal = new AbortController().signal;
		expect(commitEffectJournal({ runtime, signal })).toMatchObject({
			kind: 'committed',
		});
		expect(commitEffectJournal({ runtime, signal })).toMatchObject({
			kind: 'committed',
		});
		expect(orderedJournalEntries(runtime)).toHaveLength(1);
		expect(projectPreparedEffects(runtime)).toHaveLength(1);
		expect(
			compensateEffectJournal({
				runtime,
				signal,
				trigger: 'graph',
			})
		).toMatchObject({ kind: 'committed' });
		expect(projectEffectJournal(runtime)).toMatchObject([
			{ commit: 'succeeded', compensation: 'not-attempted' },
		]);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(compensate).not.toHaveBeenCalled();

		const terminal = settleGraphEffects({
			runtime,
			graph: Object.freeze({
				kind: 'cancelled',
				nodes: Object.freeze([]),
				pendingEffects: Object.freeze([]),
				pendingPauses: Object.freeze([]),
				observerFailures: Object.freeze([]),
			}) as never,
			signal: new AbortController().signal,
		});
		expect(terminal).toMatchObject({ kind: 'cancelled' });
		expect(terminal).not.toHaveProperty('reason');
	});
});
