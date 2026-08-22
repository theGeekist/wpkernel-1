# @wpkernel/pipeline

Pipeline v2 is an immutable dataflow evaluator. It compiles one declaration
and its creation-time extensions into a graph, then evaluates a fresh,
process-local run through a `Pipeline` token.

## Version boundary

Pipeline 2.0 makes the immutable dataflow evaluator the package root. The v1
helper and stage API remains available from `@wpkernel/pipeline/v1` for serial
compatibility. Version 1.4.1 is the final 1.x release and therefore still uses
the old root until 2.0.0 is promoted.

V1 and v2 use some familiar words for different authorities:

- v1 helpers and stages form a serial programme with threaded output.
- v2 nodes and edges form one graph with independent immutable values.
- v1 extensions combine registration, lifecycle hooks and rollback.
- v2 uses separate graph extensions, node middleware, run observers and effect
  participants.

Choose `/v1` only for an existing serial consumer or compatibility adapter. New
native work should use the v2 root.

## Guides

- [Architecture](./pipeline/architecture.md): graph authority, ordering,
  immutable ownership and the host boundary.
- [Authoring graphs](./pipeline/authoring.md): declarations, executors,
  extensions and diagnostics before admission.
- [Execution and effects](./pipeline/execution-and-effects.md): readiness,
  cancellation, role boundaries, effects and suspension.
- [Migrating to v2](./pipeline/migrating-to-v2.md): the semantic breaks from
  v1, with direct before-and-after examples.

## Historical v1 material

[Framework contributor guidance](./pipeline/framework-contributors.md) and the
[hardening plan](./pipeline/hardening-plan.md) record the v1 model. They are
not a v2 authoring reference. In particular, a v1 pause snapshot, lifecycle
hook or `next(output?)` is not native v2 vocabulary.
