# ADR-003: V2 separates middleware, graph extensions, observers and effects

Status: accepted
Date: 2026-08-18

## Context

V1 extensions combine setup, helper registration, lifecycle hooks, artifact
transformation, commit and rollback. Lifecycle hooks form another sequential
transformation mechanism beside the helper graph. Public node continuations
also make one helper responsible for the rest of a chain.

## Decision

V2 has four semantic roles:

1. Graph extensions contribute declarative nodes and edges before compilation.
2. Node middleware intercepts one exact node key through explicit before,
   after, error and cancel phases. V2 has no node-tag eligibility. Middleware
   cannot capture the remaining graph.
3. Run observers receive diagnostic and lifecycle events without mutating graph
   data or controlling admission.
4. Effect participants return declared prepare, commit and compensate work for
   the unified effect journal.

Artifact-transforming lifecycle hooks compile to dataflow nodes. Named anchors
may remain only as inert authoring references to existing nodes. They have no
scheduling, readiness, middleware, admission or effect meaning.

`createPipeline` owns one dense extension-registration tuple in two phases. It
first captures every callback identity and copied, frozen `GraphValue`
configuration, retaining indexed ownership failures, then invokes valid
contribution callbacks once in tuple order. `runPipeline` owns the complete
input record before observing that captured generation, drains every extension
settlement, compiles every successful contribution and retains all resulting
graph diagnostics. Structural and graph-dependent role issues accumulate
without executing role compilers; scheduling begins only when the complete
issue set is empty. There is no public mutable registry, `use` method or compile
operation.

The public evaluator is a frozen nominal `Pipeline` data token operated by
top-level functions. `v2/pipeline` curates the public role and outcome types;
graph, role, journal and scheduler compilers remain internal seams. These four
roles are semantic boundaries, not four execution authorities.

## Consequences

Middleware remains possible without smuggling serial continuation semantics
into nodes. Extensions can remain ergonomic while their graph and effect
contributions become inspectable before execution. Reconfiguration creates a
new Pipeline token rather than mutating a live evaluator.
