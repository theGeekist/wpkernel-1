# Pipeline external evidence lanes

Architecture version: 1
Role: non-blocking ecosystem evidence outside the Pipeline v2 task authority

## Task Graph compatibility baseline

Status: complete

- `@wpkernel/pipeline@1.4.1` was published from the trusted upstream workflow.
- `@geekist/task-graph@0.1.0-beta.2` was qualified against that exact version.
- The published Task Graph manifest declares Pipeline 1.4.1 directly.
- WPKernel pins Task Graph 0.1.0-beta.2 without an override.

This baseline proves the active planner no longer executes Pipeline 1.2.1. It
does not make Task Graph a Pipeline v2 release dependency.

## llm-core specification compiler

Status: proposed in the llm-core repository

The specification compiler should replace its non-semantic Pipeline wrapper
with direct `MaybePromise` composition after P2-001 freezes the semantic
contract. That migration must preserve synchronous settlement and the
asynchronous authority recheck.

The work belongs to llm-core and carries its own repository evidence. It is not
an acceptance criterion for P2-007 or Pipeline 2.0.0 publication.
