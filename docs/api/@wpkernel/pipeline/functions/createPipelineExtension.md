[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / createPipelineExtension

# Function: createPipelineExtension()

```ts
function createPipelineExtension<TPipeline, TContext, TOptions, TArtifact>(
	options
): PipelineExtension<TPipeline, TContext, TOptions, TArtifact>;
```

Creates a [PipelineExtension](../interfaces/PipelineExtension.md) descriptor using either dynamic
registration or static setup plus hook configuration.

Construction itself has no side effects. Calling `pipeline.extensions.use`
invokes the descriptor's `register` function. Explicit keys must be unique in
that pipeline. Omitted keys receive a private generated key. Registration is
admitted in `use` call order, even when asynchronous setup settles out of
order. A registration failure remains attached to the pipeline and rejects
subsequent new runs.

Static `setup` settles before its hook is returned. Synchronous setup keeps
registration synchronous; asynchronous setup returns a native chained
promise through [maybeThen](maybeThen.md). The returned descriptor is a shallow
object and is not frozen, so consumers should treat it as declarative
registration metadata rather than mutate it after `use`.

Hooks for one lifecycle execute sequentially in registration order, each
receiving the artifact produced by the previous hook. A hook result may
replace the artifact and declare `commit` and `rollback` callbacks. Commits
run in hook order at an explicit commit stage or the pipeline's implicit
final commit. If a hook, commit or later stage fails, admitted rollbacks run
sequentially in reverse execution chronology. Rollback failures and rollback
observer failures are contained so remaining cleanup proceeds and the
original pipeline error stays primary.

## Type Parameters

### TPipeline

`TPipeline`

### TContext

`TContext`

### TOptions

`TOptions`

### TArtifact

`TArtifact`

## Parameters

### options

[`CreatePipelineExtensionOptions`](../type-aliases/CreatePipelineExtensionOptions.md)<`TPipeline`, `TContext`, `TOptions`, `TArtifact`>

Dynamic registration or static setup and hook configuration.

## Returns

[`PipelineExtension`](../interfaces/PipelineExtension.md)<`TPipeline`, `TContext`, `TOptions`, `TArtifact`>

An extension descriptor ready for `pipeline.extensions.use`.

## Examples

```ts
import {
	createPipelineExtension,
	type PipelineReporter,
} from '@wpkernel/pipeline';

type HostPipeline = { helpers: { use(value: unknown): void } };
type Context = { reporter: PipelineReporter };
type RunOptions = { normalise: boolean };

const normalise = createPipelineExtension<
	HostPipeline,
	Context,
	RunOptions,
	string[]
>({
	key: 'example.normalise',
	register() {
		return ({ artifact, options }) =>
			options.normalise
				? { artifact: artifact.map((value) => value.trim()) }
				: undefined;
	},
});
```

```ts
import {
	createPipelineExtension,
	type PipelineReporter,
} from '@wpkernel/pipeline';

type HostPipeline = { helpers: { use(value: unknown): void } };
type Context = { reporter: PipelineReporter };
type RunOptions = Record<string, never>;

const annotate = createPipelineExtension<
	HostPipeline,
	Context,
	RunOptions,
	string[]
>({
	key: 'example.annotate',
	setup(pipeline) {
		pipeline.helpers.use({ key: 'annotation-input' });
	},
	lifecycle: 'before-builders',
	hook: ({ artifact }) => ({ artifact: [...artifact, 'annotated'] }),
});
```

```ts
import {
	createPipelineExtension,
	type PipelineReporter,
} from '@wpkernel/pipeline';

type Context = { reporter: PipelineReporter };
const published = new Set<string>();

const publish = createPipelineExtension<
	unknown,
	Context,
	Record<string, never>,
	string[]
>({
	key: 'example.publish',
	hook: ({ artifact }) => ({
		artifact,
		commit: () => {
			published.add(artifact.join(','));
		},
		rollback: () => {
			published.delete(artifact.join(','));
		},
	}),
});
```
