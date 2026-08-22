# Repository workflow helpers

These scripts automate promotion from the working repository to the release
repository without permitting direct release-repository pushes.

## prepare-upstream-pr.sh

```
scripts/workflow/prepare-upstream-pr.sh
```

- Fetches `${FORK_REMOTE:-origin}`/`${FORK_BRANCH:-main}` and `${UPSTREAM_REMOTE:-upstream}`/`${UPSTREAM_BRANCH:-main}`.
- Shows the commits unique to the fork and then launches a standard `git rebase -i upstream/main` so you can curate what goes into the PR.
- Creates a scratch branch (defaults to `pr/<date>-main`), pushes to your fork, and optionally opens a PR via `gh pr create`.

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

## prerelease.ts retirement

`prerelease.ts` is permanently quarantined. It exits before reading or
mutating repository state, including when passed its former flags. It cannot
create commits or tags, push refs, publish packages, or stash or switch work.

Use `prepare-upstream-pr.sh` for the authoring-fork to upstream pull request,
`sync-fork-main.sh` to synchronise the fork after the upstream merge, and the
trusted Pipeline release workflow for packed qualification and publication.
