# AST task status

Architecture version: 1
Projection contract: task front matter under [`tasks/`](tasks/)
Updated: 2026-08-13

## Current execution

- `authoring-foundation-hardening`: review, owns the existing generic authoring
  and codec safety corrections.
- `wordpress-mutation-hardening`: review, owns the current WP-post mutation
  correctness corrections.
- `cli-admin-generation-hardening`: review, owns the current generated admin
  capability and form corrections.

These scopes are disjoint. They may coexist in the primary checkout.

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
