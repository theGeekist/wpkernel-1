# AST task status

Architecture version: 1
Projection contract: task front matter under [`tasks/`](tasks/)
Updated: 2026-08-17

## Completed recovery work

- `authoring-foundation-hardening`: done, with package tests and typecheck.
- `wordpress-mutation-hardening`: done, with WordPress and downstream CLI
  snapshot qualification.
- `cli-admin-generation-hardening`: done, with generator tests and CLI
  typecheck.

No implementation task currently holds an active write scope.

## Ready parallel frontier

- `authoring-declarations-contract-v1`
- `source-bridge-contract-v1`
- `cli-migration-contract-v1`
- `qualification-contracts-v1`

Each owns one task brief and one separate versioned contract document. No
ready-frontier task owns package source, shared exports, manifests, lockfiles or
generated output.

## Projection rule

This file is a readable projection, not lifecycle authority. Task front matter
is authoritative. Update this projection only during coordinator integration,
after checking active scopes and the planner result.
