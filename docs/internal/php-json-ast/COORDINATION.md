# AST task coordination

Architecture version: 1
Task contract version: 1

## Selection

Run the configured task planner before claiming work. A task may start only
when `canStart=true`, its declared dependencies are done, no higher-priority
frontier suppresses it, its write scope is clean apart from its own task brief,
and it does not overlap active work.

The primary checkout is the default. Parallel work in one checkout is expected
when write scopes are disjoint. A dedicated worktree is reserved for work that
is logically disjoint but cannot safely share generated outputs, dependency
state or runtime fixtures.

## Claim and lifecycle

The coordinator owns lifecycle transitions. Workers request them through the
task work log and handoff.

```text
proposed -> ready -> claimed -> in_progress -> review -> done
                         \-> blocked
proposed | ready | blocked -> cancelled
```

Claiming records owner, owner kind, lease, base SHA, branch and checkout. The
brief above `## Work log` is immutable while claimed. Workers may update only
their task front matter, declared write scope, work log and handoff.

## Shared-checkout concurrency

- Compare every candidate against all active `write_scope`, `conflicts_with`,
  generated outputs and current dirty paths.
- One task owns one source or test path. Globs must describe a cohesive slice,
  not reserve a package for convenience.
- `ROADMAP.md`, `STATUS.md`, package manifests, root exports, lockfiles, CI and
  generated API documentation are coordinator surfaces unless a task names one
  explicitly and runs without an overlapping task.
- A worker does not run repository-wide formatting, dependency installation,
  documentation generation, commits, release commands or destructive cleanup.
- Cross-task requests are recorded in the handoff. Do not expand a task into a
  concurrent owner’s path.
- Review is a separate ownership pass. The implementer stops editing when the
  task enters `review` unless the coordinator reopens it.

The common task brief and `STATUS.md` are deliberately absent from ordinary
implementation write scopes. This avoids turning coordination metadata into a
false global mutex. The coordinator integrates requested lifecycle updates
after checking all active scopes.

## Versioning

- `architecture_version` versions this programme’s architecture decisions.
- Project manifest `schemaVersion` versions planner/workbench configuration.
- Project manifest `taskSchemaVersion` versions the Markdown task-brief shape.
- Planner JSON has its own output `schemaVersion`.
- Versioned contracts use explicit filenames such as
  `source-bridge-v1.md`; implementations state the exact contract consumed.
- Generated ownership markers, codec envelopes and migration manifests are
  compatibility contracts. A breaking shape requires a new explicit version,
  fixtures for both sides of the boundary and a migration decision.
- Package versions, packed artefacts and runtime matrices are evidence. They do
  not silently advance an architecture or protocol version.

## Handoff

Every active task records:

```text
Execution mode: shared-checkout | dedicated-worktree
Execution rationale: <why this checkout is safe>
Concurrency evaluation: <active task IDs and overlap result>
Concurrent task scopes: none | <task IDs and disjoint scopes>
Swarm delegation: none | <owner -> delegate: bounded output>
```

The handoff includes changed paths, exact verification commands and results,
behaviour or contract changes, remaining risk and the recommended next task.
