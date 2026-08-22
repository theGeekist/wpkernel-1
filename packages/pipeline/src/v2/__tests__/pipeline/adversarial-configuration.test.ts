import type { GraphDeclaration, NodeContract } from '../../graph/types.js';
import { createPipeline, runPipeline } from '../../pipeline/index.js';

type Inputs = Readonly<Record<never, never>>;
type Nodes = Readonly<{ base: NodeContract<never, 'base'> }>;
type Edges = readonly [];
type Effects = Readonly<Record<never, never>>;
type Projection = Readonly<{ result: 'base' }>;
type Capabilities = Readonly<Record<never, never>>;

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
	policy: { maxConcurrency: 1 },
	executors: {
		base: () => ({ kind: 'success', output: 'base', effects: [] }),
	},
});

const run = (pipeline: unknown) =>
	runPipeline({
		pipeline: pipeline as ReturnType<typeof createValidPipeline>,
		inputs: {},
		capabilities: {},
	});

const createValidPipeline = () =>
	createPipeline({ declaration: declaration(), participants: {} });

const participant = {
	prepare: () => ({ kind: 'success' as const, value: undefined }),
	commit: () => ({ kind: 'success' as const, value: undefined }),
	compensate: () => ({ kind: 'success' as const, value: undefined }),
};

const roleFailure = (pipeline: unknown, role: string): void => {
	expect(run(pipeline)).toMatchObject({
		kind: 'configuration-failed',
		primaryFailure: { kind: 'role', role },
	});
};

describe('v2 Pipeline adversarial configuration ownership', () => {
	it('contains a non-GraphValue extension configuration before invocation', () => {
		const contribute = jest.fn(() => ({ executors: {} }));
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: { contribute },
					configuration: () => undefined,
				},
			] as never,
			participants: {},
		});

		expect(run(pipeline)).toMatchObject({
			kind: 'configuration-failed',
			primaryFailure: { kind: 'extension' },
		});
		expect(contribute).not.toHaveBeenCalled();
	});

	it('retains indexed capture failure while invoking later valid registrations', () => {
		const later = jest.fn(() => ({ executors: {} }));
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: { contribute: () => ({ executors: {} }) },
					configuration: () => undefined,
				},
				{
					extension: { contribute: later },
					configuration: null,
				},
			] as never,
			participants: {},
		});

		expect(run(pipeline)).toMatchObject({
			kind: 'configuration-failed',
			extensionFailures: [{ registrationOrder: 1 }],
		});
		expect(later).toHaveBeenCalledTimes(1);
	});

	it.each([
		['non-array', 42],
		['sparse array', new Array(1)],
		[
			'hostile array',
			new Proxy([], {
				getPrototypeOf() {
					throw new Error('prototype');
				},
			}),
		],
	])('contains an invalid extension tuple: %s', (_label, extensions) => {
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: extensions as never,
			participants: {},
		});

		expect(run(pipeline)).toMatchObject({
			kind: 'configuration-failed',
			primaryFailure: { kind: 'extension' },
			extensionFailures: [{ registrationOrder: 1 }],
		});
	});

	it('contains hostile contributed executor ownership', () => {
		const executors = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('executor keys');
				},
			}
		);
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: { contribute: () => ({ executors }) },
					configuration: null,
				},
			] as never,
			participants: {},
		});

		expect(run(pipeline)).toMatchObject({
			kind: 'configuration-failed',
			primaryFailure: { kind: 'graph' },
			graphDiagnostics: [{ code: 'invalid-contribution' }],
		});
	});

	it.each([
		['non-record', 42, 'invalid-contribution'],
		[
			'nested contribution',
			{ contributions: [], executors: {} },
			'reentrant-contribution',
		],
	])(
		'diagnoses a %s contribution after ownership',
		(_label, contributed, code) => {
			const pipeline = createPipeline({
				declaration: declaration(),
				extensions: [
					{
						extension: { contribute: () => contributed },
						configuration: null,
					},
				] as never,
				participants: {},
			});

			expect(run(pipeline)).toMatchObject({
				kind: 'configuration-failed',
				primaryFailure: { kind: 'graph' },
				graphDiagnostics: [{ code }],
			});
		}
	);

	it('contains hostile base executor ownership', () => {
		const executors = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('executor keys');
				},
			}
		);
		const pipeline = createPipeline({
			declaration: { ...declaration(), executors } as never,
			participants: {},
		});

		expect(run(pipeline)).toMatchObject({
			kind: 'configuration-failed',
			primaryFailure: { kind: 'graph' },
		});
	});

	it('does not grant authority to an unownable optional graph field', () => {
		const pipeline = createPipeline({
			declaration: declaration(),
			extensions: [
				{
					extension: {
						contribute: () => ({
							nodes: () => undefined,
							executors: {},
						}),
					},
					configuration: null,
				},
			] as never,
			participants: {},
		});

		expect(run(pipeline)).toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'base' },
		});
	});

	it('contains a hostile creation object', () => {
		const options = new Proxy(
			{},
			{
				getPrototypeOf() {
					throw new Error('options prototype');
				},
			}
		);
		const pipeline = createPipeline(options as never);

		expect(run(pipeline)).toMatchObject({ kind: 'configuration-failed' });
	});

	it.each([
		['middleware', { middleware: 42 }],
		['middleware', { middleware: new Array(1) }],
		['middleware', { middleware: [42] }],
		['middleware', { middleware: [{ node: 42 }] }],
		['middleware', { middleware: [{ node: 'base', before: 42 }] }],
		['observer', { observers: 42 }],
		['observer', { observers: [42, () => undefined] }],
		['participant', { participants: 42 }],
		['participant', { participants: { write: 42 } }],
		[
			'participant',
			{
				participants: {
					write: { prepare: participant.prepare },
				},
			},
		],
	] as const)('contains an invalid %s role', (role, overrides) => {
		const pipeline = createPipeline({
			declaration: declaration(),
			participants: {},
			...overrides,
		} as never);

		roleFailure(pipeline, role);
	});

	it.each([
		[
			'middleware',
			{
				middleware: new Proxy([], {
					getPrototypeOf() {
						throw new Error('middleware prototype');
					},
				}),
			},
		],
		[
			'observer',
			{
				observers: new Proxy([], {
					getPrototypeOf() {
						throw new Error('observer prototype');
					},
				}),
			},
		],
		[
			'participant',
			{
				participants: new Proxy(
					{},
					{
						ownKeys() {
							throw new Error('participant keys');
						},
					}
				),
			},
		],
	] as const)('contains a hostile %s role', (role, overrides) => {
		const pipeline = createPipeline({
			declaration: declaration(),
			participants: {},
			...overrides,
		} as never);

		roleFailure(pipeline, role);
	});

	it('maps graph-dependent middleware admission to configuration failure', () => {
		const pipeline = createPipeline({
			declaration: declaration(),
			middleware: [{ node: 'missing' }] as never,
			participants: {},
		});

		roleFailure(pipeline, 'middleware');
	});

	it('maps exact participant admission to configuration failure', () => {
		const pipeline = createPipeline({
			declaration: declaration(),
			participants: { extra: participant } as never,
		});

		roleFailure(pipeline, 'participant');
	});

	it('reports run-input admission algebraically, not as configuration', () => {
		const pipeline = createValidPipeline();

		expect(
			runPipeline({
				pipeline,
				inputs: { extra: true } as never,
				capabilities: {},
			})
		).toMatchObject({
			kind: 'admission-failed',
			field: 'inputs',
			error: { code: 'invalid-input' },
		});
	});

	it('forwards an explicit run signal through every Pipeline boundary', () => {
		const pipeline = createValidPipeline();
		const controller = new AbortController();
		controller.abort('stop');

		expect(
			runPipeline({
				pipeline,
				inputs: {},
				capabilities: {},
				signal: controller.signal,
			})
		).toMatchObject({ kind: 'cancelled', reason: 'stop' });
	});

	it('selects the first graph diagnostic when no extension fails', () => {
		const pipeline = createPipeline({
			declaration: {
				...declaration(),
				edges: [{ from: 'missing', to: 'base' }],
			} as never,
			observers: [42] as never,
			participants: {},
		});

		expect(run(pipeline)).toMatchObject({
			kind: 'configuration-failed',
			primaryFailure: {
				kind: 'graph',
				diagnostic: { code: 'missing-node' },
			},
			roleFailures: [{ kind: 'role', role: 'observer' }],
		});
	});
});
