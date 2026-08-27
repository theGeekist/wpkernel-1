# AST task status

Architecture version: 1
Projection contract: task front matter under [`tasks/`](tasks/)
Updated: 2026-08-25

## Completed recovery work

- `authoring-foundation-hardening`: done, with package tests and typecheck.
- `wordpress-mutation-hardening`: done, with WordPress and downstream CLI
  snapshot qualification.
- `cli-admin-generation-hardening`: done, with generator tests and CLI
  typecheck.
- `authoring-declarations-contract-v1`: done, with PR feedback incorporated for
  PHP type and documentation-collision semantics and host parser evidence.
- `cli-migration-contract-v1`: done, with PR feedback incorporated for
  staged-plan, canonical-path and target-record invariants.

No implementation task currently holds an active write scope.

## Ready parallel frontier

- `source-bridge-contract-v1`
- `qualification-contracts-v1`

Each owns one task brief and one separate versioned contract document. No
ready-frontier task owns package source, shared exports, manifests, lockfiles or
generated output.

The completed contracts also make `authoring-declarations-v1` and
`cli-codemod-repair-v1` lifecycle-ready. Their high-priority implementation
lanes remain behind the two critical contract tasks above.

## Projection rule

This file is a readable projection, not lifecycle authority. Task front matter
is authoritative. Update this projection only during coordinator integration,
after checking active scopes and the planner result.
