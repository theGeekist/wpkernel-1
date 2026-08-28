# PHP and WordPress JSON AST programme

Architecture version: 1
Task contract version: 1
Project manifest schema: 1
Planner output schema: 1

This directory owns the internal engineering authority for the generic PHP
compiler, WordPress semantic adoption, CLI migration and runtime qualification.

- [`authoring-roadmap.md`](authoring-roadmap.md) preserves the technical
  rationale, recovered evidence and original milestone detail.
- [`ROADMAP.md`](ROADMAP.md) groups continuing work and shows dependency
  structure. It does not own task state.
- [`STATUS.md`](STATUS.md) is the human-readable task projection.
- [`COORDINATION.md`](COORDINATION.md) defines claims, parallel execution and
  integration.
- [`tasks/`](tasks/) contains the authoritative state, dependencies and file
  ownership for every executable task.
- [`templates/task.md`](templates/task.md) is the canonical task shape.

The project is consumed through the repository-root
[`.taskgraph/project.json`](../../../.taskgraph/project.json). Manifest,
task-brief, plan and architecture versions are independent from package
release versions. Increment each only when its own compatibility contract
changes.
