---
architecture_version: 1
id: P2-019
title: Quarantine obsolete prerelease authority
stage: release
status: done
priority: critical
evidence_milestone: 'Obsolete prerelease entry point fails closed across five legacy invocation forms; focused checks and independent review are green with no P1/P2 findings'
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: /root
owner_kind: codex
lease_started_at: 2026-08-23T00:27:08+08:00
lease_expires_at: 2026-08-23T04:27:08+08:00
base_sha: ebf0204447acb87a2cdd650234b1839100e5b86c
branch: pr/post-merge-review-corrections
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-009
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/pipeline/tasks/P2-019-prerelease-authority-quarantine.md
    - scripts/workflow/prerelease.ts
    - scripts/workflow/README.md
    - tests/__tests__/scripts/workflow-prerelease-authority.test.ts
required_reading:
    - path: docs/internal/pipeline/tasks/P2-009-packed-qualification-and-release.md
      reason: Preserve the published Pipeline 2.0.0 release authority and evidence.
    - path: docs/internal/pipeline/ROADMAP.md
      reason: Keep ordinary preparation separate from trusted publication authority.
    - path: instructions/wpkernel-repository-guide.md
      reason: Preserve the authoring-fork and upstream-projection workflow.
read_scope:
    - docs/internal/pipeline/**
    - instructions/wpkernel-repository-guide.md
    - scripts/workflow/**
    - scripts/release/**
    - tests/__tests__/scripts/**
    - .github/workflows/publish-pipeline.yml
    - package.json
review_owner: coordinator
updated_at: 2026-08-23
---

# P2-019: Quarantine obsolete prerelease authority

## Objective

Remove the obsolete local path that can create and push upstream release
branches or tags and recursively publish workspace packages. Preserve the
authoring-fork to upstream-projection workflow and the trusted Pipeline 2.0.0
publication authority unchanged.

## Acceptance criteria

- Invoking `scripts/workflow/prerelease.ts` fails closed before reading or
  mutating repository state.
- The retired entry point cannot create commits or tags, push any ref, publish
  any package or stash/switch a dirty checkout.
- Its diagnostic names the supported authoring PR, synchronisation and trusted
  Pipeline release paths without implying that ordinary CI owns publication.
- Governing workflow documentation no longer advertises the obsolete flags or
  behaviour.
- A focused execution-level regression proves the entry point is inert and
  rejects representative legacy flags.
- No Pipeline package, release workflow, manifest, tag, archive evidence or
  registry claim changes.

## Verification

Run the focused regression, lint/typecheck the changed TypeScript and test
surface where supported, run workflow policy checks, and review the final diff
against P2-009 and the repository guide. Record review findings before any
commit.

Suggested execution tier: fast implementation with independent balanced
review.

## Handoff

Changed paths:

- `scripts/workflow/prerelease.ts`
- `scripts/workflow/README.md`
- `tests/__tests__/scripts/workflow-prerelease-authority.test.ts`
- `docs/internal/pipeline/tasks/P2-019-prerelease-authority-quarantine.md`

Verification:

- Prettier check passed for all four task-owned paths.
- Targeted ESLint passed for the retired entry point and focused regression.
- The focused regression passed five of five cases: no arguments, help, push,
  publish and the complete representative legacy flag set.
- `@wpkernel/core` test typechecking passed.
- Task Graph planning retained P2-019 as the only active Pipeline task before
  review.
- Task-owned `git diff --check` passed.
- Independent balanced review found no P1 or P2 defects.

The repository has no installed workflow-policy checker such as actionlint or
zizmor. That check is recorded as not applicable because
`.github/workflows/publish-pipeline.yml` is unchanged, not as a green result.
Pipeline package sources, manifests, release workflow, published archive
evidence and registry claims are unchanged. Separate dirty CLI files remain
outside this task's write scope and were preserved.
