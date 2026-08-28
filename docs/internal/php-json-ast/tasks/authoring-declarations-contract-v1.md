---
id: authoring-declarations-contract-v1
title: 'Freeze authoring declarations contract v1'
stage: contract
status: done
priority: critical
evidence_milestone: 'PR review corrections incorporated; formatting, whitespace and host PHP parser checks passed'
forward_to: []
depends_on:
    - spike-truth-baseline
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/authoring-declarations-contract-v1.md
    - docs/internal/php-json-ast/contracts/authoring-declarations-v1.md
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-25
---

# authoring-declarations-contract-v1: Freeze authoring declarations contract v1

## Objective

Define the exact v1 declarations, imports, namespace, comments and file-composition contract before implementation.

## Why this exists

PJA-220 remained open because the declaration boundary was not explicit enough for independent implementation and review.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Supported declaration and type/modifier vocabulary.
- Namespace and import ordering, comments, file composition and lowering errors.
- Public versus internal symbols and deliberately unsupported PHP constructs.

## Out of scope

- Implementation code and package exports.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- The contract identifies every v1 input and AST output invariant.
- Unsupported constructs and extension rules are explicit.
- An implementation task can proceed without editing this contract.

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
Concurrency evaluation: start alongside cli-migration-contract-v1; scopes are disjoint and both dependencies are satisfied.
Concurrent task scopes: cli-migration-contract-v1 owns its task brief and contracts/cli-migration-v1.md.
Swarm delegation: none

## Blocker

None recorded.

## Handoff

### Result

Published [`authoring-declarations-v1.md`](../contracts/authoring-declarations-v1.md),
the immutable v1 contract for generic declarations, imports, namespaces,
comments and file composition. It freezes the bounded semantic surface and
direct canonical-AST lowering rules before implementation begins. Review
clarified separate declaration provenance, the exact accepted declaration
kinds, proxy limits, type grammar and context validation, import binding,
doc ownership, duplicate declaration behaviour and PHP case-sensitive parameter
identity.

### Files changed

- `docs/internal/php-json-ast/tasks/authoring-declarations-contract-v1.md`
- `docs/internal/php-json-ast/contracts/authoring-declarations-v1.md`

### Verification evidence

- Base SHA: `bc25f73195be62e243fbc44adaa896fa292970aa`.
- `git diff --check`: passed (exit 0) after authoring the contract and task
  handoff.
- `git diff --no-index --check /dev/null docs/internal/php-json-ast/contracts/authoring-declarations-v1.md`:
  emitted no whitespace diagnostics; exit 1 is expected for an added file.
- PR review corrections were verified against host PHP: `static` parameters,
  `false|true`, and `object|stdClass` each failed parsing with the expected
  invariant-specific fatal error.
- `pnpm exec prettier --check` passed for the contract, task brief and status
  file; `git diff --check` passed with no diagnostics.
- Contract exercised against the current authoring and AST source boundary at
  `@wpkernel/php-json-ast` `0.12.6-beta.3`, Node.js `v22.22.0` and pnpm
  `10.19.0`; no package runtime claim is made by this documentation task.
- Independent semantic re-review returned clean after descriptor, type,
  namespace, import, parameter and documentation corrections.
- Fresh final independent review confirmed PHP parameter identity uses the
  correct case-sensitive semantics and returned clean with no regressions.

### Remaining risks

The current raw AST does not expose dedicated typed builders for every PHP
declaration shape. The implementation must stay inside this v1 contract and
use canonical AST construction without expanding package exports; the
coordinator must decide any source-level incompatibility rather than widening
the contract in place. Proxy traps remain deliberately outside the generic
authoring contract and must not be represented as a proven rejection guarantee.

### Recommended next task

Implement the now-ready `authoring-declarations-v1` task against the frozen
contract, including its descriptor provenance and adversarial type-validation
fixtures.
