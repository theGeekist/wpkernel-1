# Pipeline external evidence lanes

Architecture version: 1
Role: non-blocking ecosystem evidence outside the Pipeline v2 task authority

## Task Graph compatibility baseline

Status: package boundary qualified; downstream tooling update pending

- `@wpkernel/pipeline@1.4.1` was published from the trusted upstream workflow.
- `@geekist/task-graph@0.1.0-beta.2` was qualified against that exact version.
- The published Task Graph manifest declares Pipeline 1.4.1 directly.
- WPKernel pins Task Graph 0.1.0-beta.2 without an override.

This baseline proves the published dependency boundary: Task Graph beta.2 asks
for and receives exact Pipeline 1.4.1 under normal package resolution. P2-016
is the WPKernel workspace bridge. It keeps first-party library and documentation
builds on intentional local source aliases while leaving the root runtime
context on normal package resolution, so installed and transitive consumers
receive the package versions selected by their own dependency graphs.

The narrow compiled Task Graph beta.3 line retains exact Pipeline 1.4.1 and
bundles that implementation into its Node CLI. It plans this repository's real
manifest without resolving the local v2 root. Publishing and pinning beta.3 is
a downstream tooling update after P2-016, not the workspace resolution bridge,
a P2-007 dependency or a Pipeline 2.0.0 release gate.

## llm-core specification compiler

Status: proposed in the llm-core repository

The specification compiler should replace its non-semantic Pipeline wrapper
with direct `MaybePromise` composition after P2-001 freezes the semantic
contract. That migration must preserve synchronous settlement and the
asynchronous authority recheck.

The work belongs to llm-core and carries its own repository evidence. It is not
an acceptance criterion for P2-007 or Pipeline 2.0.0 publication.
