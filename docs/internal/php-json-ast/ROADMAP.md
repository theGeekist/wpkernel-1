# AST continuing programmes

Architecture version: 1
Role: programme grouping and priority advice; task front matter owns lifecycle
Technical baseline: [`authoring-roadmap.md`](authoring-roadmap.md)

The programme has four parallel fronts. Versioned contracts are admitted
before implementation so workers can own disjoint files in the same checkout.

```text
authoring-declarations-contract-v1 -> authoring-declarations-v1
                                   -> typed-fragments-v1

source-bridge-contract-v1 -> source-process-runner-v1
                          -> source-fragment-parser-v1
                          -> source-runtime-convergence-v1

cli-migration-contract-v1 -> cli-codemod-repair-v1
                          -> cli-migration-manifest-v1

qualification-contracts-v1 -> packed-plugin-harness-v1

packed-plugin-harness-v1 -> wordpress-api-qualification-v1
                         -> browser-qualification-v1
```

The four contract tasks are the initial ready frontier. They own four separate
documents and may run concurrently with the existing authoring, WordPress and
CLI review work.

## Compiler convergence

```text
authoring-declarations-v1 + source-fragment-parser-v1
  -> typed-fragments-v1

typed-fragments-v1 + source-runtime-convergence-v1
  -> compiler-public-entrypoints-v1
```

`compiler-public-entrypoints-v1` owns the shared package export and packed
consumer surfaces, so it is an integration task and does not run alongside
other compiler tasks that need those files.

## WordPress and CLI adoption

```text
compiler-public-entrypoints-v1 + wordpress-mutation-hardening
  -> wordpress-bootstrap-migration-v1
  -> wordpress-rest-migration-v1

cli-codemod-repair-v1 + wordpress-rest-migration-v1
  -> cli-migration-manifest-v1
  -> cli-idempotency-v1
  -> cli-packed-qualification-v1
```

WordPress semantics remain in `wp-json-ast`. The CLI consumes WordPress plans
and public compiler fronts; neither layer may introduce a competing PHP DSL.

## Runtime qualification and release

```text
wordpress-api-qualification-v1 + browser-qualification-v1
+ wordpress-rest-migration-v1
  -> dual-path-runtime-parity-v1

dual-path-runtime-parity-v1 + cli-packed-qualification-v1
  -> ci-qualification-lanes-v1
  -> release-candidate-qualification-v1
  -> production-decision-v1
```

Implementation, package verification, packed qualification, release and
production qualification remain separate states. A passing Jest suite does not
advance a runtime or release claim.

## Parallel frontier rules

Priority is applied after dependency and decision admission. Tasks at the same
priority are evaluated independently. A lower-priority task waits while any
admitted higher-priority candidate exists, but an unrelated active task does
not block it unless scopes or explicit conflicts overlap.

The exact current frontier, blockers and active scope intersections come from
the task planner and workbench, never from this prose.
