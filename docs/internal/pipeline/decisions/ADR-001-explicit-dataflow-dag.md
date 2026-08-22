# ADR-001: Pipeline v2 is an explicit dataflow DAG

Status: accepted
Date: 2026-08-18

## Context

Pipeline v1 builds a dependency graph per helper kind, validates it, reduces it
to one total order and threads one current output through that order. A
sequential stage array remains the outer execution authority. `next(output?)`
can recursively execute the remaining helper suffix.

That is useful precedence-constrained composition, but it is not dataflow.
Independent nodes do not own independent values and cannot be scheduled from
graph readiness without changing the contract.

## Decision

V2 compiles registration into one immutable executable graph containing unique
node identities, explicit edges, incoming and outgoing adjacency, canonical
topological rank and execution policy. The scheduler operates on that graph
directly. Stage arrays are not a second authority.

Each node:

- receives external inputs and the outputs of its declared dependencies,
  keyed by identity;
- treats those inputs as immutable;
- returns its own replacement output;
- cannot execute or suppress downstream nodes.

Fan-in is explicit. A node that aggregates values is an ordinary reducer node.
The scheduler does not merge parent outputs by completion order or implicit
object spreading.

A dependant may intentionally ignore a predecessor output, including
`undefined`, when source success is itself a causal prerequisite. This remains
a data edge, not arbitrary sequencing between unrelated work.

Every ready node is admitted subject to an optional concurrency bound. When
capacity is constrained, canonical rank, declared priority, key and
registration order determine admission. Priority affects scheduling, not graph
meaning. A dependant becomes ready as soon as its own dependencies succeed; a
slow unrelated branch does not create a wave barrier.

`next(output?)` is not part of the v2 node contract. A v1 compatibility adapter
may retain it inside a serial boundary, but it cannot influence v2 scheduling.

The scheduler preserves synchronous `MaybePromise` settlement. It invokes a
ready admission set in deterministic order and promotes the run only when an
admitted participant produces an adopted promise. A synchronous failure does
not prevent already-selected siblings from being invoked.

On failure, the default policy stops new admission, drains admitted work,
blocks downstream nodes, retains every failure and selects the primary failure
by canonical graph order. Continue-independent-branches behaviour requires a
future explicit policy and evidence.

Multiple concurrent pause requests are a graph error. Pause semantics are
defined separately in P2-006.

## Consequences

This is a major version. `dependsOn` becomes a real data dependency;
`HelperApplyFn`, threaded output, mutable shared drafts, `createStages`, step
ordering and duplicate-key extension semantics cannot be reinterpreted in
place.

Strong v1 contracts remain: run-local diagnostics, registration quiescence,
original-error primacy, rollback containment and synchronous settlement.
