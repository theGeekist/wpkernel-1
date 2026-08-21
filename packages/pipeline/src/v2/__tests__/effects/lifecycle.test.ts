import {
	compileTestGraph,
	controlled,
	failure,
	flushMicrotasks,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';
import type { EffectRunEvent } from '../../observers/types.js';

const phaseSuccess = <T>(value: T) => ({
	kind: 'success' as const,
	value,
});

describe('v2 unified effect journal lifecycle', () => {
	it('prepares before, node and after requests in phase order and commits synchronously', () => {
		const calls: string[] = [];
		const graph = compileTestGraph({
			effectKeys: ['write'],
			outputs: { result: 'node' },
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => {
						calls.push('node');
						return {
							...success('done'),
							effects: [
								{ participant: 'write', payload: 'node' },
							],
						};
					},
				},
			],
		});
		const result = runTestGraph({
			graph,
			middleware: [
				{
					node: 'node',
					before: () => {
						calls.push('before');
						return {
							state: 'entered',
							effects: [
								{ participant: 'write', payload: 'before' },
							],
						};
					},
					after: () => {
						calls.push('after');
						return [{ participant: 'write', payload: 'after' }];
					},
				},
			],
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: string }) => {
						calls.push(`prepare:${payload}`);
						return phaseSuccess(`prepared:${payload}`);
					},
					commit: ({ prepared }: { readonly prepared: string }) => {
						calls.push(`commit:${prepared}`);
						return phaseSuccess(`receipt:${prepared}`);
					},
					compensate: () => phaseSuccess(undefined),
				},
			},
		});

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'done' },
			effectJournal: [
				{ effectOrdinal: 0, commit: 'succeeded' },
				{ effectOrdinal: 1, commit: 'succeeded' },
				{ effectOrdinal: 2, commit: 'succeeded' },
			],
		});
		expect(calls).toEqual([
			'before',
			'prepare:before',
			'node',
			'prepare:node',
			'after',
			'prepare:after',
			'commit:prepared:before',
			'commit:prepared:node',
			'commit:prepared:after',
		]);
	});

	it('allows admitted nodes to prepare concurrently but commits by logical chronology', async () => {
		const gates = {
			a: controlled<ReturnType<typeof phaseSuccess<string>>>(),
			b: controlled<ReturnType<typeof phaseSuccess<string>>>(),
		};
		const calls: string[] = [];
		const graph = compileTestGraph({
			maxConcurrency: 2,
			effectKeys: ['write'],
			nodes: ['a', 'b'].map((key) => ({
				key,
				effectKeys: ['write'],
				executor: () => ({
					...success(key),
					effects: [{ participant: 'write', payload: key }],
				}),
			})),
		});
		const result = runTestGraph({
			graph,
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: 'a' | 'b' }) => {
						calls.push(`prepare:${payload}`);
						return gates[payload].promise;
					},
					commit: ({ prepared }: { readonly prepared: string }) => {
						calls.push(`commit:${prepared}`);
						return phaseSuccess(undefined);
					},
					compensate: () => phaseSuccess(undefined),
				},
			},
		});

		expect(calls).toEqual(['prepare:a', 'prepare:b']);
		gates.b.resolve(phaseSuccess('b'));
		await flushMicrotasks();
		expect(calls).toEqual(['prepare:a', 'prepare:b']);
		gates.a.resolve(phaseSuccess('a'));

		await expect(result).resolves.toMatchObject({
			kind: 'succeeded',
			effectJournal: [
				{ node: 'a', nodeOrdinal: 0 },
				{ node: 'b', nodeOrdinal: 1 },
			],
		});
		expect(calls).toEqual([
			'prepare:a',
			'prepare:b',
			'commit:a',
			'commit:b',
		]);
	});

	it('waits for each request before admitting the next phase in one node', async () => {
		const gate = controlled<ReturnType<typeof phaseSuccess<string>>>();
		const calls: string[] = [];
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => {
						calls.push('node');
						return success('done');
					},
				},
			],
		});
		const result = runTestGraph({
			graph,
			middleware: [
				{
					node: 'node',
					before: () => {
						calls.push('before');
						return {
							state: undefined,
							effects: [
								{ participant: 'write', payload: 'before' },
							],
						};
					},
					after: () => {
						calls.push('after');
						return [];
					},
				},
			],
			participants: {
				write: {
					prepare: () => {
						calls.push('prepare');
						return gate.promise;
					},
					commit: () => phaseSuccess(undefined),
					compensate: () => phaseSuccess(undefined),
				},
			},
		});

		expect(calls).toEqual(['before', 'prepare']);
		gate.resolve(phaseSuccess('prepared'));
		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
		expect(calls).toEqual(['before', 'prepare', 'node', 'after']);
	});

	it('makes a prepare failure the node primary and compensates prior entries', () => {
		const declared = { code: 'prepare' } as const;
		const calls: string[] = [];
		const errorPhase = jest.fn();
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => ({
						...success('done'),
						effects: ['one', 'two', 'three'].map((payload) => ({
							participant: 'write',
							payload,
						})),
					}),
				},
			],
		});
		const result = runTestGraph({
			graph,
			middleware: [
				{
					node: 'node',
					before: () => ({ state: undefined, effects: [] }),
					error: errorPhase,
				},
			],
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: string }) => {
						calls.push(`prepare:${payload}`);
						return payload === 'two'
							? { kind: 'failure' as const, error: declared }
							: phaseSuccess(payload);
					},
					commit: () => phaseSuccess(undefined),
					compensate: ({
						prepared,
					}: {
						readonly prepared: string;
					}) => {
						calls.push(`compensate:${prepared}`);
						return phaseSuccess(undefined);
					},
				},
			},
		});

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: {
				kind: 'effect',
				error: { kind: 'declared', phase: 'prepare', error: declared },
			},
			effectJournal: [{ effectOrdinal: 0, compensation: 'succeeded' }],
		});
		expect(calls).toEqual(['prepare:one', 'prepare:two', 'compensate:one']);
		expect(errorPhase).toHaveBeenCalledWith(
			expect.objectContaining({
				error: expect.objectContaining({ phase: 'prepare' }),
			})
		);
	});

	it('continues earlier after phases after a prepare failure, then error-unwinds', () => {
		const declared = new Error('after prepare');
		const calls: string[] = [];
		const effectEvents: EffectRunEvent[] = [];
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => success('done'),
				},
			],
		});
		const result = runTestGraph({
			graph,
			observers: [
				(event) => {
					if (event.kind === 'effect-transition') {
						effectEvents.push(event);
					}
				},
			],
			middleware: [
				{
					node: 'node',
					before: () => ({ state: 'one', effects: [] }),
					after: () => {
						calls.push('after-one');
						return [{ participant: 'write', payload: 'good' }];
					},
					error: () => calls.push('error-one'),
				},
				{
					node: 'node',
					before: () => ({ state: 'two', effects: [] }),
					after: () => {
						calls.push('after-two');
						return [{ participant: 'write', payload: 'bad' }];
					},
					error: () => calls.push('error-two'),
				},
			],
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: string }) => {
						calls.push(`prepare:${payload}`);
						return payload === 'bad'
							? { kind: 'failure' as const, error: declared }
							: phaseSuccess(payload);
					},
					commit: () => phaseSuccess(undefined),
					compensate: ({
						prepared,
					}: {
						readonly prepared: string;
					}) => {
						calls.push(`compensate:${prepared}`);
						return phaseSuccess(undefined);
					},
				},
			},
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: {
				kind: 'effect',
				error: {
					phase: 'prepare',
					effectOrdinal: 0,
					error: declared,
				},
			},
			effectFailures: [{ effectOrdinal: 0 }],
			effectJournal: [{ effectOrdinal: 1 }],
		});
		expect(calls).toEqual([
			'after-two',
			'prepare:bad',
			'after-one',
			'prepare:good',
			'error-two',
			'error-one',
			'compensate:good',
		]);
		expect(
			effectEvents.map(({ phase, state, effectOrdinal }) => [
				phase,
				state,
				effectOrdinal,
			])
		).toEqual([
			['prepare', 'failed', 0],
			['prepare', 'succeeded', 1],
			['compensate', 'succeeded', 1],
		]);
	});

	it('stops after the first commit failure then compensates every entry in reverse', () => {
		const declared = new Error('commit-two');
		const calls: string[] = [];
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => ({
						...success('done'),
						effects: ['one', 'two', 'three'].map((payload) => ({
							participant: 'write',
							payload,
						})),
					}),
				},
			],
		});
		const result = runTestGraph({
			graph,
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: string }) =>
						phaseSuccess(payload),
					commit: ({ prepared }: { readonly prepared: string }) => {
						calls.push(`commit:${prepared}`);
						return prepared === 'two'
							? { kind: 'failure' as const, error: declared }
							: phaseSuccess(`receipt:${prepared}`);
					},
					compensate: (options: {
						readonly prepared: string;
						readonly receipt?: string;
					}) => {
						calls.push(
							`compensate:${options.prepared}:${String(options.receipt)}`
						);
						return phaseSuccess(undefined);
					},
				},
			},
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: {
				kind: 'declared',
				phase: 'commit',
				error: declared,
			},
		});
		expect(calls).toEqual([
			'commit:one',
			'commit:two',
			'compensate:three:undefined',
			'compensate:two:undefined',
			'compensate:one:receipt:one',
		]);
	});

	it('keeps graph primacy and retains every compensation failure', () => {
		const graphFailure = new Error('graph');
		const cleanupB = new Error('cleanup-b');
		const cleanupA = new Error('cleanup-a');
		const calls: string[] = [];
		const graph = compileTestGraph({
			maxConcurrency: 3,
			effectKeys: ['write'],
			nodes: [
				...['a', 'b'].map((key) => ({
					key,
					effectKeys: ['write'],
					executor: () => ({
						...success(key),
						effects: [{ participant: 'write', payload: key }],
					}),
				})),
				{ key: 'c', executor: () => failure(graphFailure) },
			],
		});
		const result = runTestGraph({
			graph,
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: string }) =>
						phaseSuccess(payload),
					commit: () => phaseSuccess(undefined),
					compensate: ({
						prepared,
					}: {
						readonly prepared: string;
					}) => {
						calls.push(prepared);
						return {
							kind: 'failure' as const,
							error: prepared === 'b' ? cleanupB : cleanupA,
						};
					},
				},
			},
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { node: 'c', error: graphFailure },
			effectFailures: [
				{ phase: 'compensate', error: cleanupB },
				{ phase: 'compensate', error: cleanupA },
			],
		});
		expect(calls).toEqual(['b', 'a']);
	});
});
