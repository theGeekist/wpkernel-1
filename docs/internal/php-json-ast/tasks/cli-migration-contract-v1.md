---
architecture_version: 1
id: cli-migration-contract-v1
title: 'Freeze CLI migration and ownership contract v1'
stage: contract
status: done
priority: critical
evidence_milestone: 'Contract authored; git diff checks passed; fresh independent final review clean after correction'
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: codex-cli-migration-contract-worker
owner_kind: codex
lease_started_at: 2026-08-25T09:46:29+08:00
lease_expires_at: 2026-08-25T11:46:29+08:00
base_sha: bc25f73195be62e243fbc44adaa896fa292970aa
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - spike-truth-baseline
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/cli-migration-contract-v1.md
    - docs/internal/php-json-ast/contracts/cli-migration-v1.md
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-25
---

# cli-migration-contract-v1: Freeze CLI migration and ownership contract v1

## Objective

Version the codemod target, generated ownership and migration-manifest contract used by generate and apply.

## Why this exists

CLI adoption can otherwise false-green, reinterpret markers or change migration output without a compatibility decision.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Target discovery and empty-target failure.
- Ownership marker semantics, manifest states, source and target versions, conflicts and recovery.

## Out of scope

- CLI implementation and fixture execution.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Every generate/apply outcome has one machine-readable state.
- Ownership and conflict rules are unambiguous and versioned.
- Interrupted and repeated execution semantics are specified.

## Verification

- `git diff --check`

## Required evidence

- Changed path list and exact base SHA.
- Verification commands, exit statuses and concise results.
- Contract, package and runtime versions exercised.
- Remaining known loss and requested coordinator actions.

## Claim protocol

Follow [`../COORDINATION.md`](../COORDINATION.md) and [`README.md`](README.md). Re-run admission immediately before claim.

## Work log

Execution mode: shared-checkout
Execution rationale: The declared scope is designed for the primary checkout.
Concurrency evaluation: start alongside authoring-declarations-contract-v1; scopes are disjoint and both dependencies are satisfied.
Concurrent task scopes: authoring-declarations-contract-v1 owns its task brief and contracts/authoring-declarations-v1.md.
Swarm delegation: none

## Blocker

None recorded.

## Handoff

### Result

Authored the exact CLI migration and generated-ownership contract v1. It
freezes strict requested-target discovery, the existing WPK auto-guard spellings,
terminal manifest states, version provenance, conflict handling, and durable
interruption recovery. Review corrections separate raw configured-path evidence
from canonical paths, define terminal observations for deletion recovery, and
give recovery-required refusals an empty target list plus pending-journal
references.

### Files changed

- `docs/internal/php-json-ast/contracts/cli-migration-v1.md`
- `docs/internal/php-json-ast/tasks/cli-migration-contract-v1.md`

### Verification evidence

`git diff --check` exited 0. The untracked contract was also checked with
`git diff --no-index --check /dev/null docs/internal/php-json-ast/contracts/cli-migration-v1.md`;
its expected comparison exit was 1 and it emitted no whitespace diagnostics.
Independent migration-safety re-review returned clean after correcting
discovery identity, raw-path diagnostics, terminal observations and recovery
refusal semantics.
Fresh final independent review confirmed staged-plan integrity binding,
source-kind discovery and bounded handoff evidence, then returned clean with no
regressions.

Base SHA: `bc25f73195be62e243fbc44adaa896fa292970aa`.
Contract exercised: CLI migration and ownership contract v1. Package evidence
read from `packages/cli/package.json`: `@wpkernel/cli` `0.12.6-beta.3`.
Observed command runtime: Node `v22.22.0`; package-manager runtime: pnpm
`10.19.0`. This task performed documentation and diff qualification only; it
did not claim CLI, PHP, WordPress or packed-runtime qualification.

### Remaining risks

The observed config path currently fails to carry the active codemod object to
the helper, the resolver can treat an empty resolved target set as a successful
no-op, and apply can write whole-file three-way conflict markers. Generation
state has no assigned v1 source/base provenance or recovery-journal schema.
These are implementation requirements, not claims of current compliant
behaviour.

### Recommended next task

Coordinator: add the produced contract to `cli-codemod-repair-v1` required
reading; create and schedule `cli-migration-state-provenance-v1` and
`cli-ownership-safe-apply-v1`; then update manifest and idempotency dependencies
as specified by the contract. Assign the versioned migration-manifest location
through the coordinator-owned layout surface before admitting its implementation.
