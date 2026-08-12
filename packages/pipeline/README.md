# @wpkernel/pipeline

> A type-safe, dependency-aware workflow engine for orchestrating complex generation tasks.

## Overview

`@wpkernel/pipeline` is a generic orchestration engine that turns sets of decoupled "helpers" into deterministic, topologically sorted execution plans.

While it powers WPKernel's code generation (assembling fragments into artifacts), the core is completely agnostic. You can use it to build:

- **ETL Pipelines**: Extract, Transform, and Load stages with shared state.
- **Build Systems**: Compile, Bundle, and Minify steps with precise ordering.
- **Code Generators**: The standard "Fragment → Builder" pattern.

It guarantees:

- **Deterministic Ordering**: Topologically sorts helpers based on `dependsOn`.
- **Cycle Detection**: Fails fast (halts execution) if dependencies form a loop.
- **Robust Rollbacks**: Extensions and helpers provide best-effort rollback hooks run LIFO, attempting all cleanup steps and reporting any rollback failures.
- **Type Safety**: Full TypeScript support for custom contexts, options, and artifacts.

### Architecture Note

The package exports a single entry point `@wpkernel/pipeline` which provides the "Standard Pipeline" (Fragments & Builders). This is the recommended API for most consumers.

Under the hood, the package is split into:

1.  **Standard Pipeline (`src/standard-pipeline`)**: The opinionated implementation used by WPKernel.
2.  **Core Runner (`src/core/runner`)**: A purely agnostic DAG execution engine.

Custom architectures use the documented types exported from
`@wpkernel/pipeline`. Private `core/runner` types such as
`AgnosticStageDeps` are implementation details and must not be imported or
recreated by consumers.

## Installation

```bash
pnpm add @wpkernel/pipeline
```

The package ships pure TypeScript and has no runtime dependencies.

### Usage

#### Standard Pipeline (Recommended)

Use `createPipeline` for the standard Fragment → Builder workflow used by WPKernel.

```ts
import { createPipeline } from '@wpkernel/pipeline';

const pipeline = createPipeline({
	// Configuration
	createContext: (ops) => ({ db: ops.db }),
	createBuildOptions: () => ({}),
	createFragmentState: () => ({}),

	// Argument resolvers
	createFragmentArgs: ({ context }) => ({ db: context.db }),
	createBuilderArgs: ({ artifact }) => ({ artifact }),
});
```

#### Custom Pipeline (Advanced)

For completely custom architectures (ETL, migrations, compilers, etc.), use
`makePipeline`. The inline `createStages` callback is contextually typed as
`PipelineStageDependencies`; no cast or private runner import is required.

```ts
import {
	makePipeline,
	type PipelineStage,
	type PipelineStageState,
} from '@wpkernel/pipeline';

type RunOptions = { readonly source: string };
type CompileState = {
	readonly nodes: readonly string[];
	readonly revision: number;
};
type Reporter = {
	warn?: (message: string, context?: unknown) => void;
};
type Context = { readonly reporter: Reporter };
type StageState = PipelineStageState<
	RunOptions,
	CompileState,
	Context,
	Reporter
>;

const pipeline = makePipeline<RunOptions, Context, Reporter, CompileState>({
	helperKinds: ['compiler'] as const,
	createContext: () => ({ reporter: console }),
	createState: () => ({ nodes: [], revision: 0 }),
	createStages: (deps) => [
		deps.makeHelperStage('compiler'),
		((state) => ({
			...state,
			userState: {
				nodes: [...state.userState.nodes, 'final'],
				revision: state.userState.revision + 1,
			},
		})) satisfies PipelineStage<StageState, unknown>,
		deps.finalizeResult,
	],
});
```

The public custom-stage contract consists of:

- `AgnosticPipelineOptions`
- `PipelineStageDependencies`
- `PipelineStageState`
- `PipelineStageResult`
- `PipelineStage`
- `PipelineHelperStageOptions`
- `PipelineRegisteredHelper`
- `PipelineHelperRollback`
- `PipelineStageDiagnostics`
- `PipelineHalt`

`createState` returns the typed user state. Custom stages receive that value as
`state.userState`; returning an immutable replacement carries it into later
stages and `createRunResult.state`. Derive replacement state from the supplied
value with object spread. The public state is branded to reject fresh
reconstruction, and the runner preserves hidden rollback and extension
bookkeeping when it adopts a replacement.

### 2. Register Helpers

Helpers are the atomic units of work. They can be anything - functions, objects, or complex services.

```ts
// "Extract" helper
pipeline.use({
	kind: 'extract',
	key: 'users',
	apply: async ({ context }) => {
		return context.db.query('SELECT * FROM users');
	},
});

// "Transform" helper (depends on generic extract logic)
pipeline.use({
	kind: 'transform',
	key: 'clean-users',
	dependsOn: ['users'],
	apply: ({ input }) => {
		return input.map((u) => ({ ...u, name: u.name.trim() }));
	},
});
```

### 3. Run It

The pipeline resolves the graph, executes the content, and manages the lifecycle.

```ts
const result = await pipeline.run({ db: myDatabase });
```

## Concepts

### Agnostic Helper Kinds

You are not limited to fixed roles. Define any `kind` of helper (e.g., `'validator'`, `'compiler'`, `'notifier'`) and map them to execution stages.

### Dependency Graph

Pipeline creates a dependency graph for _each_ kind of helper. If `Helper B` depends on `Helper A`, the runner ensures `A` executes before `B` (and passes `A`'s output to `B` if configured).

### Helper Output Composition

Helpers may mutate their current output or return `{ output }` with a replacement value. Replacement output becomes the input to the next helper while preserving synchronous execution when every helper is synchronous.

Helpers continue automatically. `next(output?)` is an advanced continuation for helpers that need to wrap downstream execution:

```ts
apply: async ({ output }, next) => {
	const prepared = prepare(output);
	const downstream = next ? await next(prepared) : prepared;

	return {
		output: finalize(downstream),
	};
};
```

Calling `next()` without an argument passes the current output. The first call executes the downstream chain and subsequent calls return that same result.

### Extensions & Lifecycles

Extensions wrap execution with hooks at specific lifecycle stages.

**Standard Pipeline Lifecycles**:
`after-fragments` → `before-builders` → `after-builders` → `finalize`

Standard extension hooks begin after fragment finalisation, so their typed
`artifact` is always the final artifact shape. Work that must happen before
fragment execution belongs in an extension's `setup`; custom pipelines can
schedule arbitrary earlier lifecycles explicitly.

> **Note**: Custom pipelines (using `makePipeline`) can define arbitrary lifecycle stages. Extensions can hook into any stage, standard or custom, as long as it exists in the pipeline's execution plan.

**Validation**: The pipeline validates extension registrations. If an extension attempts to hook into an unscheduled lifecycle, the pipeline will log a warning instead of silently ignoring it.

**Extension Registration (Sync & Async)**: `extensions.use()` returns `MaybePromise<unknown>`. It returns a Promise only if the extension's `register` method is asynchronous.

```ts
// Sync registration (e.g. simple helper bundles)
extensions.use(mySyncExtension);

// Async registration (e.g. database connections)
await extensions.use(myAsyncExtension);
```

> **Recommendation**: We recommend `await`ing registration when possible for consistency, but you may omit it if you are certain the extension initializes synchronously. `pipeline.run()` will automatically wait for any pending async registrations.

Each run captures its helper and extension configuration when preparation
begins. Registrations made while a run is active apply to later runs, including
when the active run is paused and resumed. If extension registration fails, the
pipeline instance remains invalid and every later run reports the first
registration failure, whether registration failed synchronously or
asynchronously.

### Rollbacks

The pipeline supports robust rollback for both helper application and extension lifecycle commit phases:

- **Extensions**: Can provide transactional overhead via the `commit` phase. If extensive failure occurs, `rollback` hooks are triggered.
- **Helpers**: Can return a `rollback` function in their result. These are executed LIFO if a later failure occurs.
- **Robustness**: One transaction journal records helper stages and extension
  lifecycles in execution order, then unwinds them in strict reverse chronology.
  Rollback continues after individual failures while collecting and reporting
  them.

### Re-run Semantics

Diagnostics are per-run. Calling `pipeline.run()` starts a fresh invocation-owned collection, so runtime diagnostics and reporters cannot leak between overlapping or later runs. Pipeline-level registration diagnostics (for example, registration conflicts) are copied into that collection for every run and are therefore visible in both completed results and process-local pause snapshots.

### Process-local Suspension

`makeResumablePipeline()` retains the existing `pause`/`resume` terminology
for compatibility, but its snapshot is an in-memory suspension value - not a
durable checkpoint. It contains live runner state such as maps, sets,
diagnostic managers, extension coordinators, and rollback callbacks.

Resume it only with the same pipeline implementation in the same process.
Serialization, storage, transport, version binding, plan identity, and durable
checkpoint migration belong to the consuming application.

## Documentation

- [Architecture Guide](../../docs/packages/pipeline/architecture.md): Deep dive into the runner's internals and DAG resolution.
- [API Reference](../../docs/api/@wpkernel/pipeline/README.md): Generated TSDoc for all interfaces.
- [Changelog](./CHANGELOG.md): Release notes and migration-impact summary.

## License

EUPL-1.2 © [The Geekist](https://github.com/theGeekist)
