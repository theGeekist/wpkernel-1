---
architecture_version: 1
id: P2-015
title: Bound staged Markdown normalisation
stage: integration
status: done
priority: critical
evidence_milestone: 'Staged Markdown normalisation bounded to explicit files and independently reviewed clean'
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: codex-root
owner_kind: codex
lease_started_at: 2026-08-22T04:00:00+08:00
lease_expires_at: 2026-08-22T08:00:00+08:00
base_sha: 656c5016df4d02346044b968d0e0944171565613
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-013
decision_dependencies: []
conflicts_with:
    - P2-007
    - P2-008
write_scope:
    - package.json
    - scripts/normalize-punctuation.js
    - tests/__tests__/scripts/normalize-punctuation.test.ts
    - docs/internal/pipeline/ROADMAP.md
    - docs/internal/pipeline/tasks/P2-007-v1-adapter-and-consumer-integration.md
    - docs/internal/pipeline/tasks/P2-010-delivery-latency-instrumentation.md
    - docs/internal/pipeline/tasks/P2-015-bound-staged-markdown-normalisation.md
required_reading:
    - path: instructions/wpkernel-repository-guide.md
      reason: Preserve generated documentation and commit qualification boundaries.
    - path: docs/internal/pipeline/COORDINATION.md
      reason: Keep the correction inside the governed v2 release chain.
read_scope:
    - package.json
    - scripts/**
    - instructions/wpkernel-repository-guide.md
    - docs/internal/pipeline/**
    - docs/api/**
review_owner: coordinator
updated_at: 2026-08-22
---

# P2-015: Bound staged Markdown normalisation

## Objective

Prevent a staged Markdown commit from rewriting unrelated generated API output
while retaining repository-wide punctuation normalisation when explicitly run.

## Acceptance criteria

- `normalize-punctuation.js` honours explicit Markdown paths supplied by
  `lint-staged` and does not discover additional files in that mode.
- An invocation without explicit paths retains the repository-wide formatter
  behaviour.
- Missing, non-Markdown and duplicate explicit paths settle predictably without
  broadening the write set.
- Regression coverage proves that a staged-source invocation cannot mutate a
  generated API file outside its arguments.
- The 472 generated API files changed by the P2-013 commit hook are restored to
  their committed projection before P2-007 starts.

## Verification

Focused script tests, a dry staged-file fixture, `git diff --check`, and an
independent patch review before the task becomes done.

Suggested execution tier: fast implementation with balanced independent review.
