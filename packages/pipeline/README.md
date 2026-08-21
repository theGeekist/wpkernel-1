# @wpkernel/pipeline

`@wpkernel/pipeline` v2 evaluates one immutable dataflow graph for each
process-local run. A `Pipeline` token admits the run; the compiled graph owns
readiness and execution. Nodes receive declared external inputs and direct
predecessor outputs, then return their own values. They do not share a draft,
thread a current output, or call the rest of the graph.

## Version boundary

The installed 1.x package retains the v1 helper, stage and lifecycle API. This
README describes the v2 contract and its intended root import after v2 is
integrated. It is not a claim that a 1.x installation already exports it.

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

`greeting` and `punctuation` are independent. `message` is the explicit join:
its executor receives both outputs by node key. Its value cannot depend on
which sibling settled first.

## Contract limits

- Edges are data dependencies, not ordering hints, resource locks or
  middleware selectors.
- Readiness permits concurrent work. Canonical ordering controls admission and
  reporting, never a node value or effect settlement.
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
