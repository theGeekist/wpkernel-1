import type { GraphValue } from '../../graph/types.js';
import {
	compileTestGraph,
	failure,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

describe('v2 single-node middleware interpretation', () => {
	it('composes explicit phases and one logical effect handoff synchronously', () => {
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
							...success({ owned: ['node'] }),
							effects: [
								{ participant: 'write', payload: 'node' },
							],
						};
					},
				},
			],
		});
		const middleware = [
			{
				node: 'node',
				before: () => {
					calls.push('before-1');
					return {
						state: 'state-1',
						effects: [
							{ participant: 'write', payload: 'before-1' },
						],
					};
				},
				after: (options: unknown) => {
					const entered = options as {
						readonly state: string;
						readonly output: GraphValue;
					};
					calls.push(`after-1:${entered.state}`);
					expect(Object.isFrozen(entered.output)).toBe(true);
					return [{ participant: 'write', payload: 'after-1' }];
				},
			},
			{
				node: 'node',
				before: () => {
					calls.push('before-2');
					return {
						state: 'state-2',
						effects: [
							{ participant: 'write', payload: 'before-2' },
						],
					};
				},
				after: (options: unknown) => {
					const entered = options as { readonly state: string };
					calls.push(`after-2:${entered.state}`);
					return [{ participant: 'write', payload: 'after-2' }];
				},
			},
		] as const;

		const result = runTestGraph({ graph, middleware });

		expect(result).not.toBeInstanceOf(Promise);
		expect(calls).toEqual([
			'before-1',
			'before-2',
			'node',
			'after-2:state-2',
			'after-1:state-1',
		]);
		expect(result).toMatchObject({
			kind: 'succeeded',
			outputs: { result: { owned: ['node'] } },
			pendingEffects: [
				{ effectOrdinal: 0, request: { payload: 'before-1' } },
				{ effectOrdinal: 1, request: { payload: 'before-2' } },
				{ effectOrdinal: 2, request: { payload: 'node' } },
				{ effectOrdinal: 3, request: { payload: 'after-2' } },
				{ effectOrdinal: 4, request: { payload: 'after-1' } },
			],
		});
	});

	it('unwinds only entered middleware after a before failure', () => {
		const original = new Error('before failed');
		const calls: string[] = [];
		const executor = jest.fn(() => success('never'));
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [{ key: 'node', effectKeys: ['write'], executor }],
		});
		const result = runTestGraph({
			graph,
			middleware: [
				{
					node: 'node',
					before: () => ({
						state: 'entered',
						effects: [
							{ participant: 'write', payload: 'retained' },
						],
					}),
					error: () => {
						calls.push('error-1');
					},
					after: () => {
						calls.push('after-1');
						return [];
					},
				},
				{
					node: 'node',
					before: () => {
						calls.push('before-2');
						throw original;
					},
					error: () => calls.push('error-2'),
				},
				{
					node: 'node',
					before: () => {
						calls.push('before-3');
						return { state: undefined, effects: [] };
					},
				},
			],
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'thrown', error: original },
			pendingEffects: [{ request: { payload: 'retained' } }],
		});
		expect(calls).toEqual(['before-2', 'error-1']);
		expect(executor).not.toHaveBeenCalled();
	});

	it('runs every after and error phase while retaining secondary failures', () => {
		const afterFailure = new Error('after-2');
		const laterAfterFailure = new Error('after-1');
		const cleanupFailure = new Error('cleanup');
		const calls: string[] = [];
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('output') }],
		});
		const result = runTestGraph({
			graph,
			middleware: [
				{
					node: 'node',
					before: () => ({ state: 'one', effects: [] }),
					after: () => {
						calls.push('after-1');
						throw laterAfterFailure;
					},
					error: () => {
						calls.push('error-1');
						throw cleanupFailure;
					},
				},
				{
					node: 'node',
					before: () => ({ state: 'two', effects: [] }),
					after: () => {
						calls.push('after-2');
						throw afterFailure;
					},
					error: () => {
						calls.push('error-2');
					},
				},
			],
		});

		expect(calls).toEqual(['after-2', 'after-1', 'error-2', 'error-1']);
		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { error: afterFailure },
			failures: [
				{ error: afterFailure },
				{ error: laterAfterFailure },
				{ error: cleanupFailure },
			],
		});
	});

	it('runs reverse cancel cleanup and promotes its first failure', () => {
		const controller = new AbortController();
		const cancelFailure = new Error('cancel-2');
		const calls: string[] = [];
		const graph = compileTestGraph({
			nodes: [
				{
					key: 'node',
					executor: () => {
						controller.abort('stop');
						return success('done');
					},
				},
			],
		});
		const result = runTestGraph({
			graph,
			signal: controller.signal,
			middleware: [
				{
					node: 'node',
					before: () => ({ state: 'one', effects: [] }),
					cancel: () => calls.push('cancel-1'),
					error: () => calls.push('error-1'),
				},
				{
					node: 'node',
					before: () => ({ state: 'two', effects: [] }),
					cancel: () => {
						calls.push('cancel-2');
						throw cancelFailure;
					},
				},
			],
		});

		expect(calls).toEqual(['cancel-2', 'cancel-1']);
		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { error: cancelFailure },
		});
	});

	it('keeps a sibling graph failure above an earlier cancel failure', () => {
		const controller = new AbortController();
		const cancelFailure = new Error('cancel');
		const graphFailure = new Error('graph');
		const graph = compileTestGraph({
			maxConcurrency: 2,
			nodes: [
				{
					key: 'a',
					executor: () => {
						controller.abort('stop');
						return success('a');
					},
				},
				{ key: 'b', executor: () => failure(graphFailure) },
			],
		});

		const result = runTestGraph({
			graph,
			signal: controller.signal,
			middleware: [
				{
					node: 'a',
					before: () => ({ state: undefined, effects: [] }),
					cancel: () => {
						throw cancelFailure;
					},
				},
			],
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { node: 'b', error: graphFailure },
			failures: [
				{ node: 'b', error: graphFailure },
				{ node: 'a', error: cancelFailure },
			],
		});
	});

	it('adopts each middleware thenable exactly once', async () => {
		let reads = 0;
		let calls = 0;
		const thenable = Object.defineProperty({}, 'then', {
			get() {
				reads += 1;
				return (resolve: (value: unknown) => void) => {
					calls += 1;
					resolve({ state: 'async', effects: [] });
				};
			},
		});
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});

		const result = runTestGraph({
			graph,
			middleware: [{ node: 'node', before: () => thenable }],
		});

		expect(result).toBeInstanceOf(Promise);
		expect(reads).toBe(1);
		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
		expect(reads).toBe(1);
		expect(calls).toBe(1);
	});

	it('rejects hostile, unknown-node and non-callable registrations', () => {
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});
		const hostile = Object.defineProperty({}, 'node', {
			enumerable: true,
			get: () => 'node',
		});

		expect(() =>
			runTestGraph({ graph, middleware: [hostile as never] })
		).toThrow('inspectable plain record');
		expect(() =>
			runTestGraph({ graph, middleware: [{ node: 'missing' }] })
		).toThrow('must name one compiled node');
		expect(() =>
			runTestGraph({
				graph,
				middleware: [{ node: 'node', before: 42 } as never],
			})
		).toThrow('non-callable before');
	});

	it('does not bind executor or middleware authority as participant this', () => {
		const seen: unknown[] = [];
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					executor(this: unknown) {
						seen.push(this);
						if (this) {
							const authority = this as {
								effectKeys: string[];
								nodeOrdinal: number;
							};
							authority.effectKeys = ['write'];
							authority.nodeOrdinal = 77;
						}
						return {
							...success('done'),
							effects: [
								{ participant: 'write', payload: 'forbidden' },
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
					before(this: unknown) {
						seen.push(this);
						return { state: undefined, effects: [] };
					},
				},
			],
		});

		expect(seen).toEqual([undefined, undefined]);
		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'contract', nodeOrdinal: 0 },
			pendingEffects: [],
		});
	});

	it('hides node output when abort stops a remaining after phase', () => {
		const controller = new AbortController();
		const after = jest.fn(() => []);
		const graph = compileTestGraph({
			nodes: [
				{
					key: 'node',
					executor: () => {
						controller.abort('stop');
						return success({ secret: 'hidden' });
					},
				},
			],
		});

		const result = runTestGraph({
			graph,
			signal: controller.signal,
			middleware: [{ node: 'node', after }],
		});

		expect(result).toMatchObject({
			kind: 'cancelled',
			nodes: [{ node: 'node', kind: 'cancelled' }],
		});
		if (result instanceof Promise) {
			throw new Error('Expected synchronous cancellation.');
		}
		expect('output' in result.nodes[0]!).toBe(false);
		expect(after).not.toHaveBeenCalled();
	});
});
