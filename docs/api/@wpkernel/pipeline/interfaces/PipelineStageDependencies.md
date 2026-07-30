[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStageDependencies

# Interface: PipelineStageDependencies&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic, TRunResult, TKind&gt;

Stable, domain-neutral dependencies supplied to `createStages`.

## Type Parameters

### TRunOptions

`TRunOptions`

### TUserState

`TUserState`

### TContext

`TContext` _extends_ `object`

### TReporter

`TReporter` _extends_ [`PipelineReporter`](PipelineReporter.md) = [`PipelineReporter`](PipelineReporter.md)

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

### TRunResult

`TRunResult` = [`PipelineRunState`](PipelineRunState.md)&lt;`TUserState`, `TDiagnostic`&gt;

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

## Properties

### commitStage

```ts
readonly commitStage: PipelineStage&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;, TRunResult&gt;;
```

---

### diagnostics

```ts
readonly diagnostics: PipelineStageDiagnostics&lt;TDiagnostic, TKind&gt;;
```

---

### extensions

```ts
readonly extensions: object;
```

#### lifecycles?

```ts
readonly optional lifecycles: readonly string[];
```

---

### finalizeResult

```ts
readonly finalizeResult: PipelineStage&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;, TRunResult&gt;;
```

---

### halt()

```ts
readonly halt: (error?) =&gt; PipelineHalt&lt;TRunResult&gt;;
```

#### Parameters

##### error?

`unknown`

#### Returns

[`PipelineHalt`](PipelineHalt.md)&lt;`TRunResult`&gt;

---

### isHalt()

```ts
readonly isHalt: (value) =&gt; value is PipelineHalt&lt;TRunResult&gt;;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is PipelineHalt&lt;TRunResult&gt;`

---

### makeHelperStage()

```ts
readonly makeHelperStage: &lt;TInput, TOutput, TSelectedKind, THelper&gt;(kind, options?) =&gt; PipelineStage&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;, TRunResult&gt;;
```

#### Type Parameters

##### TInput

`TInput` = `TRunOptions`

##### TOutput

`TOutput` = `TUserState`

##### TSelectedKind

`TSelectedKind` _extends_ `string` = `TKind`

##### THelper

`THelper` _extends_ [`Helper`](Helper.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`&gt; = [`Helper`](Helper.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`&gt;

#### Parameters

##### kind

`TSelectedKind`

##### options?

[`PipelineHelperStageOptions`](PipelineHelperStageOptions.md)&lt;[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;, `TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`, `THelper`&gt;

#### Returns

[`PipelineStage`](../type-aliases/PipelineStage.md)&lt;[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;, `TRunResult`&gt;

---

### makeLifecycleStage()

```ts
readonly makeLifecycleStage: (lifecycle) =&gt; PipelineStage&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;, TRunResult&gt;;
```

#### Parameters

##### lifecycle

`string`

#### Returns

[`PipelineStage`](../type-aliases/PipelineStage.md)&lt;[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;, `TRunResult`&gt;

---

### pause()?

```ts
readonly optional pause: (state, options?) =&gt; PipelinePaused&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;&gt;;
```

#### Parameters

##### state

[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;

##### options?

[`PipelinePauseOptions`](PipelinePauseOptions.md)

#### Returns

[`PipelinePaused`](PipelinePaused.md)&lt;[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;&gt;
