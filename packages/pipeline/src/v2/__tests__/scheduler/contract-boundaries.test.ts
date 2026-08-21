import { deserialize, serialize } from 'node:v8';
import type { ErasedGraph, GraphValue } from '../../graph/types.js';
import {
	createGraphSchedulerError,
	scheduleGraph,
} from '../../scheduler/index.js';
import {
	compileTestGraph,
	controlled,
	failure,
	flushMicrotasks,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

const expectContractFailure = (value: unknown): void => {
	expect(value).toMatchObject({
		kind: 'failed',
		primaryFailure: { kind: 'contract' },
	});
};

const rejectedGraph = (value: unknown): unknown => {
	try {
		runTestGraph({ graph: value as ErasedGraph });
	} catch (error) {
		return error;
	}
	throw new Error('Expected graph authority rejection.');
};

describe('v2 scheduler contract boundaries', () => {
	it('exports a frozen tagged native scheduler error factory', () => {
		const cause = new Error('cause');
		const error = createGraphSchedulerError({
			code: 'invalid-input',
			message: 'x',
			cause,
		});

		expect(scheduleGraph).toEqual(expect.any(Function));
		expect(error).toBeInstanceOf(Error);
		expect(Object.getPrototypeOf(error)).toBe(Error.prototype);
		expect(Object.isFrozen(error)).toBe(true);
		expect(error).toMatchObject({
			name: 'GraphSchedulerError',
			code: 'invalid-input',
			message: 'x',
			cause,
		});
		expect(Object.hasOwn(error, 'name')).toBe(true);
		expect(Object.hasOwn(error, 'code')).toBe(true);
	});

	it('installs a data-only non-enumerable graph type witness', () => {
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor: () => success('a') }],
		});
		const symbols = Object.getOwnPropertySymbols(graph);
		const descriptor = Object.getOwnPropertyDescriptor(graph, symbols[0]!);
		const witness = Reflect.get(graph, symbols[0]!);

		expect(symbols).toHaveLength(1);
		expect(descriptor).toMatchObject({
			configurable: false,
			enumerable: false,
			writable: false,
		});
		expect(Object.isFrozen(witness)).toBe(true);
		expect(witness).toEqual({
			inputs: { value: undefined },
			nodes: { value: undefined },
			edges: { value: undefined },
			effects: { value: undefined },
			outputs: { value: undefined },
			capabilities: { value: undefined },
		});
		expect(
			Object.values(witness as Record<string, unknown>).every((cell) =>
				Object.isFrozen(cell)
			)
		).toBe(true);
		expect(JSON.stringify(graph)).not.toContain('WPKernel compiled graph');
	});

	it('rejects every copied graph identity despite reflected type witness data', () => {
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor: () => success('a') }],
		});
		const reflected = Object.freeze(
			Object.defineProperties({}, Object.getOwnPropertyDescriptors(graph))
		);
		const literal = {
			kind: graph.kind,
			inputKeys: graph.inputKeys,
			nodes: graph.nodes,
			edges: graph.edges,
			incoming: graph.incoming,
			outgoing: graph.outgoing,
			ranks: graph.ranks,
			ordinals: graph.ordinals,
			outputs: graph.outputs,
			anchors: graph.anchors,
			policy: graph.policy,
		};
		const candidates = [
			literal,
			{ ...graph },
			deserialize(serialize(graph)),
			JSON.parse(JSON.stringify(graph)),
			new Proxy(graph, {}),
			reflected,
		];

		for (const candidate of candidates) {
			expect(rejectedGraph(candidate)).toMatchObject({
				name: 'GraphSchedulerError',
				code: 'invalid-graph',
				message: 'Compiled graph executor "a" is unavailable.',
			});
		}
	});

	it.each([
		['scalar', 42],
		['non-record object', new Date()],
		['incomplete success', { kind: 'success', output: 'x' }],
		['incomplete failure', { kind: 'failure' }],
		['unknown variant', { kind: 'mystery' }],
	])('classifies an invalid %s node result', (_label, returned) => {
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor: () => returned }],
		});

		expect(runTestGraph({ graph })).toMatchObject({
			kind: 'failed',
			primaryFailure: { node: 'a', kind: 'contract' },
		});
	});

	it('contains a hostile node-result inspection trap and retains its cause', () => {
		const original = new Error('own keys');
		const hostile = new Proxy(
			{},
			{
				ownKeys() {
					throw original;
				},
			}
		);
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor: () => hostile }],
		});
		const result = runTestGraph({ graph });

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: {
				kind: 'contract',
				error: { cause: original },
			},
		});
	});

	it.each([
		['non-array effects', {}],
		['non-record request', [42]],
		[
			'hostile request',
			[
				new Proxy(
					{},
					{
						ownKeys() {
							throw new Error('request');
						},
					}
				),
			],
		],
		[
			'invalid payload',
			[{ participant: 'write', payload: () => undefined }],
		],
	])('rejects %s', (_label, effects) => {
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'a',
					effectKeys: ['write'],
					executor: () => ({
						kind: 'success',
						output: 'a',
						effects,
					}),
				},
			],
		});

		expectContractFailure(runTestGraph({ graph }));
	});

	it('contains a hostile effect-array inspection trap', () => {
		const effects = new Proxy([], {
			ownKeys() {
				throw new Error('effects');
			},
		});
		const graph = compileTestGraph({
			nodes: [
				{
					key: 'a',
					executor: () => ({
						kind: 'success',
						output: 'a',
						effects,
					}),
				},
			],
		});

		expectContractFailure(runTestGraph({ graph }));
	});

	it('contains invalid and hostile pause records without admitting later work', () => {
		const invalid = compileTestGraph({
			nodes: [
				{
					key: 'a',
					executor: () => ({ ...success('a'), pause: 42 }),
				},
			],
		});
		const hostilePause = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('pause');
				},
			}
		);
		const hostile = compileTestGraph({
			nodes: [
				{
					key: 'a',
					executor: () => ({
						...success('a'),
						pause: hostilePause,
					}),
				},
			],
		});

		expectContractFailure(runTestGraph({ graph: invalid }));
		expectContractFailure(runTestGraph({ graph: hostile }));
	});

	it('admits a pause request without a reason', () => {
		const graph = compileTestGraph({
			nodes: [
				{
					key: 'a',
					executor: () => ({ ...success('a'), pause: {} }),
				},
			],
		});

		expect(runTestGraph({ graph })).toMatchObject({
			kind: 'suspended',
			primaryPause: { request: {} },
		});
	});

	it.each([
		['function', () => undefined],
		['null', null],
		['scalar', 42],
		['array', []],
		['missing key', {}],
		['wrong key', { other: 'x' }],
	])('rejects %s graph inputs', (_label, inputs) => {
		const graph = compileTestGraph({
			inputKeys: ['required'],
			nodes: [{ key: 'a', executor: () => success('a') }],
		});

		expect(() =>
			runTestGraph({
				graph,
				inputs: inputs as Readonly<Record<string, GraphValue>>,
			})
		).toThrow(
			expect.objectContaining({
				name: 'GraphSchedulerError',
				code: 'invalid-input',
			})
		);
	});

	it('marks a dependant blocked by its failed predecessor', () => {
		const graph = compileTestGraph({
			edges: [{ from: 'a', to: 'b' }],
			nodes: [
				{ key: 'a', executor: () => failure('no') },
				{ key: 'b', executor: () => success('never') },
			],
		});

		expect(runTestGraph({ graph })).toMatchObject({
			kind: 'failed',
			nodes: [
				{ node: 'a', kind: 'failed' },
				{
					node: 'b',
					kind: 'blocked',
					reason: 'dependency',
					blockedBy: ['a'],
				},
			],
		});
	});

	it('canonically orders multiple dependants unlocked together', () => {
		const calls: string[] = [];
		const graph = compileTestGraph({
			maxConcurrency: 1,
			edges: [
				{ from: 'source', to: 'b' },
				{ from: 'source', to: 'c' },
			],
			nodes: ['source', 'b', 'c'].map((key) => ({
				key,
				executor: () => {
					calls.push(key);
					return success(key);
				},
			})),
		});

		runTestGraph({ graph });

		expect(calls).toEqual(['source', 'b', 'c']);
	});

	it('does not finalise re-entrantly when abort fires during result inspection', async () => {
		const controller = new AbortController();
		const gate = controlled<ReturnType<typeof success<GraphValue>>>();
		const target = { value: 'owned' };
		const output = new Proxy(target, {
			ownKeys(value) {
				controller.abort('inspection');
				return Reflect.ownKeys(value);
			},
		});
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor: () => gate.promise }],
		});
		const result = runTestGraph({ graph, signal: controller.signal });

		gate.resolve(success(output));

		await expect(result).resolves.toMatchObject({
			kind: 'cancelled',
			reason: 'inspection',
			nodes: [{ node: 'a', kind: 'succeeded', output: target }],
		});
	});

	it('accepts cooperative cancellation without a reason after abort', () => {
		const controller = new AbortController();
		const graph = compileTestGraph({
			nodes: [
				{
					key: 'a',
					executor: () => {
						controller.abort();
						return { kind: 'cancelled' };
					},
				},
			],
		});

		expect(
			runTestGraph({ graph, signal: controller.signal })
		).toMatchObject({
			kind: 'cancelled',
			nodes: [{ node: 'a', kind: 'cancelled' }],
		});
	});

	it('rejects one internal async fault and ignores later admitted callbacks', async () => {
		const internal = new Error('invalid signal state');
		let abortedReads = 0;
		const signal = {
			get aborted() {
				abortedReads += 1;
				if (abortedReads > 2) {
					throw internal;
				}
				return false;
			},
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		} as unknown as AbortSignal;
		const first = controlled<ReturnType<typeof success<string>>>();
		const second = controlled<ReturnType<typeof success<string>>>();
		const graph = compileTestGraph({
			maxConcurrency: 2,
			nodes: [
				{ key: 'a', executor: () => first.promise },
				{ key: 'b', executor: () => second.promise },
			],
		});
		const result = runTestGraph({ graph, signal });

		first.resolve(success('a'));
		await expect(result).rejects.toBe(internal);
		second.resolve(success('b'));
		await flushMicrotasks();

		expect(signal.removeEventListener).toHaveBeenCalledTimes(1);
	});

	it('contains a synchronous evaluation fault as a thrown node failure', () => {
		const internal = new Error('evaluation signal');
		let abortedReads = 0;
		const signal = {
			get aborted() {
				abortedReads += 1;
				if (abortedReads === 2) {
					throw internal;
				}
				return false;
			},
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		} as unknown as AbortSignal;
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor: () => success('a') }],
		});

		const result = runTestGraph({ graph, signal });

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { node: 'a', kind: 'thrown', error: internal },
		});
		expect(signal.removeEventListener).toHaveBeenCalledTimes(1);
	});
});
