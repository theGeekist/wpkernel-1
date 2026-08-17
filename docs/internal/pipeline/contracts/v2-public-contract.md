# Pipeline v2 public contract

Status: Draft
Owner task: P2-001

This contract will define the public graph, node, run, middleware, effect,
suspension and diagnostic semantics admitted for implementation. Until P2-001
is done, the accepted ADRs govern and unresolved API shapes remain open.

## Required decisions

- Public graph and node declaration shape.
- Keyed dependency input and output typing.
- Concurrency options and cancellation.
- Synchronous `MaybePromise` settlement.
- Failure aggregation and node outcome projection.
- Middleware, observer and effect participation.
- Process-local suspension and v1 compatibility boundary.
