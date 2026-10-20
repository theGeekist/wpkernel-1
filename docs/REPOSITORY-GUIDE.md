# WPKernel repository guide

## Authoring and promotion

Verify the checkout root, remote and dirty state before editing. Public distribution
and documentation deployment live in `wpkernel/wpkernel`. Reviewed authoring work
lands in `theGeekist/wpkernel-1` first. Retain the WordPress framework identity.

For changes affecting documentation deployment (including packages and workspace
manifests), follow this order:

1. Create an authoring branch containing the current upstream work, then open a PR
   into `theGeekist/wpkernel-1:main`. Obtain independent review and passing CI.
2. Merge that authoring PR normally. Wait for successful **push CI on authoring
   main at the resulting commit**; PR CI alone is insufficient.
3. Open the upstream PR from `theGeekist/wpkernel-1:main` into
   `wpkernel/wpkernel:main`. Preserve the reviewed source tree exactly. If either
   main changes, reconcile in authoring, repeat CI and review the resulting diff.
4. Merge the reviewed promotion after its checks pass, then verify upstream
   **Deploy Documentation** succeeds. A green upstream CI run does not certify
   deployment. Retain both source revisions and workflow URLs.

Do not open a deployment-affecting PR from an upstream branch or a fork feature
branch. Deployment requires a real merged authoring receipt, identical Git trees
and successful authoring-main push CI. Do not bypass or manufacture those checks.

The separate **Check documentation promotion source** status uses trusted base
code and read-only PR metadata. Review it before merging; it does not configure
branch protection. Its first adoption is a reviewed bootstrap: a new workflow
cannot certify its own PR before it exists on the trusted default branch.
Only claim that admission ran when its actual workflow receipt is present.

Read the selected package README and its engineering authority before work.
Use [DEVELOPMENT.md](https://github.com/wpkernel/wpkernel/blob/main/DEVELOPMENT.md) for framework setup and commands.

## Pipeline work

Start from [the package README](https://github.com/wpkernel/wpkernel/blob/main/packages/pipeline/README.md), then
[Pipeline engineering authority](https://github.com/wpkernel/wpkernel/blob/main/docs/internal/pipeline/README.md), its
[coordination rules](https://github.com/wpkernel/wpkernel/blob/main/docs/internal/pipeline/COORDINATION.md), the selected
task and named decisions. Task front matter owns status and dependencies.
Run the configured task planner before claiming an implementation task.

Pipeline v2 is a process-local immutable DAG evaluator. Domain policy and persistence remain host-owned. Do not add a second
scheduler, application schema or durable storage engine here.

Host audit records may be captured incrementally during node execution and
must survive failure and compensation. Pipeline's declared effect journal
commits only after graph success; it does not supply durable host audit history,
provider billing, external idempotency or serialisable restart checkpoints.

Preserve synchronous MaybePromise settlement and exact native contracts.
Consumers choose and qualify exact package versions independently. Existing
Pipeline 1.4.1 consumers are not silently migrated by v2 publication.

Keep changes scoped and reviewable. Use focused checks, retain command output
and source revisions, and obtain independent review before merging. No
release or direct-main push is implied by a documentation reconciliation.
Package publication follows [the release task](https://github.com/wpkernel/wpkernel/blob/main/docs/internal/pipeline/tasks/P2-009-packed-qualification-and-release.md)
and the trusted upstream release workflow. Never bypass required checks.
