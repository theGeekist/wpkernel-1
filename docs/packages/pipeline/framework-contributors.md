# @wpkernel/pipeline for Framework Contributors (Standard Pipeline)

## Overview

> **Note**: This guide focuses on the **Standard Pipeline** implementation
> (Fragments & Builders) used by WPKernel CLI. Custom architectures use
> `makePipeline` with the root-exported `PipelineStageDependencies` facade; see
> the [Architecture Guide](./architecture.md). Do not import private
> `core/runner` types.

Framework contributors extend the pipeline along the **standard WPK model**:

- Fragment helpers assemble intermediate IR and drafts
- Builder helpers turn those drafts into real artifacts (files, AST rewrites, etc.)
- Extensions wrap the finalised artifact with transactional commit/rollback hooks

The goal is that CLI, UI, and PHP codemod packages all share **the same helpers, the same extensions, and the same diagnostics**, while targeting different surfaces.

## Workflow

Use `createPipeline()` for the standard fragment and builder sequence, then
register helpers that declare dependencies. Use `makePipeline()` only for a
custom stage model. When advanced behaviour is required, compose extensions
that:

- Attach to one of the standard post-finalisation lifecycles, or to a custom
  pipeline's declared lifecycle
- Run transactional work inside the hook (`commit`, `rollback`)
- Optionally register additional helpers as part of their setup

Custom `createStages` callbacks are contextually typed. `createState`,
`PipelineStageState`, `PipelineHelperStageOptions`, and
`createRunResult.state` retain the same user-state, context, reporter,
diagnostic, and helper input/output types without consumer casts.

Each lifecycle run creates its own extension state; commits run **once per
lifecycle** in registration order. One transaction journal records completed
helper stages and extension lifecycles, then rollback traverses those records in
strict reverse execution chronology. Extension authors should assume:

- your `commit` can be called alongside commits from other lifecycles
- Each lifecycle may transform the artifact; later lifecycles see the updated artifact
- your `rollback` might run even if other rollbacks fail – treat it as best-effort cleanup, not a guarantee

## Examples

```ts
import * as fs from 'fs/promises';
import { createPipelineExtension } from '@wpkernel/pipeline';

const fileWriterExtension = createPipelineExtension({
	key: 'acme.file-writer',
	lifecycle: 'after-builders',
	hook({ artifact, context }) {
		const tempPath = `/tmp/${Date.now()}.json`;
		let committed = false;

		return {
			artifact,
			async commit() {
				await fs.writeFile(tempPath, JSON.stringify(artifact, null, 2));
				committed = true;
				context.reporter.info?.(
					`[file-writer] wrote artifact at ${tempPath}`
				);
			},
			async rollback() {
				if (!committed) return;
				await fs.unlink(tempPath).catch(() => {
					context.reporter.warn?.(
						`[file-writer] rollback could not remove ${tempPath} (already gone?)`
					);
				});
			},
		};
	},
});
```

## Patterns

Prefer `createPipelineExtension()` over manual registration so setup and hook phases stay isolated from the helpers themselves.

Typical framework patterns:

- **FS transaction wrappers** for builder lifecycles (`commit`/`rollback`)
- **Live-runner / watcher extensions** that inject helpers into a dedicated `live-runner` lifecycle
- **Analysis / validation passes** that attach to early lifecycles (`plan-validate`) and never touch the artifact

Always keep `commit` and `rollback` **idempotent**, and route logs through the shared reporter so diagnostics can be surfaced consistently in:

- CLI output
- docs snapshots
- UI consoles

## Extension Points

Expose new helper families through dedicated registration functions that
normalise metadata before calling `pipeline.ir.use()` or
`pipeline.builders.use()`. Common examples:

- `registerFragmentHelper()` - annotates fragment helpers with IR metadata and
  default priorities
- `registerBuilderHelper()` - locks helpers into the builder lifecycle with
  correct diagnostics wiring
- `registerCodemodHelper()` - targets PHP AST visitors for `php-json-ast` and
  codemod plans

These functions use the package's root-exported helper contract and strictly
type the `kind` field. Runner internals are not package entry points.

When widening extension payloads (`PipelineExtensionHookOptions`), update:

- the CLI runtime mirror
- the PHP driver / codemod plan
- any UI live-runner that projects the same metadata

so downstream packages inherit the new shape without ad-hoc adapters.

Planned extensions belong in design documentation until an implemented
factory and runtime contract exist. The package exports implemented extension
primitives from its root rather than publishing prose-only runtime manifests.

## Testing

Cover helper and extension wiring inside `packages/pipeline/src/__tests__`. Pair happy-path tests with simulated rollback failures to confirm commits are skipped and diagnostics bubble up. Integration suites should snapshot the execution metadata so helper ordering regressions surface quickly.

## Cross-links

Coordinate with the CLI framework guide before changing hook payloads, and update the php-json-ast codemod plan whenever new extension hooks support visitor orchestration. Pipeline changes often cascade into `@wpkernel/test-utils` harness expectations, so review that cookbook for knock-on effects.
