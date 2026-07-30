[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / AgnosticPipelineOptions

# Interface: AgnosticPipelineOptions&lt;TRunOptions, TContext, TReporter, TUserState, TDiagnostic, TRunResult, TKind&gt;

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

`TRunResult` = [`PipelineRunState`](PipelineRunState.md)&lt;`TUserState`, `TDiagnostic`&gt;

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

## Properties

### createContext()

```ts
readonly createContext: (options) =&gt; TContext;
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
readonly optional createConflictDiagnostic: (options) =&gt; TDiagnostic;
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
readonly optional createError: (code, message) =&gt; Error;
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
readonly optional createMissingDependencyDiagnostic: (options) =&gt; TDiagnostic;
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
readonly optional createRunResult: (options) =&gt; TRunResult;
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

[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;

###### steps

readonly [`PipelineStep`](PipelineStep.md)&lt;`string`&gt;[]

#### Returns

`TRunResult`

---

### createStages()?

```ts
readonly optional createStages: (deps) =&gt; readonly PipelineStage&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;, TRunResult&gt;[];
```

Factory for pipeline stages.
If provided, this overrides the default agnostic stage composition.
Use this to reinstate standard pipeline behaviors or implement custom flows.

#### Parameters

##### deps

[`PipelineStageDependencies`](PipelineStageDependencies.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`, `TRunResult`, `TKind`&gt;

#### Returns

readonly [`PipelineStage`](../type-aliases/PipelineStage.md)&lt;[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;, `TRunResult`&gt;[]

---

### createState()?

```ts
readonly optional createState: (options) =&gt; TUserState;
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
readonly optional createUnusedHelperDiagnostic: (options) =&gt; TDiagnostic;
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
readonly optional onDiagnostic: (options) =&gt; void;
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
readonly optional onExtensionRollbackError: (options) =&gt; void;
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
readonly optional providedKeys: Partial&lt;Record&lt;TKind, readonly string[]&gt;&gt;;
```

Map of helper keys that should be treated as "already satisfied" for dependency resolution.
Keys are grouped by helper kind.
