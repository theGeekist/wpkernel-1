# Repository workflow helpers

These scripts automate promotion from the working repository to the release
repository without permitting direct release-repository pushes.

## prepare-upstream-pr.sh

```
scripts/workflow/prepare-upstream-pr.sh
```

- Fetches `${FORK_REMOTE:-origin}`/`${FORK_BRANCH:-main}` and `${UPSTREAM_REMOTE:-upstream}`/`${UPSTREAM_BRANCH:-main}`.
- Requires authoring main to contain upstream main. Synchronise the fork first if it does not.
- Creates a scratch branch (defaults to `pr/<date>-main`) at the exact published authoring-main revision, then pushes it to the fork and optionally opens a PR via `gh pr create`.

The PR head must remain an already-published authoring-main commit. This gives
the promoted documentation workflow an exact `main` push CI receipt for the
source it builds. Curate commits on authoring main before pushing them. Do not
rebase, squash or add commits only to an open `pr/*` branch.

## update-upstream-pr.sh

```
PR_BRANCH=pr/<existing-pr> scripts/workflow/update-upstream-pr.sh
```

After review, commit and push the correction to `origin/main`, wait for its
main-push CI, then use this helper to fast-forward the existing PR branch. It
refuses a divergent PR branch and pushes only the exact authoring-main revision.

## sync-fork-main.sh

```
scripts/workflow/sync-fork-main.sh
```

- After a release PR is merged or squashed, run this to reconcile working
  `main` with release `main`.
- It validates the exact working and release repository URLs, fetches those
  immutable destinations, and adopts exact SHAs through compare-and-swap ref
  updates. Local-only or concurrently changed history is preserved and stops
  the operation.
- Commits absent from the release repository are curated on the named
  `wpkernel-sync-candidate` branch. If conflict resolution pauses the rebase,
  finish it and run with `SYNC_RECOVERY=complete` to record the workflow-owned
  completion witness and resume adoption. `SYNC_RECOVERY=resume` retries an
  already witnessed candidate; `SYNC_RECOVERY=abort` removes only
  workflow-owned recovery state.
- The final update targets the validated working-repository URL with an exact
  candidate SHA and explicit lease. The script never pushes to the release
  repository.
- `FORK_BRANCH` and `UPSTREAM_BRANCH` remain configurable. The
  repository identities are deliberately fixed by the safety contract.

## prerelease.ts

```
pnpm exec tsx scripts/workflow/prerelease.ts [options]
```

- Automates the hand-rolled prerelease flow directly on `${UPSTREAM_REMOTE:-upstream}/${UPSTREAM_BRANCH:-main}`.
- Computes the next semver (defaults to `prerelease` bumps with `beta` preid, use `--mode patch` for patch+beta.0) and fans it out to every workspace via `scripts/release/bump-version.ts`.
- Re-runs `pnpm docs:build` if the previous attempt failed so you can fix docs and resume without inventing a new semver.
- Creates the release commit + tag locally on a temporary branch cloned from `${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`, and optionally pushes (`--push`) and publishes to npm (`--publish`, uses `--publish-tag` or the preid).
- Automatically stashes your current fork work (if dirty), switches to the upstream branch for the release, then restores your original branch and reminds you to `git stash pop` when finished.
- Stores the target semver in `.release-next-version` until the workflow completes so reruns stay idempotent.

Common flags:

```
--mode <prerelease|patch>   # default prerelease
--preid <beta>              # prerelease identifier
--remote <upstream>         # remote to push/tags
--branch <main>             # branch tracking upstream
--push                      # push branch + tag to upstream when done
--publish                   # pnpm -r publish --tag <preid>
--publish-tag <tag>         # override npm dist-tag (default preid)
--version <semver>          # explicitly set the next version/resume
```

Promotion targets `theGeekist/wpkernel-1`; release PRs target
`wpkernel/wpkernel`. Do not push directly to the release repository.
