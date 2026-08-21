import type {
	GraphContribution,
	GraphDeclaration,
	NodeContract,
} from '../../graph/types.js';
import { createPipeline, runPipeline } from '../../pipeline/index.js';
import {
	controlled,
	flushMicrotasks,
} from '../../scheduler/scheduler.test-support.js';

type Inputs = Readonly<Record<never, never>>;
type Nodes = Readonly<{ base: NodeContract<never, string> }>;
type Edges = readonly [];
type Effects = Readonly<Record<never, never>>;
type Projection = Readonly<{ result: 'base' }>;
type Capabilities = Readonly<{ token: string }>;

const declaration = (): GraphDeclaration<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Projection,
	Capabilities
> => ({
	inputKeys: [],
	nodes: {
		base: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [],
	effects: {},
	outputs: { result: 'base' },
	anchors: { authoring: 'base' },
	policy: { maxConcurrency: 1 },
	executors: {
		base: ({ capabilities }) => ({
			kind: 'success',
			output: capabilities.token,
			effects: [],
		}),
	},
});

const createBasePipeline = () =>
	createPipeline({
		declaration: declaration(),
		participants: {},
	});

const run = (pipeline: unknown) =>
	runPipeline({
		pipeline: pipeline as ReturnType<typeof createBasePipeline>,
		inputs: {},
		capabilities: { token: 'base' },
	});

const contribution = (key: string): GraphContribution => ({
	nodes: {
		[key]: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [{ from: 'base', to: key }],
	outputs: { result: key },
	anchors: { authoring: key },
	executors: {
		[key]: () => ({ kind: 'success', output: key, effects: [] }),
	},
});

describe('v2 Pipeline configuration and evaluation', () => {
	it('invokes each captured extension once at creation time', () => {
		const contribute = jest.fn(() => ({ executors: {} }));
		const registrations = [
			{
				extension: { contribute },
				configuration: null,
			},
		];
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: registrations as never,
			participants: {},
		});
		registrations.push({
			extension: { contribute },
			configuration: null,
		});

		expect(contribute).toHaveBeenCalledTimes(1);
		expect(run(pipeline)).toMatchObject({ kind: 'succeeded' });
		expect(run(pipeline)).toMatchObject({ kind: 'succeeded' });
		expect(contribute).toHaveBeenCalledTimes(1);
	});

	it('runs an extension-free evaluator synchronously through one front door', () => {
		const pipeline = createBasePipeline();
		const result = run(pipeline);

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'base' },
		});
		expect(pipeline).not.toHaveProperty('run');
		expect(pipeline).not.toHaveProperty('use');
		expect(pipeline).not.toHaveProperty('compile');
	});

	it('applies owned synchronous contributions in registration order', () => {
		const calls: string[] = [];
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: {
						contribute: () => {
							calls.push('first');
							return contribution('first');
						},
					},
					configuration: null,
				},
				{
					extension: {
						contribute: () => {
							calls.push('second');
							return {
								...contribution('second'),
								edges: [{ from: 'first', to: 'second' }],
							};
						},
					},
					configuration: null,
				},
			] as never,
			participants: {},
		});

		const result = runPipeline({
			pipeline,
			inputs: {},
			capabilities: { token: 'base' },
		});

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'second' },
		});
		expect(calls).toEqual(['first', 'second']);
	});

	it('drains every extension failure and retains graph diagnostics too', async () => {
		const first = controlled<GraphContribution>();
		const second = controlled<GraphContribution>();
		const firstError = new Error('first');
		const secondError = new Error('second');
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: { contribute: () => first.promise },
					configuration: null,
				},
				{
					extension: { contribute: () => second.promise },
					configuration: null,
				},
			] as never,
			participants: {},
		});
		const result = runPipeline({
			pipeline,
			inputs: {},
			capabilities: { token: 'base' },
		});
		let settled = false;
		void Promise.resolve(result).then(() => {
			settled = true;
		});

		second.reject(secondError);
		await flushMicrotasks();
		expect(settled).toBe(false);
		first.reject(firstError);

		await expect(result).resolves.toMatchObject({
			kind: 'configuration-failed',
			primaryFailure: {
				kind: 'extension',
				failure: { registrationOrder: 1, error: firstError },
			},
			extensionFailures: [
				{ registrationOrder: 1, error: firstError },
				{ registrationOrder: 2, error: secondError },
			],
		});
	});

	it('compiles successful contributions even beside an extension failure', () => {
		const extensionError = new Error('extension');
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: {
						contribute: () => {
							throw extensionError;
						},
					},
					configuration: null,
				},
				{
					extension: {
						contribute: () => ({
							nodes: {
								broken: {
									externalInputs: [],
									effectKeys: [],
									priority: 0,
								},
							},
							executors: {},
						}),
					},
					configuration: null,
				},
			] as never,
			participants: {},
		});

		const result = runPipeline({
			pipeline,
			inputs: {},
			capabilities: { token: 'base' },
		});

		expect(result).toMatchObject({
			kind: 'configuration-failed',
			primaryFailure: { kind: 'extension' },
			extensionFailures: [{ error: extensionError }],
			graphDiagnostics: [
				{ code: 'invalid-contribution' },
				{ code: 'invalid-node' },
			],
		});
	});

	it('owns GraphValue configuration before asynchronous contribution work', async () => {
		const gate = controlled<void>();
		const configuration = { value: ['before'] };
		let ownedConfiguration: Readonly<{
			readonly value: readonly string[];
		}> | null = null;
		let ownedValue: readonly string[] | undefined;
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: {
						async contribute({
							configuration: owned,
						}: {
							readonly configuration: Readonly<{
								readonly value: readonly string[];
							}>;
						}) {
							ownedConfiguration = owned;
							ownedValue = owned.value;
							await gate.promise;
							return contribution(owned.value[0]!);
						},
					},
					configuration,
				},
			] as never,
			participants: {},
		});
		expect(Object.isFrozen(ownedConfiguration)).toBe(true);
		expect(Object.isFrozen(ownedValue)).toBe(true);
		configuration.value[0] = 'after';
		const pending = runPipeline({
			pipeline,
			inputs: {},
			capabilities: { token: 'base' },
		});

		gate.resolve();
		await expect(pending).resolves.toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'before' },
		});
	});

	it('captures every callback identity before an earlier extension can mutate it', () => {
		const original = jest.fn(() => ({ executors: {} }));
		const replacement = jest.fn(() => ({ executors: {} }));
		const later = { contribute: original };
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: {
						contribute: () => {
							later.contribute = replacement;
							return { executors: {} };
						},
					},
					configuration: null,
				},
				{ extension: later, configuration: null },
			] as never,
			participants: {},
		});

		expect(run(pipeline)).toMatchObject({ kind: 'succeeded' });
		expect(original).toHaveBeenCalledTimes(1);
		expect(replacement).not.toHaveBeenCalled();
	});

	it('owns every later configuration before invoking an earlier extension', () => {
		const laterConfiguration = { labels: ['before'] };
		const observed: string[] = [];
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: {
						contribute: () => {
							laterConfiguration.labels[0] = 'after';
							return { executors: {} };
						},
					},
					configuration: null,
				},
				{
					extension: {
						contribute: ({
							configuration,
						}: {
							readonly configuration: Readonly<{
								readonly labels: readonly string[];
							}>;
						}) => {
							observed.push(configuration.labels[0]!);
							return { executors: {} };
						},
					},
					configuration: laterConfiguration,
				},
			] as never,
			participants: {},
		});

		expect(run(pipeline)).toMatchObject({ kind: 'succeeded' });
		expect(observed).toEqual(['before']);
	});

	it('owns middleware and observer registrations at creation time', () => {
		const before = jest.fn(() => ({ state: undefined, effects: [] }));
		const replacementBefore = jest.fn(() => ({
			state: undefined,
			effects: [],
		}));
		const observer = jest.fn();
		const replacementObserver = jest.fn();
		const middleware = [{ node: 'base', before }];
		const observers = [observer];
		const pipeline = createPipeline({
			declaration: declaration(),
			middleware: middleware as never,
			observers,
			participants: {},
		});
		middleware[0]!.before = replacementBefore;
		observers[0] = replacementObserver;

		expect(run(pipeline)).toMatchObject({ kind: 'succeeded' });
		expect(before).toHaveBeenCalledTimes(1);
		expect(replacementBefore).not.toHaveBeenCalled();
		expect(observer).toHaveBeenCalled();
		expect(replacementObserver).not.toHaveBeenCalled();
	});

	it('supports concurrent runs and becomes synchronous after quiescence', async () => {
		const gate = controlled<GraphContribution>();
		let executions = 0;
		const pipeline = createPipeline({
			declaration: {
				...declaration(),
				executors: {
					base: () => {
						executions += 1;
						return { kind: 'success', output: 'base', effects: [] };
					},
				},
			},
			extensions: [
				{
					extension: { contribute: () => gate.promise },
					configuration: null,
				},
			] as never,
			participants: {},
		});
		const options = {
			pipeline,
			inputs: {},
			capabilities: { token: 'base' },
		} as const;
		const first = runPipeline(options);
		const second = runPipeline(options);

		gate.resolve({ executors: {} });
		await Promise.all([first, second]);
		expect(executions).toBe(2);

		const quiescent = runPipeline(options);
		expect(quiescent).not.toBeInstanceOf(Promise);
		expect(quiescent).toMatchObject({ kind: 'succeeded' });
		expect(executions).toBe(3);
	});

	it('returns role admission failures algebraically before node work', () => {
		const execute = jest.fn(() => ({
			kind: 'success' as const,
			output: 'base',
			effects: [],
		}));
		const pipeline = createPipeline({
			declaration: { ...declaration(), executors: { base: execute } },
			participants: { extra: {} } as never,
		});

		const result = runPipeline({
			pipeline,
			inputs: {},
			capabilities: { token: 'base' },
		});

		expect(result).toMatchObject({
			kind: 'configuration-failed',
			primaryFailure: { kind: 'role', role: 'participant' },
		});
		expect(execute).not.toHaveBeenCalled();
	});

	it.each([
		['non-record extension', 42],
		['missing callback', {}],
		['non-callable callback', { contribute: 42 }],
		[
			'throwing then getter',
			{
				contribute: () =>
					Object.defineProperty({}, 'then', {
						get: () => {
							throw new Error('then getter');
						},
					}),
			},
		],
	])('contains an invalid %s algebraically', (_label, extension) => {
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [{ extension, configuration: null }] as never,
			participants: {},
		});

		expect(run(pipeline)).toMatchObject({
			kind: 'configuration-failed',
			primaryFailure: { kind: 'extension' },
			extensionFailures: [{ registrationOrder: 1 }],
		});
	});

	it('contains a malformed creation object as configuration failure', () => {
		const pipeline = createPipeline(null as never);

		expect(
			runPipeline({ pipeline, inputs: {} as never, capabilities: {} })
		).toMatchObject({ kind: 'configuration-failed' });
	});
});
