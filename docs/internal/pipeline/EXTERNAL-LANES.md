# Pipeline external evidence lanes

Architecture version: 1
Role: non-blocking ecosystem evidence outside the Pipeline v2 task authority

## Task Graph compatibility baseline

Status: baseline complete; workspace tooling bridge pending

- `@wpkernel/pipeline@1.4.1` was published from the trusted upstream workflow.
- `@geekist/task-graph@0.1.0-beta.2` was qualified against that exact version.
- The published Task Graph manifest declares Pipeline 1.4.1 directly.
- WPKernel pins Task Graph 0.1.0-beta.2 without an override.

This baseline proves the published dependency boundary: Task Graph beta.2 asks
for and receives exact Pipeline 1.4.1 under normal package resolution. Its raw
TypeScript CLI fails only when installed beneath WPKernel because Bun applies
WPKernel's global `@wpkernel/pipeline` source mapping and substitutes the local
v2 root.

The narrow compiled Task Graph beta.3 line retains exact Pipeline 1.4.1 and
bundles that implementation into its Node CLI. It plans this repository's real
manifest without resolving the local v2 root. Publishing and pinning beta.3 is
therefore the workspace-tooling bridge before the next governed claim, not a
P2-007 or Pipeline 2.0.0 runtime dependency. The remaining declaration mapping
sharp edge is tracked by P2-016.

## llm-core specification compiler

Status: proposed in the llm-core repository

The specification compiler should replace its non-semantic Pipeline wrapper
with direct `MaybePromise` composition after P2-001 freezes the semantic
contract. That migration must preserve synchronous settlement and the
asynchronous authority recheck.

The work belongs to llm-core and carries its own repository evidence. It is not
an acceptance criterion for P2-007 or Pipeline 2.0.0 publication.
