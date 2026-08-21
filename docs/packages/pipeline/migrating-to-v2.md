# Migrating from Pipeline v1 to v2

V2 is a semantic migration, not a rename set. V1's serial helper programme,
threaded output and combined extension lifecycle do not become native v2 by
changing import paths.

> **V2 availability:** This is the reviewed v2 surface. Its public examples
> use the future `@wpkernel/pipeline` root import, which P2-007 exposes. The
> current `@wpkernel/pipeline` 1.4.1 release remains the v1 API.

| V1 concept                   | V2 replacement                                              | Migration consequence                                                                      |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| helper                       | literal-keyed node plus executor                            | A node returns its own immutable output.                                                   |
| `dependsOn`                  | data edge                                                   | The target receives the source output. It is not ordering-only precedence.                 |
| stage array                  | compiled graph                                              | Readiness and capacity replace stage traversal.                                            |
| `next(output?)`              | no native equivalent                                        | Use edges and an explicit join node; keep `next` only inside a serial compatibility node.  |
| shared draft/current output  | dependency outputs                                          | Model every value source and reduction explicitly.                                         |
| mutable `use()` registration | creation-time extension tuple                               | Create a new `Pipeline` to reconfigure.                                                    |
| lifecycle extension          | graph extension, middleware, observer or effect participant | Select the one role that owns the behaviour.                                               |
| rollback                     | `EffectParticipant.compensate`                              | Declare and prepare a native effect; compensation does not make an external system atomic. |
| pause snapshot               | single-use process-local `Suspension`                       | Resume in the same live process, or persist host intent and start a new run.               |

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
which output should be current.

Do not translate `next` into a capability callback that invokes downstream
executors. That recreates a second scheduler behind a polite function name.

## Extensions split by authority

Move a v1 extension according to what it actually does:

- adds nodes or edges before compilation: `GraphExtension`;
- brackets one known node: `NodeMiddleware`;
- logs or projects lifecycle facts: `RunObserver`;
- writes or compensates an external system: `EffectParticipant`.

A v1 lifecycle hook that transforms an artifact becomes a dataflow node. An
anchor can name an authoring location but cannot schedule a hook or form an
alternate lifecycle interpreter.

## Rollback becomes declared effects

V1 rollback could collect arbitrary helper cleanup. In v2, an executor or
middleware phase emits an `EffectRequest` for a declared participant. The
participant prepares process-local state, commits only after graph success and
compensates in reverse journal chronology when the run fails, cancels or is
abandoned.

This does not capture unannounced eager side effects. If a node writes the
file, sends the request or mutates the database before returning its effect
request, Pipeline has nothing native to compensate. Move that work into the
participant, then give the host durable authority where the system requires it.

## Pause becomes a process-local frontier

V1 pause/resume snapshots are not a v2 portability mechanism. A v2
`Suspension` is a single-use live authority with private scheduler state and
prepared effects. `resume` and `abandon` consume it in the same process.

For durable approval or restart, store the domain state, plan identity,
idempotency material and any host journal yourself. On recovery, reconstruct a
new graph run. Do not serialise `Suspension` and hope it has become a
checkpoint on the way to disk.
