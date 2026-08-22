export const runtimeSource = String.raw`
import {
	createPipeline,
	isPromiseLike,
	maybeAll,
	maybeThen,
	runPipeline,
} from '@wpkernel/pipeline';
import {
	createHelper,
	createSerialPipeline,
	runPipeline as runSerialPipeline,
} from '@wpkernel/pipeline/v1';

const fail = (message) => {
	throw new Error(message);
};
const synchronous = createPipeline({
	declaration: {
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
	},
	participants: {},
});
const synchronousOutcome = runPipeline({
	pipeline: synchronous,
	inputs: { source: 'packed' },
	capabilities: {},
});
if (isPromiseLike(synchronousOutcome)) fail('Sync graph promoted to a promise.');
if ((await synchronousOutcome).outputs.result !== 'PACKED') fail('Sync graph output changed.');
if (maybeThen(2, (value) => value * 3) !== 6) fail('MaybePromise mapping became asynchronous.');
if (JSON.stringify(await maybeAll([1, Promise.resolve(2)])) !== '[1,2]') fail('MaybePromise join changed.');
let thenReads = 0;
let thenCalls = 0;
const adopted = maybeThen(2, (value) =>
	Object.defineProperty({}, 'then', {
		get: () => {
			thenReads += 1;
			return (resolve) => {
				thenCalls += 1;
				resolve(value * 4);
			};
		},
	})
);
if (thenReads !== 1 || thenCalls !== 0 || (await adopted) !== 8) {
	fail('MaybePromise adoption did not retain read-once queued semantics.');
}

const pending = [];
let active = 0;
let maximum = 0;
let resolveThirdAdmission = () => undefined;
const thirdAdmission = new Promise((resolve) => {
	resolveThirdAdmission = resolve;
});
const branch = (name) =>
	new Promise((resolve) => {
		active += 1;
		maximum = Math.max(maximum, active);
		if (name === 'third') resolveThirdAdmission();
		pending.push(() => {
			active -= 1;
			resolve({ kind: 'success', output: name, effects: [] });
		});
	});
const concurrent = createPipeline({
	declaration: {
		inputKeys: [],
		nodes: {
			seed: { externalInputs: [], effectKeys: [], priority: 0 },
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
			seed: () => ({ kind: 'success', output: 'seed', effects: [] }),
			left: () => branch('left'),
			right: () => branch('right'),
			third: () => branch('third'),
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
	},
	participants: {},
});
const concurrentOutcome = runPipeline({ pipeline: concurrent, inputs: {}, capabilities: {} });
if (!isPromiseLike(concurrentOutcome) || pending.length !== 2 || maximum !== 2) {
	fail('Bounded fan-out did not admit exactly two branches.');
}
pending.splice(0).forEach((resolve) => resolve());
await thirdAdmission;
if (pending.length !== 1 || maximum !== 2) fail('Concurrency cap was exceeded.');
pending.splice(0).forEach((resolve) => resolve());
const concurrentSettled = await concurrentOutcome;
if (concurrentSettled.outputs.result !== 'left,right,third') fail('Fan-in lost predecessor output.');

const calls = [];
const effects = createPipeline({
	declaration: {
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
	},
	middleware: [
		{
			node: 'work',
			before: () => ({ state: 'entered', effects: [{ participant: 'write', payload: 'before' }] }),
			after: ({ state }) => {
				if (state !== 'entered') fail('Middleware state changed.');
				return [{ participant: 'write', payload: 'after' }];
			},
		},
	],
	participants: {
		write: {
			prepare: ({ payload }) => {
				calls.push('prepare:' + payload);
				return { kind: 'success', value: payload };
			},
			commit: ({ prepared }) => {
				calls.push('commit:' + prepared);
				return { kind: 'success', value: prepared };
			},
			compensate: () => ({ kind: 'success', value: undefined }),
		},
	},
});
const effectsOutcome = runPipeline({ pipeline: effects, inputs: {}, capabilities: {} });
if (isPromiseLike(effectsOutcome)) fail('Effects graph became asynchronous.');
if ((await effectsOutcome).kind !== 'succeeded') fail('Effects graph did not succeed.');
if (calls.join(',') !== 'prepare:before,prepare:node,prepare:after,commit:before,commit:node,commit:after') {
	fail('Middleware/effect chronology changed.');
}

const controller = new AbortController();
controller.abort('packed cancellation');
const cancellation = runPipeline({
	pipeline: synchronous,
	inputs: { source: 'unused' },
	capabilities: {},
	signal: controller.signal,
});
if (isPromiseLike(cancellation)) fail('Cancellation became asynchronous.');
const cancelled = await cancellation;
if (cancelled.kind !== 'cancelled' || cancelled.reason !== 'packed cancellation') {
	fail('Cancellation did not retain its reason.');
}

const serial = createSerialPipeline({
	createBuildOptions: () => ({}),
	createContext: () => ({ reporter: {} }),
	createFragmentState: () => [],
	createFragmentArgs: ({ context, draft }) => ({ context, input: undefined, output: draft, reporter: context.reporter }),
	finalizeFragmentState: ({ draft }) => draft,
	createBuilderArgs: ({ context, artifact }) => ({ context, input: undefined, output: artifact, reporter: context.reporter }),
	createRunResult: ({ artifact }) => artifact,
	fragments: [createHelper({ key: 'fragment', kind: 'fragment', apply: ({ output }) => output.push('serial') })],
	builders: [],
});
const serialOutcome = runSerialPipeline({ pipeline: serial, options: {} });
if (isPromiseLike(serialOutcome)) fail('Serial compatibility became asynchronous.');
if (JSON.stringify((await serialOutcome).result) !== '["serial"]') fail('Serial migration output changed.');

const root = await import('@wpkernel/pipeline');
const compatibility = await import('@wpkernel/pipeline/v1');
for (const rejected of ['compileGraph', 'createHelper', 'createSerialPipeline', 'scheduleGraph']) {
	if (rejected in root) fail('Native root leaked serial compatibility authoring.');
}
for (const rejected of ['createPipeline', 'maybeThen']) {
	if (rejected in compatibility) fail('Serial compatibility leaked native authority.');
}
`;
