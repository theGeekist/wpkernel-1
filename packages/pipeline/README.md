# @wpkernel/pipeline

`@wpkernel/pipeline` v2 evaluates one immutable dataflow graph for each
process-local run. A `Pipeline` token admits the run; the compiled graph owns
readiness and execution. Nodes receive declared external inputs and direct
predecessor outputs, then return their own values. They do not share a draft,
thread a current output, or call the rest of the graph.

## Version boundary

The package root is the native v2 dataflow contract. Existing helper,
fragment-builder, `next` and lifecycle consumers can use
`@wpkernel/pipeline/v1`, an explicitly serial compatibility boundary for the
1.x standard runtime.

That subpath preserves selected serial semantics through a new immutable
adapter API. It is not source-compatible with v1. Mutable `createPipeline`,
registration through `.use()` and instance `.run()` become a static
`createSerialPipeline({ fragments, builders, extensions })` programme plus the
top-level `runPipeline({ pipeline, options })` function.

The captured programme runs through one native v2 node with one aggregate
native effect participant. It does not turn helpers into immutable nodes, make
stages concurrent, or make `next` anything other than node-local serial
composition. Pause/resume and independent rollback authority are intentionally
unsupported there. New code should model its dataflow at the package root
rather than use `/v1` to hide a new serial programme.

## A small graph

```ts
import {
	createPipeline,
	runPipeline,
	type GraphDeclaration,
	type NodeContract,
} from '@wpkernel/pipeline';

type Inputs = { readonly name: string };
type Nodes = {
	readonly greeting: NodeContract<'name', string>;
	readonly punctuation: NodeContract<never, string>;
	readonly message: NodeContract<never, string>;
};

const declaration = {
	inputKeys: ['name'],
	nodes: {
		greeting: { externalInputs: ['name'], effectKeys: [], priority: 0 },
		punctuation: { externalInputs: [], effectKeys: [], priority: 0 },
		message: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [
		{ from: 'greeting', to: 'message' },
		{ from: 'punctuation', to: 'message' },
	] as const,
	effects: {},
	outputs: { message: 'message' },
	policy: { maxConcurrency: 'unbounded' },
	executors: {
		greeting: ({ input }) => ({
			kind: 'success',
			output: `Hello, ${input.external.name}`,
			effects: [],
		}),
		punctuation: () => ({ kind: 'success', output: '!', effects: [] }),
		message: ({ input }) => ({
			kind: 'success',
			output: `${input.dependencies.greeting}${input.dependencies.punctuation}`,
			effects: [],
		}),
	},
} satisfies GraphDeclaration<
	Inputs,
	Nodes,
	readonly [
		{ readonly from: 'greeting'; readonly to: 'message' },
		{ readonly from: 'punctuation'; readonly to: 'message' },
	],
	{},
	{ readonly message: 'message' },
	{}
>;

const pipeline = createPipeline({ declaration, participants: {} });
const outcome = runPipeline({
	pipeline,
	inputs: { name: 'Ada' },
	capabilities: {},
});
```

`outcome` remains direct for all-synchronous work; see
[Synchronous settlement](../../docs/packages/pipeline/execution-and-effects.md#synchronous-settlement).
The package root also exports `MaybePromise`, `AwaitedTuple`,
`adoptMaybePromise`, `isPromiseLike`, `maybeThen`, `maybeAll`, `maybeTry` and
`processSequentially`, so application composition can preserve that boundary
without copying Pipeline internals or defaulting to `async`.

`greeting` and `punctuation` are independent. `message` is the explicit join:
its executor receives both outputs by node key. Its value cannot depend on
which sibling settled first.

A target may intentionally ignore an available predecessor output, including
`undefined`, when predecessor success is itself the causal prerequisite. This
does not turn an edge into arbitrary sequencing.

## Contract limits

- Edges are data dependencies, not ordering hints, resource locks or
  middleware selectors.
- Readiness permits concurrent work. Canonical node and effect ordinals define
  journal chronology, forward commit order and reverse compensation order.
  Wall-clock settlement cannot choose node values or reorder those semantics.
- Graph inputs, node outputs and effect payloads are copied and frozen at the
  owning boundary. Capabilities are live host-owned services, not graph data.
- `Pipeline` is process-local. Suspension is a live, single-use value, not a
  portable checkpoint.
- Effects prepare during node work, commit after graph success, and compensate
  in reverse journal chronology on failure or abandonment. This is
  compensation, not a transaction over an external system.

Pipeline does not provide durable restart, multiprocess ownership, idempotency
keys, a guarantee that an external effect is delivered only once, or
settlement-order semantics. Those are host concerns. The graph is deliberately
not pretending to be a small distributed state department.

## Documentation

- [Pipeline v2 guide](../../docs/packages/pipeline.md)
- [Architecture](../../docs/packages/pipeline/architecture.md)
- [Authoring graphs](../../docs/packages/pipeline/authoring.md)
- [Execution and effects](../../docs/packages/pipeline/execution-and-effects.md)
- [Migrating from v1](../../docs/packages/pipeline/migrating-to-v2.md)
- [Historical v1 hardening record](../../docs/packages/pipeline/hardening-plan.md)

## License

EUPL-1.2 © [The Geekist](https://github.com/theGeekist)
