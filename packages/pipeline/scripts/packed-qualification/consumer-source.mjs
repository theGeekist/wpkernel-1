export const consumerSource = String.raw`
import {
	adoptMaybePromise,
	createPipeline,
	isPromiseLike,
	maybeAll,
	maybeThen,
	maybeTry,
	processSequentially,
	runPipeline as runNativePipeline,
	type AwaitedTuple,
	type Edge,
	type EffectContract,
	type EffectParticipants,
	type GraphDeclaration,
	type MaybePromise,
	type NodeContract,
	type NodeMiddlewareFor,
	type Suspension,
} from '@wpkernel/pipeline';
import {
	createHelper,
	createSerialPipeline,
	runPipeline as runSerialPipeline,
	type HelperRollback,
	type SerialNativeOutcome,
	type SerialRunOutcome,
} from '@wpkernel/pipeline/v1';

const fail = (message: string): never => {
	throw new Error(message);
};

type NativeInputs = Readonly<{ source: string }>;
type NativeNodes = Readonly<{
	uppercase: NodeContract<'source', string, never>;
}>;
type NativeOutputs = Readonly<{ result: 'uppercase' }>;
export type PackedMaybePromise = MaybePromise<string>;
export type PackedAwaitedTuple = AwaitedTuple<readonly [1, PromiseLike<'two'>]>;
export type PackedHelperRollback = HelperRollback;
export const helperRollback: HelperRollback = {
	key: 'consumer-cleanup',
	run: () => undefined,
};

const declaration: GraphDeclaration<
	NativeInputs,
	NativeNodes,
	readonly [],
	Readonly<Record<never, never>>,
	NativeOutputs,
	Readonly<Record<never, never>>
> = {
	inputKeys: ['source'],
	nodes: {
		uppercase: { externalInputs: ['source'], effectKeys: [], priority: 0 },
	},
	edges: [],
	effects: {},
	outputs: { result: 'uppercase' },
	policy: { maxConcurrency: 1 },
	executors: {
		uppercase: ({ input }) => ({
			kind: 'success',
			output: input.external.source.toUpperCase(),
			effects: [],
		}),
	},
};

export const native = createPipeline({ declaration, participants: {} });
export const nativeOutcome = runNativePipeline({
	pipeline: native,
	inputs: { source: 'native' },
	capabilities: {},
});
const assertNominalPublicTokens = (
	pipelineProjection: Pick<typeof native, 'kind'>,
	suspensionProjection: Pick<
		Suspension<
			NativeNodes,
			Readonly<{ result: string }>,
			Readonly<Record<never, never>>
		>,
		'pause' | 'snapshot'
	>
): void => {
	// @ts-expect-error documented data cannot forge Pipeline provenance.
	const forgedPipeline: typeof native = pipelineProjection;
	// @ts-expect-error documented data cannot forge Suspension authority.
	const forgedSuspension: Suspension<
		NativeNodes,
		Readonly<{ result: string }>,
		Readonly<Record<never, never>>
	> = suspensionProjection;
	void forgedPipeline;
	void forgedSuspension;
};
void assertNominalPublicTokens;
if (isPromiseLike(nativeOutcome)) {
	fail('Synchronous native graph became asynchronous.');
}
const nativeSettled = await nativeOutcome;
if (nativeSettled.kind !== 'succeeded' || nativeSettled.outputs.result !== 'NATIVE') {
	fail('Native root did not preserve synchronous graph evaluation.');
}

const adoptedDirect = adoptMaybePromise('direct');
if (adoptedDirect.promise !== null || adoptedDirect.value !== 'direct') {
	fail('Root adoption did not preserve a direct value.');
}
if (maybeThen(2, (value) => value * 3) !== 6) {
	fail('Root mapping promoted synchronous composition.');
}
if (maybeTry(() => 'ok', () => 'recovered') !== 'ok') {
	fail('Root recovery changed synchronous success.');
}
const allDirect = maybeAll([1, 2, 3]);
if (isPromiseLike(allDirect) || JSON.stringify(allDirect) !== '[1,2,3]') {
	fail('Root join promoted synchronous composition.');
}
const typedTuple: MaybePromise<[1, string]> = maybeAll([
	1,
	Promise.resolve('two'),
] as const);
if (JSON.stringify(await typedTuple) !== '[1,"two"]') {
	fail('Root join did not preserve packed tuple inference.');
}
const visited: number[] = [];
const traversal = processSequentially([1, 2], (value) => {
	visited.push(value);
});
if (isPromiseLike(traversal) || JSON.stringify(visited) !== '[1,2]') {
	fail('Root traversal promoted synchronous composition.');
}
const typedAsync: MaybePromise<number> = Promise.resolve(4);
if ((await maybeThen(typedAsync, (value) => value + 1)) !== 5) {
	fail('Root mapping did not adopt asynchronous composition.');
}
let mappingReads = 0;
let mappingInvocations = 0;
const mappedThenable = maybeThen(2, (value) =>
	Object.defineProperty({}, 'then', {
		get: () => {
			mappingReads += 1;
			return (resolve: (resolved: number) => void) => {
				mappingInvocations += 1;
				resolve(value * 4);
			};
		},
	}) as PromiseLike<number>
);
if (mappingReads !== 1 || mappingInvocations !== 0 || (await mappedThenable) !== 8) {
	fail('Root mapping did not preserve read-once queued adoption.');
}
let directThenReads = 0;
const directWithThen = Object.defineProperty({ value: 'direct' }, 'then', {
	get: () => {
		directThenReads += 1;
		if (directThenReads > 1) fail('then observed twice');
		return undefined;
	},
});
const mixed = await maybeAll([directWithThen, Promise.resolve('async')]);
if (mixed[0] !== directWithThen || directThenReads !== 1) {
	fail('Root join re-observed a synchronous sibling.');
}
const getterFailure = Object.defineProperty({}, 'then', {
	get: () => fail('getter failed'),
});
if (maybeTry(() => getterFailure, () => 'recovered') !== 'recovered') {
	fail('Root recovery did not contain a synchronous getter failure.');
}

type FanoutNodes = Readonly<{
	seed: NodeContract<'source', string, never>;
	left: NodeContract<never, string, never>;
	right: NodeContract<never, string, never>;
	third: NodeContract<never, string, never>;
	join: NodeContract<never, string, never>;
}>;
type FanoutEdges = readonly [
	Edge<'seed', 'left'>,
	Edge<'seed', 'right'>,
	Edge<'seed', 'third'>,
	Edge<'left', 'join'>,
	Edge<'right', 'join'>,
	Edge<'third', 'join'>,
];
type FanoutOutputs = Readonly<{ result: 'join' }>;
const pendingResolvers: Array<() => void> = [];
let activeNodes = 0;
let maximumActiveNodes = 0;
let resolveThirdAdmission: () => void = () => undefined;
const thirdAdmission = new Promise<void>((resolve) => {
	resolveThirdAdmission = resolve;
});
const asynchronousBranch = (label: string): Promise<{
	readonly kind: 'success';
	readonly output: string;
	readonly effects: readonly [];
}> =>
	new Promise((resolve) => {
		activeNodes += 1;
		maximumActiveNodes = Math.max(maximumActiveNodes, activeNodes);
		if (label === 'third') resolveThirdAdmission();
		pendingResolvers.push(() => {
			activeNodes -= 1;
			resolve({ kind: 'success', output: label, effects: [] });
		});
	});
const fanoutDeclaration: GraphDeclaration<
	NativeInputs,
	FanoutNodes,
	FanoutEdges,
	Readonly<Record<never, never>>,
	FanoutOutputs,
	Readonly<Record<never, never>>
> = {
	inputKeys: ['source'],
	nodes: {
		seed: { externalInputs: ['source'], effectKeys: [], priority: 0 },
		left: { externalInputs: [], effectKeys: [], priority: 0 },
		right: { externalInputs: [], effectKeys: [], priority: 0 },
		third: { externalInputs: [], effectKeys: [], priority: 0 },
		join: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [
		{ from: 'seed', to: 'left' },
		{ from: 'seed', to: 'right' },
		{ from: 'seed', to: 'third' },
		{ from: 'left', to: 'join' },
		{ from: 'right', to: 'join' },
		{ from: 'third', to: 'join' },
	],
	effects: {},
	outputs: { result: 'join' },
	policy: { maxConcurrency: 2 },
	executors: {
		seed: ({ input }) => ({ kind: 'success', output: input.external.source, effects: [] }),
		left: () => asynchronousBranch('left'),
		right: () => asynchronousBranch('right'),
		third: () => asynchronousBranch('third'),
		join: ({ input }) => ({
			kind: 'success',
			output: [
				input.dependencies.left,
				input.dependencies.right,
				input.dependencies.third,
			].join(','),
			effects: [],
		}),
	},
};
const fanoutPipeline = createPipeline({ declaration: fanoutDeclaration, participants: {} });
const fanoutOutcome = runNativePipeline({
	pipeline: fanoutPipeline,
	inputs: { source: 'seed' },
	capabilities: {},
});
if (!isPromiseLike(fanoutOutcome) || pendingResolvers.length !== 2 || maximumActiveNodes !== 2) {
	fail('Packed fan-out did not enforce the declared concurrent frontier.');
}
pendingResolvers.splice(0).forEach((resolve) => resolve());
await thirdAdmission;
if (pendingResolvers.length !== 1 || maximumActiveNodes !== 2) {
	fail('Packed scheduler exceeded bounded concurrency before fan-in.');
}
pendingResolvers.splice(0).forEach((resolve) => resolve());
const fanoutSettled = await fanoutOutcome;
if (fanoutSettled.kind !== 'succeeded' || fanoutSettled.outputs.result !== 'left,right,third') {
	fail('Packed fan-in did not receive every predecessor output.');
}

type EffectNodes = Readonly<{
	work: NodeContract<never, string, never, 'write'>;
}>;
type EffectRegistry = Readonly<{
	write: EffectContract<string, string, string, never>;
}>;
type EffectOutputs = Readonly<{ result: 'work' }>;
const effects: string[] = [];
const effectDeclaration: GraphDeclaration<
	Readonly<Record<never, never>>,
	EffectNodes,
	readonly [],
	EffectRegistry,
	EffectOutputs,
	Readonly<Record<never, never>>
> = {
	inputKeys: [],
	nodes: { work: { externalInputs: [], effectKeys: ['write'], priority: 0 } },
	edges: [],
	effects: { write: {} },
	outputs: { result: 'work' },
	policy: { maxConcurrency: 1 },
	executors: {
		work: () => ({
			kind: 'success',
			output: 'done',
			effects: [{ participant: 'write', payload: 'node' }],
		}),
	},
};
const effectMiddleware: NodeMiddlewareFor<
	Readonly<Record<never, never>>,
	EffectNodes,
	readonly [],
	EffectRegistry,
	Readonly<Record<never, never>>,
	'work',
	'entered'
> = {
	node: 'work',
	before: () => ({
		state: 'entered',
		effects: [{ participant: 'write', payload: 'before' }],
	}),
	after: ({ state }) => {
		if (state !== 'entered') fail('Packed middleware lost local state.');
		return [{ participant: 'write', payload: 'after' }];
	},
};
const effectParticipants: EffectParticipants<EffectRegistry> = {
	write: {
		prepare: ({ payload }) => {
			effects.push('prepare:' + payload);
			return { kind: 'success', value: payload };
		},
		commit: ({ prepared }) => {
			effects.push('commit:' + prepared);
			return { kind: 'success', value: 'receipt:' + prepared };
		},
		compensate: () => ({ kind: 'success', value: undefined }),
	},
};
const effectPipeline = createPipeline<
	Readonly<Record<never, never>>,
	EffectNodes,
	readonly [],
	EffectRegistry,
	EffectOutputs,
	Readonly<Record<never, never>>,
	typeof effectParticipants,
	readonly [],
	readonly [typeof effectMiddleware]
>({
	declaration: effectDeclaration,
	middleware: [effectMiddleware],
	participants: effectParticipants,
});
const effectOutcome = runNativePipeline({ pipeline: effectPipeline, inputs: {}, capabilities: {} });
if (isPromiseLike(effectOutcome)) {
	fail('Packed middleware/effect graph did not settle synchronously.');
}
const effectSettled = await effectOutcome;
if (effectSettled.kind !== 'succeeded') fail('Packed middleware/effect graph failed.');
if (effects.join(',') !== 'prepare:before,prepare:node,prepare:after,commit:before,commit:node,commit:after') {
	fail('Packed middleware/effect order was not retained.');
}

const cancellationController = new AbortController();
const cancellationPipeline = createPipeline({
	declaration: declaration,
	participants: {},
});
cancellationController.abort('packed cancellation');
const cancellation = runNativePipeline({
	pipeline: cancellationPipeline,
	inputs: { source: 'unused' },
	capabilities: {},
	signal: cancellationController.signal,
});
if (isPromiseLike(cancellation)) {
	fail('Packed cancellation did not stop new admission synchronously.');
}
const cancellationSettled = await cancellation;
if (cancellationSettled.kind !== 'cancelled' || cancellationSettled.reason !== 'packed cancellation') {
	fail('Packed cancellation did not preserve its reason.');
}

export const serial = createSerialPipeline({
	createBuildOptions: () => ({}),
	createContext: () => ({ reporter: {} }),
	createFragmentState: () => [] as string[],
	createFragmentArgs: ({ context, draft }) => ({ context, input: undefined, output: draft, reporter: context.reporter }),
	finalizeFragmentState: ({ draft }) => draft,
	createBuilderArgs: ({ context, artifact }) => ({ context, input: undefined, output: artifact, reporter: context.reporter }),
	createRunResult: ({ artifact }) => artifact,
	fragments: [
		createHelper({
			key: 'fragment',
			kind: 'fragment',
			apply: ({ output }) => void (output as string[]).push('serial'),
		}),
	],
	builders: [],
});
export const serialOutcome = runSerialPipeline({ pipeline: serial, options: {} });
if (isPromiseLike(serialOutcome)) {
	fail('Synchronous serial compatibility became asynchronous.');
}
export const typedSerialOutcome: SerialRunOutcome<unknown> = await serialOutcome;
export type InferredNativeOutcome = typeof nativeOutcome;
export type InferredSerialPipeline = typeof serial;
export type InferredSerialOutcome = typeof serialOutcome;
type ExpectNever<T extends never> = T;
export type SerialSuspensionIsImpossible = ExpectNever<Extract<SerialNativeOutcome, { readonly kind: 'suspended' }>>;
if (typedSerialOutcome.kind !== 'succeeded' || JSON.stringify(typedSerialOutcome.result) !== '["serial"]') {
	fail('Serial compatibility did not preserve helper output.');
}

const invalidDeclaration = {
	inputKeys: ['source'],
	nodes: declaration.nodes,
	edges: [{ from: 'missing', to: 'uppercase' }] as const,
	effects: {},
	outputs: { result: 'uppercase' },
	policy: { maxConcurrency: 1 },
	executors: declaration.executors,
};
// @ts-expect-error missing edge sources cannot compile as a public graph.
const invalidPipeline = createPipeline({ declaration: invalidDeclaration, participants: {} });
void invalidPipeline;

const root = await import('@wpkernel/pipeline');
const compatibility = await import('@wpkernel/pipeline/v1');
for (const rejected of ['compileGraph', 'createHelper', 'createSerialPipeline', 'makePipeline', 'makeResumablePipeline', 'scheduleGraph']) {
	if (rejected in root) fail('Native root leaked compatibility symbol: ' + rejected);
}
for (const rejected of ['createPipeline', 'createPipelineExtension', 'createPipelineRollback', 'makePipeline', 'makeResumablePipeline', 'maybeThen']) {
	if (rejected in compatibility) fail('Compatibility entry leaked rejected authority: ' + rejected);
}
`;
