# Migrating from Pipeline v1 to v2

V2 is a semantic migration, not a rename set. V1's serial helper programme,
threaded output and combined extension lifecycle do not become native v2 by
changing import paths.

The package root is now the native v2 contract. The `/v1` subpath preserves
selected helper and standard serial programme semantics through a new immutable
adapter API. It is not the v1 source surface under a different import path.

## The v1 compatibility boundary

Use the explicit subpath when preserving selected serial behaviour is the
immediate requirement. The authoring and invocation surface still changes:

```ts
// 1.x
import { createPipeline } from '@wpkernel/pipeline';

const pipeline = createPipeline(configuration);
pipeline.ir.use(fragment);
pipeline.builders.use(builder);
pipeline.extensions.use(extension);
const result = pipeline.run(options);
```

```ts
// 2.x serial compatibility adapter
import { createSerialPipeline, runPipeline } from '@wpkernel/pipeline/v1';

const serialExtension = {
	key: 'render-metadata',
	lifecycle: 'after-fragments',
	hook: renderMetadata,
} as const;

const pipeline = createSerialPipeline({
	...configuration,
	fragments: [fragment] as const,
	builders: [builder] as const,
	extensions: [serialExtension] as const,
});
const outcome = runPipeline({ pipeline, options });
```

`extension` and `serialExtension` are deliberately different values. A v1
extension could perform dynamic setup or inject helpers through
`register(pipeline)`. Resolve that setup before constructing the serial
programme, place every injected helper explicitly in `fragments` or `builders`,
and represent the resulting lifecycle behaviour as the static
`{ key, lifecycle, hook }` descriptor.

`/v1` retains the helper programme, stage traversal, threaded output, `next`
and combined lifecycle semantics, but it no longer exposes an independent v1
runner. `createSerialPipeline` captures a static serial programme and
`runPipeline` evaluates it as exactly one native v2 node with one aggregate
native effect participant. That keeps synchronous settlement until real async
participation appears, but it still does not give those consumers graph
concurrency, immutable node values, reusable v2 middleware, or a second host
authority hidden behind old names. V1 pause snapshots and independent rollback
authority are unsupported there.

One intentional compatibility delta concerns diagnostic delivery. Historical v1
could suppress repeat delivery of the same diagnostic object across runs sharing
one reporter identity. The `/v1` adapter delivers diagnostics for each
invocation instead. Stored diagnostics, failure values and settlement behaviour
are unchanged. Cross-run suppression is not reproduced because it would require
mutable reporter-scoped state outside one captured serial run.

Historical v1 could let a throwing rollback observer suppress that rollback's
reporter warning. The `/v1` adapter contains observer and reporter failures
independently, so warning delivery is still attempted. Cleanup order, primary
failure and settlement behaviour are unchanged.

Use the subpath to keep an existing consumer working while its semantic
migration is deferred. Do not put new orchestration there merely to avoid
declaring its graph. Moving to v2 means modelling independent values, data
edges, joins and effect ownership explicitly; there is no mechanical import
change that performs that redesign.

| V1 concept                   | V2 replacement                                              | Migration consequence                                                                                                           |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| helper                       | literal-keyed node plus executor                            | A node returns its own immutable output.                                                                                        |
| `dependsOn`                  | data edge                                                   | The target receives the source output. It is not ordering-only precedence.                                                      |
| stage array                  | compiled graph                                              | Readiness and capacity replace stage traversal.                                                                                 |
| `next(output?)`              | no native equivalent                                        | Use edges and an explicit join node; keep `next` only inside a serial compatibility node.                                       |
| shared draft/current output  | dependency outputs                                          | Model every value source and reduction explicitly.                                                                              |
| mutable `use()` registration | creation-time extension tuple                               | Create a new `Pipeline` to reconfigure.                                                                                         |
| lifecycle extension          | graph extension, middleware, observer or effect participant | Select the one role that owns the behaviour.                                                                                    |
| rollback                     | `EffectParticipant.compensate`                              | Declare and prepare a native effect; `/v1` folds admitted cleanup into one native participant, not a public rollback authority. |
| pause snapshot               | single-use process-local `Suspension`                       | Root v2 can suspend in-process. `/v1` pause/resume is unsupported.                                                              |

## Helpers and stages become graph nodes

V1 could serialise two helpers by their place in a stage and pass a threaded
value from one to the next:

```ts
// v1
pipeline.use({
	kind: 'render',
	key: 'minify',
	dependsOn: ['template'],
	apply: ({ output }) => ({ output: minify(output) }),
});
```

In v2, say which value the node needs and return a separate value:

```ts
import { type NodeContract } from '@wpkernel/pipeline';

type Nodes = {
	readonly template: NodeContract<'source', string>;
	readonly minify: NodeContract<never, string>;
};

const edges = [{ from: 'template', to: 'minify' }] as const;

const executors = {
	template: ({
		input,
	}: {
		readonly input: { readonly external: { readonly source: string } };
	}) => ({
		kind: 'success' as const,
		output: render(input.external.source),
		effects: [],
	}),
	minify: ({
		input,
	}: {
		readonly input: {
			readonly dependencies: { readonly template: string };
		};
	}) => ({
		kind: 'success' as const,
		output: minify(input.dependencies.template),
		effects: [],
	}),
};
```

The verbose types in this small contrast only make the hand-off visible. In a
complete `GraphDeclaration`, `NodeExecutors` derives both inputs from the node
contracts and edge tuple.

## `next` becomes an explicit join

V1 `next(output?)` let one helper own the remainder of a serial chain. V2 does
not allow a node to capture the rest of the graph. Split pre- and post-work
into nodes, make all required edges explicit, and put the final reduction in a
join node. A join can wait for `validate`, `render` and `theme` without guessing
which output should be current. In `/v1`, `next` remains local to that serial
compatibility node. It never becomes graph middleware or downstream executor
authority.

Do not translate `next` into a capability callback that invokes downstream
executors. That recreates a second scheduler behind a polite function name.

## Extensions split by authority

Move a v1 extension according to what it actually does:

- adds nodes or edges before compilation: `GraphExtension`;
- brackets one known node: `NodeMiddleware`;
- logs or projects lifecycle facts: `RunObserver`;
- writes or compensates an external system: `EffectParticipant`.

A v1 lifecycle hook that transforms an artefact becomes a dataflow node. An
anchor can name an authoring location but cannot schedule a hook or form an
alternate lifecycle interpreter.

## Rollback becomes declared effects

V1 rollback could collect arbitrary helper cleanup. In v2, an executor or
middleware phase emits an `EffectRequest` for a declared participant. The
participant prepares process-local state, commits only after graph success and
compensates in reverse journal chronology when the run fails, cancels or is
abandoned.

The `/v1` host uses that same native effect boundary. Admitted helper and
extension cleanup are journalled behind one aggregate participant, then
projected back out as authority-free native evidence. Consumers keep the serial
programme semantics they wrote, but they do not keep a second rollback system.

This does not capture unannounced eager side effects. If a node writes the
file, sends the request or mutates the database before returning its effect
request, Pipeline has nothing native to compensate. Move that work into the
participant, then give the host durable authority where the system requires it.

## Pause becomes a process-local frontier

V1 pause/resume snapshots are not a v2 portability mechanism. A v2
`Suspension` is a single-use live authority with private scheduler state and
prepared effects. `resume` and `abandon` consume it in the same process.

The compatibility subpath does not expose pause/resume. A helper or extension
that tries to surface a pause is rejected because the host has exactly one
terminal native node to settle.

For durable approval or restart, store the domain state, plan identity,
idempotency material and any host journal yourself. On recovery, reconstruct a
new graph run. Do not serialise `Suspension` and hope it has become a
checkpoint on the way to disk.
