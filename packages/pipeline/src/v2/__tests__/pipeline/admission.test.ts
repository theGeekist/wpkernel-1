import type {
	GraphContribution,
	GraphDeclaration,
	NodeContract,
} from '../../graph/types.js';
import { createPipeline, runPipeline } from '../../pipeline/index.js';
import { controlled } from '../../scheduler/scheduler.test-support.js';

type Inputs = Readonly<{ payload: Readonly<{ value: string }> }>;
type Nodes = Readonly<{ node: NodeContract<'payload', string> }>;
type Edges = readonly [];
type Effects = Readonly<Record<never, never>>;
type Projection = Readonly<{ result: 'node' }>;
type Capabilities = Readonly<Record<never, never>>;

const declaration = (): GraphDeclaration<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Projection,
	Capabilities
> => ({
	inputKeys: ['payload'],
	nodes: {
		node: { externalInputs: ['payload'], effectKeys: [], priority: 0 },
	},
	edges: [],
	effects: {},
	outputs: { result: 'node' },
	policy: { maxConcurrency: 1 },
	executors: {
		node: ({ input }) => ({
			kind: 'success',
			output: input.external.payload.value,
			effects: [],
		}),
	},
});

const createValidPipeline = () =>
	createPipeline({ declaration: declaration(), participants: {} });

describe('v2 Pipeline run admission', () => {
	it('owns the complete input record before pending generation settles', async () => {
		const gate = controlled<GraphContribution>();
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: { contribute: () => gate.promise },
					configuration: null,
				},
			] as never,
			participants: {},
		});
		const inputs = { payload: { value: 'before' } };

		const result = runPipeline({ pipeline, inputs, capabilities: {} });
		inputs.payload.value = 'after';
		gate.resolve({ executors: {} });

		await expect(result).resolves.toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'before' },
		});
	});

	it('reads input and signal option accessors exactly once', () => {
		const pipeline = createValidPipeline();
		const signal = new AbortController().signal;
		let inputReads = 0;
		let signalReads = 0;
		const options = {
			pipeline,
			get inputs() {
				inputReads += 1;
				return { payload: { value: 'owned' } };
			},
			capabilities: {},
			get signal() {
				signalReads += 1;
				return signal;
			},
		};

		expect(runPipeline(options)).toMatchObject({ kind: 'succeeded' });
		expect(inputReads).toBe(1);
		expect(signalReads).toBe(1);
	});

	it('retains the first signal value instead of rereading a live second value', () => {
		const pipeline = createValidPipeline();
		const aborted = new AbortController();
		aborted.abort('first');
		const live = new AbortController();
		let reads = 0;
		const options = {
			pipeline,
			inputs: { payload: { value: 'owned' } },
			capabilities: {},
			get signal() {
				reads += 1;
				return reads === 1 ? aborted.signal : live.signal;
			},
		};

		expect(runPipeline(options)).toMatchObject({
			kind: 'cancelled',
			reason: 'first',
		});
		expect(reads).toBe(1);
	});

	it.each([
		['pipeline', 'invalid-graph'],
		['inputs', 'invalid-input'],
		['capabilities', 'invalid-input'],
		['signal', 'invalid-input'],
	] as const)(
		'contains a throwing %s option accessor algebraically',
		(field, code) => {
			const pipeline = createValidPipeline();
			let reads = 0;
			const options = {
				pipeline,
				inputs: { payload: { value: 'owned' } },
				capabilities: {},
				signal: new AbortController().signal,
			};
			Object.defineProperty(options, field, {
				enumerable: true,
				get() {
					reads += 1;
					throw new Error(field);
				},
			});

			expect(runPipeline(options as never)).toMatchObject({
				kind: 'admission-failed',
				field,
				error: { code },
			});
			expect(reads).toBe(1);
		}
	);

	it.each([
		['non-record', null],
		['non-plain record', Object.create({})],
		[
			'hostile record',
			new Proxy(
				{},
				{
					getPrototypeOf() {
						throw new Error('prototype');
					},
				}
			),
		],
	] as const)('contains %s run options algebraically', (_label, options) => {
		const invoke = runPipeline as unknown as (value: unknown) => unknown;

		expect(invoke(options)).toMatchObject({
			kind: 'admission-failed',
			field: 'options',
			error: { code: 'invalid-input' },
		});
	});

	it('contains an input outside the graph-value algebra immediately', () => {
		expect(
			runPipeline({
				pipeline: createValidPipeline(),
				inputs: 42 as never,
				capabilities: {},
			})
		).toMatchObject({
			kind: 'admission-failed',
			field: 'inputs',
			error: { code: 'invalid-input' },
		});
	});

	it('contains a non-AbortSignal value algebraically', () => {
		expect(
			runPipeline({
				pipeline: createValidPipeline(),
				inputs: { payload: { value: 'owned' } },
				capabilities: {},
				signal: {} as AbortSignal,
			})
		).toMatchObject({
			kind: 'admission-failed',
			field: 'signal',
			error: { code: 'invalid-input' },
		});
	});

	it('contains an environment without AbortSignal brand access', () => {
		const descriptor = Object.getOwnPropertyDescriptor(
			AbortSignal.prototype,
			'aborted'
		)!;
		try {
			Object.defineProperty(AbortSignal.prototype, 'aborted', {
				configurable: true,
				value: undefined,
			});
			expect(
				runPipeline({
					pipeline: createValidPipeline(),
					inputs: { payload: { value: 'owned' } },
					capabilities: {},
					signal: new AbortController().signal,
				})
			).toMatchObject({
				kind: 'admission-failed',
				field: 'signal',
			});
		} finally {
			Object.defineProperty(AbortSignal.prototype, 'aborted', descriptor);
		}
	});

	it.each([
		['ordinary error', new Error('aborted getter')],
		[
			'tagged scheduler error',
			Object.assign(new Error('invalid graph'), {
				name: 'GraphSchedulerError',
				code: 'invalid-graph',
			}),
		],
	] as const)(
		'rethrows an unexpected %s from scheduling',
		(_label, error) => {
			const signal = new AbortController().signal;
			Object.defineProperty(signal, 'aborted', {
				get() {
					throw error;
				},
			});

			expect(() =>
				runPipeline({
					pipeline: createValidPipeline(),
					inputs: { payload: { value: 'owned' } },
					capabilities: {},
					signal,
				})
			).toThrow(error);
		}
	);

	it('returns exact-key admission failure synchronously for sync generation', () => {
		const result = runPipeline({
			pipeline: createValidPipeline(),
			inputs: { payload: { value: 'owned' }, extra: true } as never,
			capabilities: {},
		});

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'admission-failed',
			field: 'inputs',
		});
	});

	it('resolves exact-key admission failure after genuine generation promotion', async () => {
		const gate = controlled<GraphContribution>();
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: { contribute: () => gate.promise },
					configuration: null,
				},
			] as never,
			participants: {},
		});
		const result = runPipeline({
			pipeline,
			inputs: { payload: { value: 'owned' }, extra: true } as never,
			capabilities: {},
		});

		expect(result).toBeInstanceOf(Promise);
		gate.resolve({ executors: {} });
		await expect(result).resolves.toMatchObject({
			kind: 'admission-failed',
			field: 'inputs',
			error: { code: 'invalid-input' },
		});
	});
});
