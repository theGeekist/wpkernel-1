# `@wpkernel/php-json-ast` Authoring and Qualification Roadmap

> **Authority:** This is the canonical monorepo plan for the PHP JSON AST
> compiler, its framework-neutral authoring layer, WordPress adoption, CLI
> repair, and runtime qualification.
>
> **Publishing:** This file is tracked for monorepo coordination but is
> excluded from VitePress by `srcExclude: ['internal/**']`. Public package and
> contributor pages must not link to it.
>
> **Last reviewed:** 2026-07-31
>
> **Overall status:** `G0 — Truth` passed; Wave 1 contract and safety-net work
> is active.

## Decision

WPKernel will make a boundary pivot rather than rewrite its PHP generation
stack.

- `@wpkernel/php-json-ast` remains the generic PHP compiler package.
- The missing middle layer will begin as
  `@wpkernel/php-json-ast/authoring`.
- `@wpkernel/wp-json-ast` remains the WordPress semantic compiler above it.
- Future platform packages may consume the same authoring API without
  depending on WordPress.
- The spike remains in one physical package. A separate authoring or pipeline
  package is considered only after the boundary has been proven by real
  consumers.
- WordPress and browser E2E tests remain monorepo system tests. They do not
  belong inside either AST package.

The target dependency direction is:

```text
wp-json-ast ──► php-json-ast/authoring ──► php-json-ast/ast
future platform packages ────────────────► php-json-ast/authoring

php-json-ast/source ─────────────────────► php-json-ast/ast
php-json-ast/pipeline ──► authoring + source
```

Nothing in `ast` or `authoring` may depend on WPKernel core, reporters,
workspaces, channels, the generic pipeline, the CLI, WordPress, or child
processes.

## Why this plan exists

The original PHP Parser codemod roadmap was introduced in
[PR #202](https://github.com/wpkernel/wpkernel/pull/202). It described a sound
progression from schema parity through ingestion, codemods, analysis,
BuilderFactory generation, and CLI adoption.

That document was later moved or linked under `docs/internal`, then disappeared
from the tracked repository. The current implementation contains substantial
work from that roadmap, but neither its status nor its incomplete adoption is
visible from the package documentation.

The key product gap is now clear: WPKernel has low-level PHP AST primitives and
WordPress-specific generators, but no ergonomic, framework-neutral authoring
surface between them. As a result, short PHP programs require large amounts of
TypeScript node assembly.

## Status vocabulary

Tasks use the following states:

| Status        | Meaning                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| `BACKLOG`     | Defined, but dependencies or scope are unresolved.                             |
| `READY`       | Dependencies are satisfied and the ownership zone is available.                |
| `ACTIVE`      | One owner is implementing the task.                                            |
| `HANDOFF`     | Scoped work and tests are complete; the owner has stopped editing.             |
| `INTEGRATING` | The coordinator is resolving shared surfaces and running gates.                |
| `BLOCKED`     | The exact missing dependency or failing external condition is recorded.        |
| `DONE`        | Integrated and all checkpoint gates for the task pass.                         |
| `REGRESSED`   | Previously implemented behavior is disconnected or no longer proves its claim. |
| `DROPPED`     | Explicitly excluded with a recorded rationale.                                 |

The normal transition is:

```text
BACKLOG → READY → ACTIVE → HANDOFF → INTEGRATING → DONE
                    ↘ BLOCKED
BACKLOG/READY/BLOCKED → DROPPED
```

Only the coordinator may move a task from `HANDOFF` to `DONE`. An agent may own
only one `ACTIVE` task at a time.

Subsystem status must remain precise:

```text
implemented
  → package-verified
  → integrated
  → packed-qualified
  → released
  → production-qualified
```

A single check mark must never represent all six states.

## Current baseline

### Verification snapshot

The review that created this plan recorded:

- `@wpkernel/php-json-ast`: 23 TypeScript suites and 94 tests passed.
- `@wpkernel/wp-json-ast`: 49 suites and 176 tests passed.
- The PHP PHPUnit suite was not runnable because `vendor/bin/phpunit` was
  absent, despite PHPUnit being declared in Composer development dependencies.
- The WordPress/browser Playwright directory configured in
  `playwright.config.ts` contained no matching tracked specs.
- CI explicitly disabled the E2E job.
- Package coverage gates were not all green; passing tests alone are not a
  production qualification.

This snapshot is evidence, not a permanent claim. Every status update must
record the commit SHA, date, commands or workflow URLs, artifact versions, and
open waivers.

### Recovered roadmap status

| Original outcome                          | Current status         | Evidence and correction                                                                                              |
| ----------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| TypeScript/PHP node-shape mapping         | **Partial**            | The TypeScript `PhpName` uses `parts`, while current PhpParser exposes `name`; compatibility conversion is required. |
| Automated schema drift detection          | **Partial**            | The parity test misses union node types, checks only one drift direction, and skips when Composer assets are absent. |
| Composer-backed driver documentation      | **Regressed**          | The central package page and shipped README became placeholders or stale examples.                                   |
| Parse arbitrary PHP into `PhpProgram`     | **Implemented**        | The PHP ingestion entry point and TypeScript consumer exist.                                                         |
| Stream ingestion into the builder channel | **Implemented**        | `consumePhpProgramIngestion` queues parsed programs.                                                                 |
| Shared ingestion fixtures                 | **Implemented**        | Namespace, class, attribute, comment, and codemod fixtures exist.                                                    |
| Visitor registration system               | **Partial**            | The PHP entry point resolves a hardcoded visitor switch rather than a general extension contract.                    |
| Baseline codemod pack                     | **Implemented**        | Name canonicalisation and use sorting exist.                                                                         |
| Before/after AST diagnostics              | **Implemented**        | AST snapshots, summaries, and optional node dumps exist.                                                             |
| NodeFinder analysis                       | **Prototype complete** | Query endpoints and fixtures exist, but have no production consumer.                                                 |
| NodeDumper diagnostics                    | **Implemented**        | Diagnostic dump support exists.                                                                                      |
| BuilderFactory generation                 | **Prototype complete** | The bridge works, but the intent language is class-only and method bodies support only three operations.             |
| CLI codemod adoption                      | **Regressed**          | The normal pipeline registers an empty target list and ignores the advertised adapter configuration.                 |
| Real CLI end-to-end codemod coverage      | **Not complete**       | Existing CLI tests mock the runner and ingestion consumer.                                                           |
| PHP-version targeting and rollout docs    | **Not complete**       | Ingestion always uses the newest supported parser version and the CLI exposes no target version.                     |

### Architectural findings

- `php-json-ast/src/index.ts` wildcard-exports raw AST, pipeline integration,
  process runtime, codemods, queries, and experimental generation through one
  root.
- The package has three competing generation paths: raw builders, the mutable
  program/channel builder, and the BuilderFactory JSON-intent executable.
- The raw builder path is the only one broadly used in production.
- Generic PHP value, expression, statement, and file helpers already exist
  under `wp-json-ast`; they are misplaced rather than speculative.
- Many `wp-json-ast` production files import raw PHP constructors directly.
- Process execution, path resolution, autoload merging, and JSON
  normalisation are duplicated.
- The previous template abstraction maintained PHP source lines and AST at the
  same time. It was correctly removed and must not be recreated.

## Architectural invariants

1. **AST is the single generated-code representation.** Semantic builders
   lower directly to AST. PHP fragments are parsed into AST before output.
2. **No safe API performs blind source interpolation.** Fragment
   interpolations accept typed values, references, expressions, statements, or
   declarations. Unsafe source insertion is explicit and visibly named.
3. **WordPress concepts remain above the generic PHP layer.** Hooks, routes,
   capabilities, post types, taxonomies, plugin headers, admin registration,
   and block behavior remain in `wp-json-ast`.
4. **The CLI does not invent another PHP DSL.** It maps WPKernel IR into
   WordPress semantic plans and consumes public packed APIs.
5. **Generated ownership is a compatibility contract.** The placement and
   meaning of `WPK:BEGIN AUTO`, `WPK:END AUTO`, metadata, and docblocks are
   versioned behavior.
6. **Public surfaces are explicit.** Cross-capability imports go through
   `public.ts` or supported package subpaths. Deep imports are mechanically
   rejected.
7. **Runtime claims require runtime evidence.** AST snapshots and Jest tests do
   not prove that a generated plugin activates or behaves correctly.
8. **Packed artifacts are the consumer boundary.** Workspace aliases are not
   release qualification.
9. **The deploying pipeline is pinned during the compiler spike.** Compiler
   boundaries and pipeline execution semantics must not change together.

## Non-goals for the spike

- Reorganising the whole monorepo.
- Migrating every WordPress generator.
- Creating Laravel, Symfony, or Drupal implementations.
- Splitting `php-json-ast` into several published packages before the boundary
  is proven.
- Removing all legacy exports in the same release.
- Expanding generic pipeline capabilities.
- Declaring the whole WPKernel framework production-ready.

## Target package shape

```text
packages/php-json-ast/
  src/
    ast/
      nodes/
      modifiers.ts
      public.ts

    codec/
      protocol.ts
      normalize.ts
      parity.ts
      public.ts

    authoring/
      values.ts
      references.ts
      expressions.ts
      statements.ts
      declarations.ts
      file.ts
      fragments.ts
      compile.ts
      public.ts

    source/
      bridge/
        process-runner.ts
        paths.ts
        autoload.ts
      parse.ts
      print.ts
      query.ts
      codemod.ts
      public.ts

    pipeline/
      channels.ts
      builder.ts
      writer.ts
      artifacts.ts
      public.ts

    index.ts
```

Initial supported entry points:

```text
@wpkernel/php-json-ast
@wpkernel/php-json-ast/ast
@wpkernel/php-json-ast/authoring
@wpkernel/php-json-ast/source
@wpkernel/php-json-ast/pipeline
```

The root remains a compatibility surface during the spike. New code uses the
explicit entry points.

## Parallel delivery model

Work is divided into four independent lanes joined by shared promotion gates.

### Lane A — PHP compiler and generic authoring

Owns:

- Raw node contracts and canonical JSON codec.
- Semantic values, expressions, statements, declarations, and files.
- Typed source fragments.
- Parser, printer, ingestion, and child-process safety.
- Package entry-point and packed-consumer qualification.

Does not own WordPress semantics, CLI migration, or browser fixtures.

### Lane B — WordPress semantic migration

Owns:

- WordPress resource, REST, storage, capability, plugin, and block plans.
- Compatibility facades over the generic authoring API.
- The bootstrap and one representative REST slice used by the spike.

It requests generic constructs from Lane A rather than copying utilities into
`wp-json-ast`.

### Lane C — CLI, codemod, upgrade, and ownership repair

Owns:

- IR-to-semantic-plan translation.
- Codemod target/configuration wiring.
- Upgrade and repair fixtures.
- Generate/apply idempotency.
- Generated ownership markers, conflict reporting, and transactional behavior.

It consumes Lane A and Lane B public APIs and must not create another AST DSL.

### Lane D — WordPress and browser qualification

Owns:

- Independent black-box WordPress/API/browser contracts.
- Clean environment startup, teardown, seeding, and diagnostics.
- Packed generated plugin activation.
- The fast PR lane and wider release matrix.

It owns expected behavior, not generator implementation.

## Shared-worktree coordination

If agents share one worktree:

- No agent runs repository-wide formatting, generated API documentation,
  aggregate coverage, lockfile updates, commits, or release scripts.
- Agents edit only their declared exclusive ownership zone.
- Shared exports, manifests, CI, lockfiles, root configuration, generated
  showcase output, and this roadmap belong to the coordinator.
- `dist/**`, `vendor/**`, `docs/api/**`, `coverage/**`, and packed artifacts are
  never hand-edited.
- An agent stops editing when a task reaches `HANDOFF`.
- The coordinator integrates one checkpoint at a time and reopens a task if
  its handoff is incomplete.

### Exclusive ownership zones

| Zone                        | Owner                  | Paths                                                                                                                     |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Shared integration          | Coordinator            | Package manifests, root barrels, export maps, Vite/Jest/TS configs, lockfiles, CI, root Playwright config, this roadmap   |
| Authoring                   | Lane A authoring agent | `packages/php-json-ast/src/authoring/**` and matching scoped tests/fixtures                                               |
| Codec and source bridge     | Lane A bridge agent    | New `codec/**`, `source/**`, agreed existing driver/printer files, PHP support files, and matching scoped tests           |
| WordPress proof             | Lane B agent           | Only the explicitly assigned bootstrap and REST files plus their tests                                                    |
| CLI repair                  | Lane C agent           | Explicitly assigned CLI codemod/upgrade files and fixtures                                                                |
| E2E                         | Lane D agent           | System-test specs, test harness, and E2E fixtures; root config and CI changes are handed to the coordinator               |
| Compatibility conflict zone | Coordinator            | Existing generic helpers under `wp-json-ast`, legacy program builders/channels, package barrels, generated showcase files |

When agents use separate branches or worktrees, the same logical ownership
applies. Shared-surface changes are still integrated only at checkpoints.

## Task ledger

### M0 — Truth and frozen baseline

| ID        | Status | Owner                            | Depends on | Deliverable                                                                                                                                                     |
| --------- | ------ | -------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PJA-000` | `DONE` | Coordinator                      | —          | Restore a canonical roadmap with corrected statuses, boundaries, task ownership, and gates.                                                                     |
| `PJA-010` | `DONE` | Agent A (`php_ast_organisation`) | —          | Record commit SHA, package/PHP/WP versions, public exports, invalid deep imports, raw-constructor counts, representative TypeScript LOC, and current red gates. |
| `PJA-020` | `DONE` | Agent A (`php_ast_organisation`) | `PJA-010`  | Capture normalized AST and printed-PHP golden contracts for plugin bootstrap and one REST registration slice.                                                   |
| `CLI-010` | `DONE` | Agent B (`php_ast_review`)       | —          | Build versioned fixtures for new, released, current-beta, user-edited, dirty, conflicted, interrupted, renamed, and removed-resource projects.                  |
| `E2E-010` | `DONE` | Agent C (`roadmap_intent`)       | —          | Reproduce and classify the current harness, WordPress startup, plugin, API, browser, and selector failures without fixing them.                                 |

**Checkpoint `G0 — Truth`: PASSED 2026-07-31.** Every baseline command,
failure, version, and fixture is recorded against base commit
`940a86495f0804dd15ae546e82bc631b95797c62`. Stale roadmap claims are
corrected.

### M1 — Contract and safety-net freeze

| ID        | Status    | Owner                            | Depends on           | Deliverable                                                                                                                           |
| --------- | --------- | -------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `PJA-100` | `ACTIVE`  | Coordinator                      | `G0`                 | Add behavior-preserving `ast`, `codec`, `authoring`, `source`, and `pipeline` public fronts.                                          |
| `PJA-110` | `BACKLOG` | Coordinator                      | `PJA-100`            | Preserve legacy root exports and add packed entry-point/API snapshots.                                                                |
| `PJA-120` | `BACKLOG` | Coordinator                      | `PJA-110`            | Enforce dependency direction and forbid unsupported deep imports.                                                                     |
| `PJA-130` | `DONE`    | Agent A (`php_ast_organisation`) | `G0`                 | Define the versioned canonical JSON codec and normalization rules.                                                                    |
| `PJA-140` | `DONE`    | Agent A (`php_ast_organisation`) | `PJA-130`            | Make schema parity bidirectional, union-aware, type-aware, and fail-closed when Composer assets are missing.                          |
| `WPJ-100` | `DONE`    | Agent B (`php_ast_review`)       | `G0`                 | Inventory raw public AST types and define the semantic-plan compatibility boundary.                                                   |
| `CLI-100` | `DONE`    | Agent B (`php_ast_review`)       | `CLI-010`            | Repair generated shim FQCN/layout and loader wiring so clean generated output can boot in WordPress.                                  |
| `E2E-090` | `DONE`    | Agent C (`roadmap_intent`)       | `E2E-010`            | Make root Playwright startup/readiness, diagnostics, and teardown deterministic without masking product failures.                     |
| `E2E-100` | `ACTIVE`  | Agent C (`roadmap_intent`)       | `E2E-090`, `CLI-100` | Make clean WordPress startup, teardown, database state, current seeds, and failure artifacts deterministic against the old generator. |
| `E2E-110` | `BACKLOG` | Lane D                           | `E2E-100`            | Prove packed generated-plugin installation and activation against the old output.                                                     |

**Checkpoint `G1 — Contract freeze`: PASSED 2026-07-31.** Dependency direction,
the canonical codec, raw-free WordPress plan shape, ownership markers, diff
rules, and compatibility policy are agreed.

**Checkpoint `G2 — Safety net`:** Lane D passes against the old implementation
and Lane C reproduces current release/beta upgrade fixtures. No migration task
may claim integration before `G2`.

### M2 — Generic authoring and source compiler

| ID        | Status    | Owner            | Depends on           | Deliverable                                                                                                            |
| --------- | --------- | ---------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `PJA-200` | `DONE`    | Agent A (`php_ast_organisation`) | `G1`                 | Promote generic PHP values and references from `wp-json-ast` into new authoring files without changing old helpers.    |
| `PJA-210` | `DONE`    | Agent A (`php_ast_organisation`) | `PJA-200`            | Add bounded calls, assignments, method calls, arrays, conditionals, loops, returns, and expression statements.         |
| `PJA-220` | `BACKLOG` | Lane A authoring | `PJA-210`            | Add declarations, imports, namespace, and file/program composition that lower directly to AST.                         |
| `PJA-300` | `BACKLOG` | Lane A bridge    | `G1`                 | Define one versioned PHP bridge request/response protocol with deterministic success and error envelopes.              |
| `PJA-310` | `BACKLOG` | Lane A bridge    | `PJA-300`            | Implement a shared process runner with timeout, abort, output cap, signal/exit classification, and stderr propagation. |
| `PJA-320` | `BACKLOG` | Lane A bridge    | `PJA-310`            | Add batched source-fragment parsing with fragment-aware locations and errors.                                          |
| `PJA-330` | `BACKLOG` | Lane A bridge    | `PJA-310`            | Route printer and ingestion through the shared runner without fixture drift.                                           |
| `PJA-340` | `BACKLOG` | Lane A authoring | `PJA-220`, `PJA-320` | Add typed `php.fragment` interpolation and an explicitly named unsafe escape hatch.                                    |
| `PJA-350` | `BACKLOG` | Coordinator      | `PJA-330`, `PJA-340` | Expose and packed-qualify the authoring and source fronts.                                                             |

**Checkpoint `G3A — Compiler`:**

- Semantic and fragment authoring both produce canonical typed AST.
- Parse→print→parse structural parity passes.
- Every generated fixture passes `php -l` on declared minimum and current PHP.
- Failure injection covers hangs, malformed JSON, partial lines, oversized
  output, missing binaries, and missing vendor assets.
- A clean packed consumer authors, parses, prints, and ingests using public
  imports only.

### M3 — WordPress vertical proof and CLI repair

| ID        | Status    | Owner       | Depends on           | Deliverable                                                                                                                                                 |
| --------- | --------- | ----------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WPJ-400` | `BACKLOG` | Lane B      | `G3A`, `G2`          | Migrate plugin bootstrap through the authoring API behind a dual-path fixture.                                                                              |
| `WPJ-410` | `BACKLOG` | Lane B      | `WPJ-400`            | Migrate one representative REST registration slice exercising callbacks, arrays, calls, comments, and imports.                                              |
| `WPJ-420` | `BACKLOG` | Coordinator | `WPJ-400`, `WPJ-410` | Convert old generic WP helpers into compatibility re-exports.                                                                                               |
| `WPJ-430` | `BACKLOG` | Coordinator | `WPJ-420`            | Enforce semantic imports on migrated files; raw AST requires an explicit lowering exemption.                                                                |
| `CLI-400` | `BACKLOG` | Lane C      | `G1`                 | Reconnect or explicitly replace the advertised codemod configuration and remove empty-target false success.                                                 |
| `CLI-410` | `BACKLOG` | Lane C      | `CLI-400`, `WPJ-410` | Produce a versioned machine-readable migration manifest with changed, unchanged, skipped, conflict, diagnostic, source-version, and target-version entries. |
| `CLI-420` | `BACKLOG` | Lane C      | `CLI-410`            | Prove generate→apply→generate→apply idempotency and failure recovery across the fixture matrix.                                                             |
| `CLI-430` | `BACKLOG` | Lane C      | `CLI-420`            | Pack the CLI with packed compiler/WP dependencies and run init, generate, apply, and doctor in a clean external fixture.                                    |

**Checkpoint `G3B — Dual-path parity`:**

- Old and new lowerers consume the same canonical input.
- Normalized AST, printed PHP, ownership markers, metadata, WordPress API
  behavior, and browser behavior agree.
- Formatting-only differences require an explicit reviewed allowlist.
- The new path remains feature-flagged until the next checkpoint.
- The selected slices reduce AST-specific calls by at least 60% and materially
  reduce TypeScript LOC.

### M4 — WordPress/API/browser qualification

| ID        | Status    | Owner       | Depends on           | Deliverable                                                                                                                                                                                            |
| --------- | --------- | ----------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `E2E-400` | `BACKLOG` | Lane D      | `E2E-110`            | WordPress API contracts for all storage adapters: supported CRUD or explicit unsupported response, schema failures, identity errors, authorization, capabilities, cache invalidation, and persistence. |
| `E2E-410` | `BACKLOG` | Lane D      | `E2E-400`            | Browser contracts limited to browser behavior: activation/admin menu, localized assets, DataView load/CRUD/errors, JS block registration, and SSR rendering.                                           |
| `E2E-420` | `BACKLOG` | Lane D      | `E2E-410`, `WPJ-400` | Run the authoring-generated bootstrap and REST slice through the same black-box contracts.                                                                                                             |
| `E2E-430` | `BACKLOG` | Coordinator | `E2E-420`            | Add a required fast packed-artifact Playground PR lane with diagnostics upload.                                                                                                                        |
| `E2E-440` | `BACKLOG` | Coordinator | `E2E-430`            | Add release lanes for declared minimum/current PHP and WordPress combinations using wp-env.                                                                                                            |

**Checkpoint `G4 — Upgrade and runtime integration`:**

- The packed CLI upgrades all success fixtures, preserves user code and marker
  contracts, reports conflicts, and is idempotent.
- Every emitted PHP file passes syntax validation.
- The packed generated plugin activates and passes API and browser contracts.
- Tests have no ignored cases, known failures, ordering dependence, or product
  retries disguised as infrastructure retries.

### M5 — Cleanup and decision

| ID        | Status    | Owner       | Depends on      | Deliverable                                                                                                                                         |
| --------- | --------- | ----------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PJA-500` | `BACKLOG` | Coordinator | `G3B`           | Classify the legacy program builder, printables, duplicate installer, NodeFinder, and BuilderFactory as retain, deprecate, remove, or experimental. |
| `PJA-510` | `BACKLOG` | Coordinator | `PJA-500`       | Publish compiling examples, migration guidance, deprecation metadata, and a removal version.                                                        |
| `PJA-900` | `BACKLOG` | Coordinator | `G4`, `PJA-510` | Run package, dependent-package, PHP, packed-consumer, CLI, WordPress, and browser qualification.                                                    |
| `PJA-910` | `BACKLOG` | Coordinator | `PJA-900`       | Record a continue/revise/abandon decision with measured DX, performance, compatibility, and runtime evidence.                                       |

**Checkpoint `G5 — Release candidate`:**

- Clean-install CI and packed-artifact provenance pass.
- Minimum/current PHP and WordPress support is demonstrated.
- Migration, deprecation, rollback, and support notes are complete.
- Performance has a measured baseline and reviewed regression threshold.
- No severity-one or severity-two waivers remain.

**Checkpoint `G6 — PHP codegen production qualification`:** an exact beta or
release-candidate artifact completes the agreed canary/soak period with verified
rollback. This qualifies the PHP codegen subsystem, not automatically the whole
WPKernel framework.

## Suggested parallel waves

With three implementation agents and one coordinator:

```text
Wave 0
  Agent A: PJA-010 and PJA-020
  Agent B: CLI-010
  Agent C: E2E-010
  Coordinator: integrate G0

Wave 1
  Agent A: PJA-130 and PJA-140
  Agent B: WPJ-100
  Agent C: E2E-100 and E2E-110
  Coordinator: PJA-100, PJA-110, PJA-120, then G1 and G2

Wave 2
  Agent A: PJA-200 → PJA-210 → PJA-220
  Agent B: PJA-300 → PJA-310 → PJA-320 → PJA-330
  Agent C: CLI-400 and early E2E-400 fixtures
  Coordinator: integration support

Wave 3
  Agent A: PJA-340 and DX measurements
  Agent B: bridge hardening and failure injection
  Agent C: E2E-400 and E2E-410
  Coordinator: PJA-350 and G3A

Wave 4
  Agent A: WPJ-400 and WPJ-410
  Agent B: CLI-410 → CLI-430
  Agent C: E2E-420
  Coordinator: WPJ-420, WPJ-430, G3B, then G4

Wave 5
  Agents: focused qualification fixes in their exclusive zones
  Coordinator: E2E-430, E2E-440, PJA-500, PJA-510, PJA-900, PJA-910
```

No wave starts merely because an agent is idle. Its promotion gate must pass.

## Handoff contract

Every task ends with this report:

```text
Task ID:
Status: HANDOFF
Commit/base SHA:
Owned files changed:
Tests run and result:
Acceptance checks:
Generated or packed artifact:
Behavior/output changes:
Open waivers:
Unresolved issues:
Coordinator actions required:
Suggested follow-up:
```

An agent must include exact commands and results. “Tests pass” without a command,
scope, and commit is not a valid handoff.

## Status update log

| Date       | Commit/artifact     | Update                                                                                                                                             | Evidence                                                                                                                                          | Open risks                                                                                                                                                             |
| ---------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-31 | Working tree review | Restored roadmap intent, corrected phase statuses, selected `php-json-ast/authoring`, defined four parallel lanes and promotion gates.             | Package/code/docs review; PHP AST TS tests 23/94 and WP AST tests 49/176 reported passing.                                                        | PHPUnit unavailable; package coverage gates incomplete; E2E specs absent/disabled; CLI codemod adoption disconnected.                                                  |
| 2026-07-31 | Wave 0 dispatch     | Moved this ledger behind the VitePress internal-doc boundary and assigned `PJA-010`, `PJA-020`, `CLI-010`, and `E2E-010`.                          | Three agents active with exclusive scopes and required handoff contracts.                                                                         | Shared working tree requires coordinator-only integration; `G0` remains closed until all handoffs are validated.                                                       |
| 2026-07-31 | `G0` integration    | Closed the truth baseline and opened Wave 1. Characterization contracts were integrated in the WordPress package to preserve dependency direction. | WP generation contracts: 2/2 tests and snapshots plus `php -l`; CLI fixture matrix: 16/16 tests; E2E failure reproduced against WP 6.7.4/PHP 8.1. | E2E currently has zero specs and deterministic REST fatals; interrupted apply and forced conflicts can false-green; raw AST remains the dominant WP authoring surface. |
| 2026-07-31 | Wave 1 checkpoint   | Packed-qualified the strict v1 codec, approved a raw-free WordPress `/plan` boundary, and restored four discoverable E2E contracts.                | Codec 18/18 plus clean tarball import; WP boundary evidence 33/33; Playwright lists 4 tests and persists WordPress/PHP diagnostics.               | `E2E-100` is blocked by generated shim layout/FQCN and loader defects; Chromium is absent locally; root readiness/teardown still needs repair.                         |
| 2026-07-31 | Runtime integration | Rebuilt the workspace CLI, generated and applied the showcase through the real pipeline, and reopened `CLI-100` after the live migration exposed stale shim-base handling. | Generation wrote 40 artifacts; apply completed without conflicts; all emitted PHP passed `php -l`; deterministic startup and teardown are implemented. | Existing shims retain legacy `.generated/php` paths; the configured UI entry `.wpk/generate/src/entry/index.tsx` is not emitted, so the asset build and browser gate remain red. |
| 2026-07-31 | `PJA-210` handoff   | Published the bounded semantic expression and statement surface while keeping identifier validators and branding internals private.                 | Five focused suites and 58 tests; lint, production/test typechecks, build, packed runtime import, and packed strict TypeScript consumer passed.     | `PJA-220` needs an explicit declaration, type/modifier, import, namespace, comments, and file-composition contract before implementation begins.                       |
| 2026-07-31 | `CLI-100` correction | Fixed missing-base initialization so three-way apply migrates existing shims instead of treating stale targets as intentional user edits.            | Six CLI suites and 25 tests; CLI build/typechecks; static Playwright contract 1/1; regenerated plugin and five shims pass `php -l`.                 | UI IR still drops canonical `dataviews` descriptors, leaving the generated frontend entry absent; live WordPress/browser qualification remains in `E2E-100`.            |
| 2026-07-31 | `E2E-100` integration | Restored canonical DataViews IR, configured surface paths, runtime/capability folding, UI hooks/localization, asset aliases, deterministic database readiness, and the real showcase build. | Real generate/apply completed with zero conflicts; 1,929-module showcase build passed; Docker-backed activation and REST namespace/route gate passed. | Live CRUD exposed missing WP-post core-field mapping and browser execution exposed missing authenticated session; fixes are integrated or in handoff but reruns are pending. Seed relative-date warnings remain. |
| 2026-07-31 | `E2E-100` product fixes | Mapped supported WP-post core fields for create/update, added explicit browser admin login, preserved full REST readiness JSON, and removed duplicate generated business-status fields. | WP/CLI focused suites: 19 and 42 tests; all generated PHP passes `php -l`; showcase build passes without the duplicate-key warning; Chromium installed. | Final Docker-backed CRUD and browser reruns are pending because elevated execution reached the environment usage limit. Relative-date seed warnings and unused external-import warnings remain. |

Add new entries; do not rewrite old evidence. If later evidence invalidates an
entry, add a correction row.

## Spike success criteria

The spike succeeds only when all of the following are true:

1. A representative plugin bootstrap and REST slice are materially easier to
   author, with at least 60% fewer raw AST-specific calls.
2. Semantic builders and typed fragments lower to one canonical AST
   representation.
3. The selected WordPress output is behaviorally equivalent under real
   WordPress API and browser contracts.
4. Packed external consumers use only supported public entry points.
5. Existing projects can be upgraded without losing user code or producing
   false-green codemod results.
6. Runtime failures are bounded, classified, and diagnosable.

A pleasant TypeScript API without WordPress/browser proof is not a successful
spike. A working generated plugin with the same authoring verbosity is also not
a successful spike.

## Evidence index

- [Central package page](../php-json-ast.md)
- [`php-json-ast` source entry point](../../../packages/php-json-ast/src/index.ts)
- [Current program builder](../../../packages/php-json-ast/src/programBuilder.ts)
- [BuilderFactory prototype](../../../packages/php-json-ast/src/generation/builderFactory.ts)
- [Node schema parity test](../../../packages/php-json-ast/src/__tests__/nodeSchemaParity.test.ts)
- [PHP ingestion entry point](../../../packages/php-json-ast/php/ingest-program.php)
- [CLI codemod helper](../../../packages/cli/src/builders/php/pipeline.codemods.ts)
- [CLI builder configuration](../../../packages/cli/src/builders/php/pipeline.builder.ts)
- [WordPress generic PHP value helpers](../../../packages/wp-json-ast/src/resource/common/phpValue.ts)
- [WordPress generic statement helpers](../../../packages/wp-json-ast/src/resource/common/utils.ts)
- [Playwright configuration](../../../playwright.config.ts)
- [CI workflow](../../../.github/workflows/ci.yml)
- [E2E harness guide](../../../test-harness/README.md)
