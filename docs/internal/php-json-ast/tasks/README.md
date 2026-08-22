# AST task briefs

Each file is the authoritative record for one bounded task. Programme grouping
lives in [`../ROADMAP.md`](../ROADMAP.md); execution and integration rules live
in [`../COORDINATION.md`](../COORDINATION.md).

## Lifecycle and vocabulary

```text
proposed -> ready -> claimed -> in_progress -> review -> done
                         \-> blocked
proposed | ready | blocked -> cancelled
```

Use only these values:

- `stage`: `baseline`, `contract`, `authoring`, `source`, `wordpress`, `cli`,
  `qualification`, `integration`, `release`;
- `status`: `proposed`, `ready`, `claimed`, `in_progress`, `review`, `blocked`,
  `done`, `cancelled`;
- `priority`: `critical`, `high`, `medium`, `normal`;
- owner kinds: `coordinator`, `codex`, `claude-code`.

The task contract is version 1 and uses `architecture_version: 1`. A task has
exact dependencies, conflicts, ordered required reading, read authority and a
non-empty write scope. Paths are repository-relative unless an external
logical mount is explicitly configured.

## Parallel ownership

Write scopes are the executable concurrency contract. Two active tasks may
share a checkout only when their scopes, generated outputs and staging paths
are disjoint. Shared coordination files are updated by the coordinator and are
not included in ordinary worker scopes.

The active work log uses these exact labels:

```text
Execution mode: shared-checkout | dedicated-worktree
Execution rationale: <non-empty explanation>
Concurrency evaluation: <ongoing task IDs or none; start alongside | wait | no concurrency; rationale>
Concurrent task scopes: none | <task IDs and disjoint scopes>
Swarm delegation: none | <parent -> delegate: bounded output>
```

Use [`../templates/task.md`](../templates/task.md) for new tasks.
