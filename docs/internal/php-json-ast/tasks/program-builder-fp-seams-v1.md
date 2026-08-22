---
architecture_version: 1
id: program-builder-fp-seams-v1
title: 'Extract class-free PHP program-builder seams'
stage: source
status: proposed
priority: high
evidence_milestone: null
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: null
owner_kind: null
lease_started_at: null
lease_expires_at: null
base_sha: null
branch: null
worktree: null
depends_on:
    - pipeline-v2/P2-007
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/program-builder-fp-seams-v1.md
    - packages/php-json-ast/src/programBuilder.ts
    - packages/php-json-ast/src/program-builder/**
    - packages/php-json-ast/src/__tests__/programBuilder.test.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: Preserve the existing PHP AST and source-location contracts.
    - path: docs/internal/pipeline/tasks/P2-007-v1-adapter-and-consumer-integration.md
      reason: Start only after the Pipeline compatibility import boundary is integrated.
read_scope:
    - docs/internal/php-json-ast/**
    - docs/internal/pipeline/tasks/P2-007-v1-adapter-and-consumer-integration.md
    - packages/php-json-ast/src/programBuilder.ts
    - packages/php-json-ast/src/__tests__/programBuilder.test.ts
review_owner: coordinator
updated_at: 2026-08-22
---

# program-builder-fp-seams-v1: Extract class-free PHP program-builder seams

## Objective

Split the oversized PHP program builder into coherent class-free functional
seams without changing emitted AST, source locations or public contracts.

## Why this exists

The P2-007 consumer audit confirmed that `programBuilder.ts` exceeds 840 lines
and implements source-location tracking through a runtime class. The Pipeline
import correction does not require changing that behaviour, so coupling the
refactor to the v2 boundary would create avoidable metadata risk. The finding
remains valid and is deferred here explicitly rather than discarded.

## Inputs

- Current program-builder fixtures and exact source-location snapshots.
- The integrated `@wpkernel/pipeline/v1` compatibility import.

## In scope

- Replace `LocationTracker` with immutable data and module functions.
- Extract layout, use-organisation and location concerns at natural seams.
- Keep implementation files around 500 lines or fewer.
- Add focused equivalence and adversarial location tests before extraction.

## Out of scope

- New PHP authoring vocabulary, source-bridge protocols or Pipeline semantics.
- Changes to emitted PHP, AST node attributes or public builder types.

## Contract and naming constraints

- AST remains the single generated-code representation.
- Source positions, comments, namespaces, imports and statement order are exact
  compatibility data, not formatting suggestions.
- Use plain frozen data and module functions; add no runtime class or hidden
  mutable closure authority.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request
coordinator integration for shared exports or manifests.

## Acceptance criteria

- No runtime class remains in the owned program-builder implementation.
- Existing outputs and source-location metadata are byte-for-byte equivalent.
- Every owned implementation file is roughly 500 lines or fewer.
- Coverage does not regress and new state transitions receive focused tests.
- An independent FP and compatibility review returns clean after corrections.

## Verification

Focused program-builder tests, php-json-ast source/test typechecks, full package
tests and coverage, emitted-program fixture comparison, lint and diff checks.

## Required evidence

- Changed file list and exact base SHA.
- Before-and-after line counts and class scan.
- Exact verification commands, exit status and concise result.
- Fixture hashes proving unchanged emitted PHP and AST locations.
- Remaining known loss.

## Claim protocol

Follow [`../COORDINATION.md`](../COORDINATION.md) and
[`README.md`](README.md). P2-007 is done, so normal Task Graph admission applies.

## Work log

Execution mode: shared-checkout
Execution rationale: P2-007 is complete and has released the overlapping import boundary.
Concurrency evaluation: available for admission; no active owner currently holds `programBuilder.ts`.
Concurrent task scopes: re-evaluate against the live Task Graph plan when claiming.
Swarm delegation: none

## Blocker

None. `pipeline-v2/P2-007` is done and its overlapping write scope has been
released.

## Handoff

### Result

Not started.

### Files changed

- `docs/internal/php-json-ast/tasks/program-builder-fp-seams-v1.md`

### Verification evidence

Pending.

### Remaining risks

The current class and oversized module remain until this task is admitted.
Task Graph beta.4 successfully plans the combined repository authorities.

### Recommended next task

Claim this task through the normal Task Graph admission flow when prioritised.
