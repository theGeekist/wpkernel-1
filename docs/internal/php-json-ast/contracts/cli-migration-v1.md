# CLI migration and ownership contract v1

Contract version: 1
Architecture version: 1
Status: frozen for implementation

## 1. Purpose and authority

This contract defines the compatibility boundary for a WPKernel CLI migration
performed by `generate` and `apply`. It freezes four things that must move
together:

1. target discovery;
2. generated versus user ownership;
3. the durable, machine-readable migration result; and
4. repeat, conflict and interruption behaviour.

It applies to the CLI migration path only. It does not change the compiler
dependency direction:

```text
wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast
```

The CLI may consume compiler output and WordPress artefact metadata, but neither
`php-json-ast/ast` nor `php-json-ast/authoring` may depend on the CLI, a
workspace, a migration manifest or WordPress.

This is an exact v1 contract. A reader must reject an unsupported contract or
schema version rather than guessing at its meaning. A changed marker grammar,
terminal-state vocabulary or manifest shape requires a new contract version and
fixtures on both sides of the migration boundary.

## 2. Terms

| Term                   | Meaning                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **invocation**         | One `generate` or `apply` execution, identified by `invocationId`.                                                                                    |
| **declared target**    | A path explicitly supplied through the PHP codemod configuration. A declaration is not evidence that the path exists.                                 |
| **resolved target**    | A declared target that normalises to one regular, workspace-contained file.                                                                           |
| **migration target**   | A separately reported source or workspace path whose outcome can affect the migration. It has exactly one terminal target state in an emitted result. |
| **base**               | The last successful generator-owned bytes for a target, retained only after a clean apply.                                                            |
| **incoming**           | The candidate bytes produced for the current invocation before they are applied.                                                                      |
| **current**            | The bytes found at the target path immediately before the operation that would change it.                                                             |
| **guarded region**     | The bytes strictly between a valid WPK auto-guard begin and end marker.                                                                               |
| **generated artefact** | A file whose complete path is recorded as generated in the last valid generation state.                                                               |
| **user-owned bytes**   | Bytes outside a valid guarded region, or bytes in a path without valid generated ownership.                                                           |
| **recovery journal**   | The durable invocation record retained while an apply has not reached a terminal result. It is not a successful migration manifest.                   |

All paths in this contract are POSIX-style paths relative to the resolved
workspace root. In v1 the resolved workspace root is the repository root;
configuration that selects a nested or external workspace root is unsupported
and fails preflight. Discovery, staged-plan persistence and apply therefore
resolve every canonical path against the same root. Paths must be non-empty,
normalised, and must not escape that root through `..`, an absolute path, a
symlink, or a platform-specific spelling.

## 3. Version inputs and outputs

Every migration result carries these independent versions:

| Field                           | Meaning                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `contractVersion`               | This ownership and migration contract. Its v1 value is `1`.                                         |
| `schemaVersion`                 | The migration-manifest JSON shape. Its v1 value is `1`.                                             |
| `source.cliVersion`             | The CLI version that last successfully produced the authoritative base, if known; otherwise `null`. |
| `source.generationStateVersion` | The version of the prior generation state, if known; otherwise `null`.                              |
| `target.cliVersion`             | The executing CLI package version. It must be a non-empty exact package version.                    |
| `target.generationStateVersion` | The generation-state version the executing CLI writes.                                              |
| `ownership.markerVersion`       | The recognised ownership marker grammar. Its v1 value is `1`.                                       |

For the recovered v1 fixture corpus, the known released source is `0.11.0`, the
known beta source and target is `0.12.6-beta.3`, and generation state is version
`1`. Those values are fixture evidence, not a licence to infer a missing source
version in a real workspace.

If a prior version cannot be established from a valid durable state, the CLI
must emit `null`; it must not substitute the currently installed CLI version.

## 4. Target discovery

### 4.1 Activation

PHP codemod migration is requested when the active PHP adapter contains a
`codemods` configuration object. Its absence means ordinary generation and is
not a migration invocation. A present `codemods` object with no `files` member,
an empty `files` array, or an array containing no non-empty declarations is an
explicit but invalid migration request. It fails with
`empty-target-declaration`; it is not ordinary generation and not a successful
no-op.

When migration is requested, discovery happens before a PHP runner is started,
before source ingestion, and before a generated target is changed.

### 4.2 Resolution algorithm

For each declared target, the CLI must:

1. trim and normalise the configured relative path;
2. reject empty, absolute, root-escaping, directory and symlink targets, and
   classify duplicate declarations without resolving or running them twice;
3. resolve it beneath the workspace root without following a path outside that
   root;
4. verify that it exists and is a regular file; and
5. sort the resulting canonical relative paths bytewise before invoking the
   runner.

Duplicate declarations name one logical target. The first declaration supplies
the target identity; later occurrences are recorded in the `discovery`
occurrence report with `state: "duplicate"` and reason
`duplicate-declaration`. They do not create target records and do not cause
repeated execution.

Target identity is deterministic for every permitted target kind:

```text
targetId = kind + ":" + canonicalWorkspaceRelativePath
```

where `kind` is exactly one of `source`, `generated`, `shim`, `plugin-loader`,
`runtime`, `block`, or `state`. A target kind and canonical path can occur at
most once in `targets`. Non-source targets are writable mutation targets and
must also be unique by canonical path across all kinds; a staged plan that maps
two roles or kinds to one writable path fails validation before any write.

No glob, directory expansion or arbitrary file-system discovery is implicit in
v1. A later version may add a separate target-selection grammar, but must not
reinterpret a v1 path as a glob.

### 4.3 Discovery failure

A requested migration fails preflight when no regular target is resolved, or
when any non-duplicate declaration is invalid or missing. The CLI must not run
the PHP ingestion process against a subset and report success.

For a failed preflight:

- each invalid or missing declaration receives a `discovery` occurrence with
  `state: "failed"` and its exact reason;
- each otherwise resolvable declaration receives a `discovery` occurrence with
  `state: "skipped"` and reason `discovery-failed`;
- each unique resolved target receives one `targets` record with
  `state: "skipped"` and reason `discovery-failed`;
- the invocation result is `failed` with diagnostic
  `migration-target-discovery-failed`; and
- no source ingestion, generated-target write, apply-state update or base
  snapshot update occurs.

An invalid explicit empty declaration produces an invocation failure with reason
`empty-target-declaration` and an empty `targets` array. A non-empty declaration
set from which no regular target resolves produces
`no-targets-resolved`, likewise with an empty `targets` array. Neither is a
successful no-op.

## 5. Ownership and auto-guard semantics

### 5.1 Recognised v1 markers

The only v1 ownership markers are PHP line comments containing these exact
tokens:

```php
// WPK:BEGIN AUTO
// WPK:END AUTO
```

Whitespace before `//` and after the token is permitted. The token must be the
complete non-whitespace comment payload. Text in a PHP string, heredoc, docblock
or another comment form is not a marker. A recogniser must parse enough PHP
lexical structure to make that distinction; a raw substring search is not
sufficient.

The generated-file docblock phrases `AUTO-GENERATED by WPKernel CLI` and
`Edits between WPK:BEGIN AUTO and WPK:END AUTO will be overwritten` are
informational only. They neither create ownership nor repair malformed markers.

### 5.2 Validity and scope

A v1 guarded region has exactly one begin marker followed later by exactly one
end marker in the same file. Nested, repeated, reversed, unmatched or
lexically-invalid markers make the file `marker-invalid`.

The two marker lines and the bytes strictly between them are generator-owned.
All other bytes, including a plugin header and code after the end marker, remain
user-owned. A valid marker does not grant ownership of the whole file.

`WPK:BEGIN AUTO` and `WPK:END AUTO` are stable compatibility tokens. v1 output
must continue emitting those spellings even when the compiler path changes.

### 5.3 File classification

Before an apply can write, delete or replace a target, it classifies the target
as exactly one of the following:

| Classification            | Required evidence                                                                                                                     | Permitted v1 action                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `generated-file`          | Path is in a valid prior generation state as a generated artefact and its recorded base matches current bytes.                        | Replace or remove only through a clean planned migration.                                |
| `guarded-file`            | One valid guard pair is present.                                                                                                      | Change only the guarded region through a clean merge.                                    |
| `absent-target`           | The planned generated path does not exist and has no contrary ownership evidence.                                                     | Create it only when the exact staged plan declares a generated artefact at that path.    |
| `user-file`               | No valid generated-file evidence and no valid guard pair.                                                                             | Do not create, replace or delete it. Report a conflict if migration needs to change it.  |
| `modified-generated-file` | Generated-file or guarded-file evidence exists, but current bytes differ from the recorded base outside an independently clean merge. | Three-way merge only; unresolved overlap is a conflict.                                  |
| `marker-invalid`          | Any malformed, duplicate, nested, reversed or unmatched marker.                                                                       | Do not write, delete or repair it. Report a conflict.                                    |
| `state-invalid`           | Required generation state, base snapshot or path evidence is absent, malformed or version-incompatible.                               | Do not treat the file as generated. Report a conflict or failed preflight as applicable. |

Generated state alone is not permission to overwrite a newly user-owned path.
The current bytes must still be reconciled with the recorded base. Likewise,
the existence of a guard does not authorise changing user-owned bytes outside
that guard.

## 6. Migration result manifest

The implementation task creates the artefact at the versioned migration-manifest
location. It must not overload the existing patch-plan or patch-result files:
they have different lifetimes and semantics.

One emitted manifest describes one invocation outcome. Apart from the
non-mutating `recovery-required` refusal, it describes a terminal invocation.
It is deterministic apart from `invocationId` and timestamps: target records
are ordered by `targetId`, diagnostics by `(targetId, code)`, and object keys
are emitted in the order shown below.

```json
{
	"schemaVersion": 1,
	"contractVersion": 1,
	"invocationId": "uuid-or-equivalent-unique-id",
	"command": "generate",
	"outcome": "succeeded",
	"source": {
		"cliVersion": "0.11.0",
		"generationStateVersion": 1
	},
	"target": {
		"cliVersion": "0.12.6-beta.3",
		"generationStateVersion": 1
	},
	"ownership": {
		"markerVersion": 1,
		"begin": "WPK:BEGIN AUTO",
		"end": "WPK:END AUTO"
	},
	"discovery": [
		{
			"occurrenceId": "declaration:0",
			"configuredPath": "plugin.php",
			"canonicalPath": "plugin.php",
			"targetId": "source:plugin.php",
			"state": "resolved",
			"reason": null
		}
	],
	"targets": [
		{
			"targetId": "source:plugin.php",
			"path": "plugin.php",
			"kind": "source",
			"state": "unchanged",
			"reason": "no-op",
			"ownership": "guarded-file",
			"observation": {
				"existence": "present",
				"readability": "readable",
				"observedSha256": "lowercase-hex-sha256"
			},
			"terminalObservation": {
				"existence": "present",
				"readability": "readable",
				"observedSha256": "lowercase-hex-sha256"
			},
			"beforeSha256": "lowercase-hex-sha256-or-null",
			"afterSha256": "lowercase-hex-sha256-or-null",
			"diagnosticIds": []
		},
		{
			"targetId": "generated:.wpk/generate/php/Rest/JobController.php",
			"path": ".wpk/generate/php/Rest/JobController.php",
			"kind": "generated",
			"state": "changed",
			"reason": "generated",
			"ownership": "generated-file",
			"observation": {
				"existence": "absent",
				"readability": "not-applicable",
				"observedSha256": null
			},
			"terminalObservation": {
				"existence": "present",
				"readability": "readable",
				"observedSha256": "lowercase-hex-sha256"
			},
			"beforeSha256": null,
			"afterSha256": "lowercase-hex-sha256",
			"diagnosticIds": []
		}
	],
	"diagnostics": [],
	"pendingRecovery": null,
	"stagedPlan": {
		"schemaVersion": 1,
		"path": ".wpk/migration/v1/invocations/example/plan.json",
		"sha256": "lowercase-hex-sha256",
		"entries": [
			{
				"targetId": "generated:.wpk/generate/php/Rest/JobController.php",
				"role": "resource-generated",
				"action": "write",
				"incomingPath": ".wpk/migration/v1/invocations/example/incoming/JobController.php",
				"incomingSha256": "lowercase-hex-sha256"
			}
		]
	},
	"startedAt": "RFC-3339 timestamp",
	"completedAt": "RFC-3339 timestamp"
}
```

All illustrated fields are required. `beforeSha256` and `afterSha256` are
nullable when the target was not readable or did not exist. A v1 reader must
reject missing required fields, unknown enum values, duplicate `targetId` or
`occurrenceId` values, non-canonical paths, non-canonical digest spellings, and
unknown fields at every object level. `diagnosticIds` must refer to a diagnostic
in the same manifest.

`stagedPlan` is required. It is `null` only for a failed preflight or a
`recovery-required` refusal. Otherwise it has the exact shape shown above:
`schemaVersion` is `1`; `path` is the canonical workspace-relative path to one
regular staged-plan JSON file; `sha256` is the lowercase SHA-256 of its exact
UTF-8 bytes; and `entries` is sorted by `targetId` with one entry for every
non-source target that apply may write or delete. Every staged-plan entry has
exactly one target record with the same `targetId`, kind and canonical path,
and every non-source target planned for write or deletion has exactly one
staged-plan entry. An entry has one of:

- `action: "write"`, an explicit `role`, a canonical workspace-relative
  regular-file `incomingPath`, and the lowercase SHA-256 of those exact
  incoming bytes; or
- `action: "delete"`, the prior artefact's explicit `role`,
  `incomingPath: null`, and `incomingSha256: null`.

`path` and every non-null `incomingPath` must be non-empty, normalised POSIX
paths beneath the repository root, with no absolute spelling, `.` or `..`
segments, symlink traversal or duplicate entry. They are subject to the normal
canonical-path invariant, unlike `discovery.configuredPath`. Apply must reject
the manifest unless it verifies the staged-plan digest, parses an exact v1 plan,
matches every plan entry to its manifest entry, and verifies every incoming file
digest before reading its bytes. It then consumes only those verified bytes;
console output, a current patch plan or a regenerated payload is never an
acceptable substitute.

`discovery` reports configuration occurrences, not mutation targets. Its
`occurrenceId` is `declaration:` plus the zero-based configured-array index.
`configuredPath` is raw diagnostic input: it serialises the configured JSON
value exactly as supplied, is never normalised or used for file-system access,
and is explicitly exempt from every canonical-path invariant in this contract.
`canonicalPath` and `targetId` are `null` when no safe canonical target exists.
Its state is exactly `resolved`, `duplicate`, `skipped`, or `failed`. `reason`
is `null` only for a resolved occurrence. A duplicate occurrence points to the
first occurrence's target ID. This separates duplicate configuration diagnostics
from `targets`, whose IDs must remain unique.

Every target has a required `observation`. `existence` is `present`, `absent`,
or `unreadable`; `readability` is `readable`, `unreadable`, or
`not-applicable`. The only valid combinations are `(present, readable)`,
`(absent, not-applicable)`, and `(unreadable, unreadable)`. `observedSha256` is
required only for `(present, readable)` and is otherwise `null`. An unreadable
path is not an absent target and must never be treated as creatable, removable,
or a safe recovery match.

Every terminal target record also has a required `terminalObservation` with the
same exact shape and combinations. `observation` records the pre-operation
state; `terminalObservation` records the state after that target's terminal
outcome. A no-op, skip, failure or unresolved conflict normally repeats the
pre-operation observation. A successful deletion has
`terminalObservation: { "existence": "absent", "readability": "not-applicable", "observedSha256": null }`.

Each `diagnostics` entry has this exact shape:

```json
{
	"id": "diagnostic:unique-within-invocation",
	"code": "stable-machine-code",
	"severity": "error",
	"targetId": "source:plugin.php",
	"message": "Human-readable explanation"
}
```

`id`, `code` and `message` are non-empty strings. `severity` is `error` or
`warning`; `targetId` is either `null` or an entry in `targets`. An `error`
diagnostic is required for every `failed` target and for every invocation whose
`outcome` is `failed` or `recovery-required`.

`pendingRecovery` is `null` unless `outcome` is `recovery-required`. For that
outcome it has the exact shape below, and `targets` must be an empty array:

```json
{
	"journalId": "durable-journal-identity",
	"journalTargetIds": ["generated:inc/Rest/JobController.php"]
}
```

`journalId` is a non-empty opaque identifier and `journalTargetIds` is a sorted,
unique non-empty list of target IDs found in the durable journal. These are
pending-journal references, not manifest target records. Consequently a
recovery-required refusal does not claim non-terminal targets and does not
violate the terminal-state rule below.

`command` is `generate` or `apply`. `kind` is one of `source`, `generated`,
`shim`, `plugin-loader`, `runtime`, `block`, or `state`. The implementation may
not introduce a new kind under schema version 1. `ownership` is exactly one of
`generated-file`, `guarded-file`, `absent-target`, `user-file`,
`modified-generated-file`, `marker-invalid`, or `state-invalid`.

Configured `codemods.files` declarations create only `source` discovery targets
with IDs `source:<canonicalPath>`. They do not directly name generated or apply
targets. Generation must derive every later target from an explicit
`stagedPlan.entries` record whose `targetId` uses the kind-and-path formula in
section 4.2. Its kind is declared by the persisted generation artefact role,
never guessed from an extension or directory.

The exact persisted role values and their kinds are:

| Persisted role       | Required kind   |
| -------------------- | --------------- |
| `resource-generated` | `generated`     |
| `php-index`          | `generated`     |
| `resource-shim`      | `shim`          |
| `plugin-loader`      | `plugin-loader` |
| `runtime-generated`  | `runtime`       |
| `runtime-applied`    | `runtime`       |
| `block-generated`    | `block`         |
| `block-applied`      | `block`         |
| `generation-state`   | `state`         |
| `migration-result`   | `state`         |
| `staged-plan`        | `state`         |
| `recovery-journal`   | `state`         |

The generator persists the role on every staged-plan entry and validates that
the role maps to the entry target ID's kind before it emits the migration
result. The canonical path encoded after the target ID's first `:` must equal
the matching target record's `path`, and each entry's `(role, kind, path)`
triplet is part of the staged-plan digest. Apply consumes that persisted and
validated triplet; it never infers classification from a path, extension or
directory. A deletion preserves the exact role, kind and canonical path
recorded for the prior artefact.

`outcome` is one of:

| Outcome             | Meaning                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `succeeded`         | Every target is `changed`, `unchanged` or an allowed `skipped` state.                                                                                 |
| `conflicted`        | At least one target is `conflicted`; no target is `failed`.                                                                                           |
| `failed`            | Discovery, validation, runner, persistence or recovery failed. A failed invocation is never presented as successful, even if earlier targets changed. |
| `recovery-required` | A durable non-terminal journal exists and the caller did not explicitly resume recovery. No new migration work was started.                           |

For every outcome other than `recovery-required`, each target has exactly one
terminal `state`:

| State        | `generate` meaning                                                                                   | `apply` meaning                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `changed`    | A materially different plan or incoming payload was produced for the target.                         | Target bytes changed and the base snapshot was advanced.                                       |
| `unchanged`  | The regenerated plan and incoming payload are byte-equivalent to the existing authoritative version. | Current bytes already equal incoming bytes, or a recovered completed write is byte-equivalent. |
| `skipped`    | The target was deliberately not processed.                                                           | The target was deliberately not changed.                                                       |
| `conflicted` | Ownership, marker or content reconciliation requires user judgement.                                 | Ownership, marker or three-way reconciliation requires user judgement.                         |
| `failed`     | Target-specific validation or runner work failed.                                                    | Target-specific validation, write, persistence or recovery work failed.                        |

Valid v1 `changed` reasons are `generated`, `applied`, `merged`, and
`recovered`. Valid v1 `unchanged` reasons are `no-op` and `recovered`. Valid v1
`skipped` reasons are `discovery-failed`, `not-applicable`, `missing-target`,
`guarded-by-plan`, and `already-absent`. `duplicate-declaration` is valid only
on a `discovery` occurrence and never on a target record.
`conflicted` must give one of `user-owned-target`, `marker-invalid`,
`state-invalid`, `three-way-overlap`, `interrupted-ambiguous`, or
`legacy-conflict-marker`. `failed` must use its specific diagnostic code as the
reason, not a console-only error string.

The manifest is an outcome record, not a log. Human-readable console summaries
and append-only apply logs may refer to its `invocationId`, but cannot replace
it or collapse `conflicted` or `failed` into success.

## 7. Generate and apply rules

### 7.1 Generate

After successful discovery, `generate` runs the configured PHP ingestion once
with the sorted resolved targets. A non-zero runner exit, malformed ingestion
record, missing required output, or target-level validation error produces a
`failed` result. It must include stderr or structured diagnostics by reference,
without treating partial ingestion as a successful migration.

Generate may write only staging artefacts and a recovery journal until every
target has been classified. It must not update a base snapshot merely because
incoming bytes were produced. It emits one terminal migration result only after
the plan and all referenced staging artefacts are durably available.

### 7.2 Apply

`apply` consumes the exact v1 migration result and its referenced staged plan.
It must reject a missing, malformed, non-v1, failed, conflicted, or incomplete
generate result. It may not recreate or reinterpret an incoming payload from
console output or an unversioned patch plan.

For each planned write, apply compares `(base, current, incoming)`:

1. if `current === incoming`, record `unchanged` with `no-op` and do not
   rewrite the file;
2. if `current === base`, write incoming and then advance the base snapshot;
   an `absent-target` uses a null base and current value instead;
3. otherwise, perform a three-way merge limited to generator-owned bytes;
4. if that merge is clean, write the merged result and then advance the base
   snapshot to the corresponding generator-owned incoming bytes;
5. if it overlaps, is marker-invalid, or reaches user-owned bytes, record
   `conflicted` and leave the target bytes and base snapshot unchanged.

An unresolved v1 conflict must not write conflict markers into a user workspace
target. A proposal may be retained in the invocation staging area for recovery
or review, but it is not an applied file. If a prior implementation already
wrote merge markers, recovery records `legacy-conflict-marker` and never calls
that target clean or unchanged until a user resolves it.

Deletion follows the same ownership checks. A generated target may be deleted
only when current bytes equal its recorded base. A missing target is
`skipped/already-absent`; a modified, user-owned or marker-invalid target is a
conflict and is never removed. A deletion retains the removed artefact's prior
kind and canonical-path target ID: v1 has no separate `delete` target kind.
Its required observation records whether the target was present, absent or
unreadable before deletion.

## 8. Interruption and recovery

Apply is recoverable, not implicitly atomic across a whole workspace. It must
use the following durable ordering for each target:

1. persist the journal with invocation identity, target identity, classification,
   pre-write observation, base digest and incoming digest;
2. write the target only after the journal is durable;
3. persist the target's terminal outcome and any replacement base snapshot;
4. emit the terminal migration manifest only after every target is terminal;
5. remove transient staging only after the terminal manifest has been made
   durable.

If an invocation stops before step 4, its journal remains authoritative for
recovery. A later `apply` without explicit recovery reports
`recovery-required`, emits `targets: []` with `pendingRecovery` journal
references, and makes no new change. Explicit recovery first compares the
recorded observations and digests. Each journal target stores the exact v1
`observation` as `preWriteObservation`, `baseSha256`, `incomingSha256`, and,
after a filesystem mutation, `terminalObservation` plus `terminalSha256`.
`terminalObservation` and `terminalSha256` are absent before a mutation. Once
present, their existence/readability combination and digest must agree; a
successful deletion records an absent terminal observation and a null terminal
digest.

| Re-observed target state                                                                               | Recovery result                                                                    |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `(present, readable)` with digest equal to incoming, and base update absent                            | Record `unchanged` with recovery reason, advance the base snapshot, then continue. |
| Equal to the recorded pre-write observation, including `(absent, not-applicable)`                      | Re-run that target from its durable journal entry.                                 |
| `(present, readable)` with digest equal to recorded terminal target result                             | Re-record the terminal result without rewriting.                                   |
| `(absent, not-applicable)` equal to a recorded absent terminal observation                             | Re-record the successful deletion as `changed/recovered` without deleting again.   |
| `(unreadable, unreadable)`, any changed existence state, another digest, invalid marker, or stale plan | Record `conflicted/interrupted-ambiguous`; do not overwrite.                       |

Recovery never deletes a journal simply because a process restarted, and it
never rolls back a target automatically. A user or later explicit rollback
contract may choose a rollback strategy only after the recorded digests still
match. That is outside v1.

## 9. Repeatability and compatibility fixtures

For the same config, workspace inputs, source and target contract versions:

- the second `generate` must produce byte-equivalent planned payloads and
  `unchanged` target outcomes;
- the second `apply` after a clean apply must not rewrite a target or advance a
  base snapshot;
- a user edit outside a valid guard must survive unchanged;
- a user edit that overlaps a generated change must be `conflicted`, never
  silently overwritten;
- release, current-beta, user-edited, dirty, conflicted, interrupted,
  renamed-resource and removed-resource fixtures remain required compatibility
  cases; and
- source and target version fields must remain visible in every emitted result.

The implementation must add focused fixtures for the v1 manifest shape,
empty-target failure, valid and malformed markers, clean repeat, conflict, and
interrupted recovery. The separate idempotency task owns the full fixture-matrix
execution and packed CLI proof.

## 10. Implementation ownership and dependency hand-off

This contract describes required future behaviour. It does not claim that the
current CLI already has it. The coordinator must make these slices explicit
before admitting implementation work:

1. `cli-codemod-repair-v1` owns one fail-closed resolver and its focused tests.
   It must carry the active PHP adapter's actual `codemods` object through
   `pipeline.builder.ts` into `pipeline.codemods.ts`; the observed construction
   path currently supplies `undefined`, and the helper treats an empty resolved
   list as a no-op. This task must distinguish absent configuration from an
   explicit empty declaration, preserve occurrence information, and reject the
   whole requested migration before invoking ingestion.
2. The coordinator must create `cli-migration-state-provenance-v1`, with
   exclusive ownership of generation-state/base provenance, staged-plan and
   recovery-journal schemas, and the generate-to-state ordering boundary. It
   must define where source CLI version, generation-state version, base digest,
   observation and journal records live. It depends on this contract and must
   finish before manifest or recovery implementation. Existing generation state
   is not silently repurposed as v1 provenance.
3. `cli-migration-manifest-v1` owns migration-result serialization and strict
   schema validation. The coordinator must add dependencies on
   `cli-codemod-repair-v1` and `cli-migration-state-provenance-v1`, and assign
   the versioned migration-manifest location through the layout/manifest
   surface. It must not overload the current patch-plan or patch-result files.
4. The coordinator must create `cli-ownership-safe-apply-v1`, owning the apply
   write and deletion implementation plus its focused tests. It depends on
   state provenance and the manifest contract. It replaces observed whole-file
   three-way writes and conflict-marker writes with guarded-region-safe merging,
   no-write unresolved conflicts, deletion classification, and journal-first
   persistence.
5. `cli-idempotency-v1` depends on both the manifest and ownership-safe apply
   slices. It owns the complete repeat, conflict, deletion and interrupted
   recovery fixture matrix, rather than implementing the production mechanisms.
6. `cli-packed-qualification-v1` remains the packed external CLI proof after
   the preceding behavioural slices are integrated.

No worker may repurpose the current patch manifest, generation state or
append-only apply log as a substitute for the new provenance, journal or
migration-result artefact without the coordinator-owned schema assignment.
