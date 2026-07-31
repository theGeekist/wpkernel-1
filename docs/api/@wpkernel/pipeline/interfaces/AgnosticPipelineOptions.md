[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / AgnosticPipelineOptions

# Interface: AgnosticPipelineOptions<TRunOptions, TContext, TReporter, TUserState, TDiagnostic, TRunResult, TKind>

Options for creating an agnostic core pipeline.

Checks strict standard concepts like "fragment" and "builder" at the door,
allowing purely configuration-driven helper kinds.

## Type Parameters

### TRunOptions

`TRunOptions`

### TContext

`TContext` _extends_ `object`

### TReporter

`TReporter` _extends_ [`PipelineReporter`](PipelineReporter.md) = [`PipelineReporter`](PipelineReporter.md)

### TUserState

`TUserState` = `unknown`

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

### TRunResult

`TRunResult` = [`PipelineRunState`](PipelineRunState.md)<`TUserState`, `TDiagnostic`>

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

## Properties

### createContext()

```ts
readonly createContext: (options) => TContext;
```

#### Parameters

##### options

`TRunOptions`

#### Returns

`TContext`

---

### helperKinds

```ts
readonly helperKinds: readonly TKind[];
```

List of helper kinds to manage registered helpers for.

---

### createConflictDiagnostic()?

```ts
readonly optional createConflictDiagnostic: (options) => TDiagnostic;
```

#### Parameters

##### options

###### existing

[`HelperDescriptor`](HelperDescriptor.md)

###### helper

[`HelperDescriptor`](HelperDescriptor.md)

###### message

`string`

#### Returns

`TDiagnostic`

---

### createError()?

```ts
readonly optional createError: (code, message) => Error;
```

#### Parameters

##### code

`string`

##### message

`string`

#### Returns

`Error`

---

### createMissingDependencyDiagnostic()?

```ts
readonly optional createMissingDependencyDiagnostic: (options) => TDiagnostic;
```

#### Parameters

##### options

###### dependency

`string`

###### helper

[`HelperDescriptor`](HelperDescriptor.md)

###### message

`string`

#### Returns

`TDiagnostic`

---

### createRunResult()?

```ts
readonly optional createRunResult: (options) => TRunResult;
```

Adapts the generic run result (state) into the desired TRunResult.

#### Parameters

##### options

###### artifact

`TUserState`

###### context

`TContext`

###### diagnostics

readonly `TDiagnostic`[]

###### options

`TRunOptions`

###### state

[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>

###### steps

readonly [`PipelineStep`](PipelineStep.md)<`string`>[]

#### Returns

`TRunResult`

---

### createStages()?

```ts
readonly optional createStages: (deps) => readonly PipelineStage<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>, TRunResult>[];
```

Factory for pipeline stages.
If provided, this overrides the default agnostic stage composition.
Use this to reinstate standard pipeline behaviors or implement custom flows.

#### Parameters

##### deps

[`PipelineStageDependencies`](PipelineStageDependencies.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`, `TRunResult`, `TKind`>

#### Returns

readonly [`PipelineStage`](../type-aliases/PipelineStage.md)<[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>, `TRunResult`>[]

---

### createState()?

```ts
readonly optional createState: (options) => TUserState;
```

Factory for initial state.
Consumers can seed the state with arbitrary data needed by their stages.

#### Parameters

##### options

###### context

`TContext`

###### options

`TRunOptions`

#### Returns

`TUserState`

---

### createUnusedHelperDiagnostic()?

```ts
readonly optional createUnusedHelperDiagnostic: (options) => TDiagnostic;
```

#### Parameters

##### options

###### helper

[`HelperDescriptor`](HelperDescriptor.md)

###### message

`string`

#### Returns

`TDiagnostic`

---

### extensions?

```ts
readonly optional extensions: object;
```

#### lifecycles?

```ts
readonly optional lifecycles: readonly string[];
```

---

### onDiagnostic()?

```ts
readonly optional onDiagnostic: (options) => void;
```

Callback for observing diagnostics as they are added.

#### Parameters

##### options

###### diagnostic

`TDiagnostic`

###### reporter

`TReporter`

#### Returns

`void`

---

### onExtensionRollbackError()?

```ts
readonly optional onExtensionRollbackError: (options) => void;
```

#### Parameters

##### options

###### context

`TContext`

###### error

`unknown`

###### errorMetadata

[`PipelineExtensionRollbackErrorMetadata`](PipelineExtensionRollbackErrorMetadata.md)

###### extensionKeys

readonly `string`[]

###### hookSequence

readonly `string`[]

#### Returns

`void`

---

### providedKeys?

```ts
readonly optional providedKeys: Partial<Record<TKind, readonly string[]>>;
```

Map of helper keys that should be treated as "already satisfied" for dependency resolution.
Keys are grouped by helper kind.
