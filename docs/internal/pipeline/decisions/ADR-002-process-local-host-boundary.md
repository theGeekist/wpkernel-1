# ADR-002: Pipeline v2 remains a process-local evaluator

Status: accepted
Date: 2026-08-18

## Context

Pipeline can order work, capture process-local suspension and compensate
prepared effects. It cannot make arbitrary external systems transactional or
survive process death by itself.

## Decision

Pipeline owns:

- graph compilation and readiness scheduling;
- immutable value propagation;
- run-local diagnostics and node outcomes;
- process-local cancellation, suspension and resume;
- a deterministic journal of declared effect preparation, commit and
  compensation;
- containment and reporting of compensation and observer failures.

The host owns:

- durable admission and idempotency keys;
- leases, ownership and hostile multi-launch concurrency;
- durable journals, retries and migrations;
- process-tree supervision and interruption recovery;
- external-effect authority and exactly-once claims;
- portable checkpoints and plan identity.

V2 pause captures a private, single-use graph frontier only after admitted work
has drained. It is not a serialisable checkpoint. Hosts reconstruct durable
work as a new invocation.

Declared effects are prepared during node execution, committed in canonical
graph order only after graph success, and compensated in reverse journal
chronology on failure. Eager mutation inside node bodies remains outside this
guarantee.

## Consequences

The package can be rigorous without becoming a distributed execution host.
Public documentation must state the topology and guarantee precisely rather
than applying vague maturity labels.
