# Pipeline v2 coordination

Architecture version: 1
Task contract version: 1

## Selection

Run the configured task planner before claiming work. A task may start only
when its dependencies are done, its decision dependencies are accepted, and
its write scope does not overlap active work.

The primary checkout is the default. Shared-checkout parallelism is expected
for disjoint v2 modules. Generated documentation, root exports, manifests,
lockfiles and release surfaces remain coordinator-owned integration points.

## Lifecycle

```text
proposed -> ready -> claimed -> in_progress -> review -> done
                         \-> blocked
proposed | ready | blocked -> cancelled
```

The coordinator owns lifecycle transitions. A worker edits only its declared
write scope and task handoff while claimed.

## Swarm pricing

- Frontier reasoning: semantic contracts, the concurrent scheduler, failure
  aggregation, compensation and suspension.
- Balanced implementation: graph compilation, adapters, consumer migrations
  and packed qualification.
- Fast implementation: mechanical migrations, fixtures and documentation
  projection after the contract is frozen.

Pricing never weakens review. A cheaper implementation lane still receives an
independent contract review before integration.

## Shared invariants

- Preserve synchronous `MaybePromise` settlement until real asynchronous work
  appears.
- Do not introduce a second execution authority beside the compiled graph.
- Do not communicate graph data through shared mutable state.
- Do not let middleware capture or execute the remaining graph.
- Stop new admission on failure, drain admitted work and retain every failure.
- Keep the primary graph failure authoritative while containing rollback and
  observer failures.
- Do not claim durable restart, exactly-once external effects or hostile
  multi-launch ownership from the process-local package.

## Handoff

Every active task records changed paths, exact verification, contract version,
remaining risk and the recommended next task. Integration tasks also record
the packed archive identity and downstream consumer evidence.
