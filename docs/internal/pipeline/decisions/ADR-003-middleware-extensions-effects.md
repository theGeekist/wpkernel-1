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
2. Node middleware intercepts one node invocation through explicit before,
   after and error phases. It cannot capture the remaining graph.
3. Run observers receive diagnostic and lifecycle events without mutating graph
   data or controlling admission.
4. Effect participants return declared prepare, commit and compensate work for
   the unified effect journal.

Artifact-transforming lifecycle hooks compile to dataflow nodes. Named
lifecycle anchors may remain as an authoring convenience, but they are graph
anchors rather than an independent execution engine.

Configuration preserves v1's useful registration behaviour: asynchronous
setup respects registration call order, runs await registration quiescence and
each run captures a configuration snapshot.

The final public nouns and function names remain subject to P2-001's vocabulary
review. These four roles are semantic boundaries, not an instruction to expose
four factories with these exact names.

## Consequences

Middleware remains possible without smuggling serial continuation semantics
into nodes. Extensions can remain ergonomic while their graph and effect
contributions become inspectable before execution.
