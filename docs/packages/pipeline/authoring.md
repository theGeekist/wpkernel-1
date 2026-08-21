# Authoring Pipeline v2 graphs

V2 authoring describes one graph before it runs. The public declaration names
external input keys, nodes, data edges, effect contracts, output projections,
execution policy and keyed executors. An executor receives only the external
input keys and predecessor outputs declared for its node.

> **V2 availability:** This is the reviewed v2 surface. Its public examples
> use the future `@wpkernel/pipeline` root import, which P2-007 exposes. The
> current `@wpkernel/pipeline` 1.4.1 release remains the v1 API.

## Declarations and executors

A node contract declares its external input keys, permitted effect keys and
priority. Its executor returns one `NodeResult`: success with an immutable
output and declared effect requests, failure with its declared error, or
cooperative cancellation after its signal is aborted.

An output projection is explicit. It maps the public successful output shape to
node keys; the runtime does not expose every intermediate value by accident.

Use an edge when the target needs the source value. Use a node when values need
combining. For example, two branches that produce a document and a theme do
not make a renderer by completing in a convenient order. Declare both edges to
`render`, then make the renderer's executor read
`input.dependencies.document` and `input.dependencies.theme`.

`maxConcurrency` is required and is either a positive safe integer or
`'unbounded'`. There is no silent default. An omitted policy is a configuration
issue, not permission to guess what the host meant.

## Graph extensions

A `GraphExtension` contributes one immutable `GraphContribution` during
Pipeline creation. A contribution may add nodes, edges, inert anchors, output
projections and executors. It has no runtime continuation and cannot mutate a
live evaluator.

`createPipeline` captures the complete extension tuple before it calls any
contribution. Each configuration value is validated, copied and frozen. An
earlier extension cannot change a later callback identity or configuration by
mutating the original object. Reconfiguration means creating another
`Pipeline`, not calling `use` on an existing one.

Anchors are authoring references to existing nodes. They have no readiness,
scheduling, middleware or effect meaning. They cannot recreate lifecycle
phases under another name.

## Explicit joins

V1 could pass one current output through helper order. V2 cannot, because
parallel branches have no privileged last output. Model a join as an ordinary
node with all source edges declared.

```ts
import { type GraphDeclaration, type NodeContract } from '@wpkernel/pipeline';

type Nodes = {
	readonly title: NodeContract<'name', string>;
	readonly body: NodeContract<'name', string>;
	readonly page: NodeContract<never, string>;
};

const declaration = {
	inputKeys: ['name'],
	nodes: {
		title: { externalInputs: ['name'], effectKeys: [], priority: 0 },
		body: { externalInputs: ['name'], effectKeys: [], priority: 0 },
		page: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [
		{ from: 'title', to: 'page' },
		{ from: 'body', to: 'page' },
	] as const,
	effects: {},
	outputs: { page: 'page' },
	policy: { maxConcurrency: 2 },
	executors: {
		title: ({ input }) => ({
			kind: 'success',
			output: `Hello ${input.external.name}`,
			effects: [],
		}),
		body: ({ input }) => ({
			kind: 'success',
			output: `Welcome, ${input.external.name}.`,
			effects: [],
		}),
		page: ({ input }) => ({
			kind: 'success',
			output: `<h1>${input.dependencies.title}</h1><p>${input.dependencies.body}</p>`,
			effects: [],
		}),
	},
} satisfies GraphDeclaration<
	{ readonly name: string },
	Nodes,
	readonly [
		{ readonly from: 'title'; readonly to: 'page' },
		{ readonly from: 'body'; readonly to: 'page' },
	],
	{},
	{ readonly page: 'page' },
	{}
>;
```

## Diagnostics before execution

Compilation checks duplicate or missing nodes, cycles, invalid outputs and
anchors, effect-key mismatches, invalid policy and invalid contributions. Role
configuration then checks exact middleware-node compatibility and participant
keys. Pipeline retains every knowable issue before scheduler admission.

This is a deliberately different boundary from an executor failure. A missing
node key prevents graph work. A node that returns `{ kind: 'failure' }` fails a
run that was already validly admitted. Treating both as an exception thrown
somewhere near a callback loses the authority boundary that v2 is trying to
keep visible.

## Creation-time extension rules

Keep extension configuration within `GraphValue`: plain data that Pipeline can
own. Pass live clients, queues and clocks through `capabilities` at run time.
Do not build a configuration object around a mutable registry, a callback that
will register later callbacks, or a service object that needs a lease. Those
are alternate authorities, not graph declarations.

For cross-cutting runtime work, select the role that owns it:

- graph structure: `GraphExtension`;
- one exact node's local phases: `NodeMiddleware`;
- diagnostic event consumption: `RunObserver`;
- external change: `EffectParticipant`.

The split is intentional. One broad extension interface is how a second engine
sneaks in wearing a sensible hat.
