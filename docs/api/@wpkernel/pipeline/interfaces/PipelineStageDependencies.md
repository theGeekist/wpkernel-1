[**@wpkernel/pipeline v1.2.1**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStageDependencies

# Interface: PipelineStageDependencies<TRunOptions, TUserState, TContext, TReporter, TDiagnostic, TRunResult, TKind>

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

`TRunResult` = [`PipelineRunState`](PipelineRunState.md)<`TUserState`, `TDiagnostic`>

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

## Properties

### commitStage

```ts
readonly commitStage: PipelineStage<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>, TRunResult>;
```

---

### diagnostics

```ts
readonly diagnostics: PipelineStageDiagnostics<TDiagnostic, TKind>;
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
readonly finalizeResult: PipelineStage<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>, TRunResult>;
```

---

### halt()

```ts
readonly halt: (error?) => PipelineHalt<TRunResult>;
```

#### Parameters

##### error?

`unknown`

#### Returns

[`PipelineHalt`](PipelineHalt.md)<`TRunResult`>

---

### isHalt()

```ts
readonly isHalt: (value) => value is PipelineHalt<TRunResult>;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is PipelineHalt<TRunResult>`

---

### makeHelperStage()

```ts
readonly makeHelperStage: <TInput, TOutput, TSelectedKind, THelper>(kind, options?) => PipelineStage<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>, TRunResult>;
```

#### Type Parameters

##### TInput

`TInput` = `TRunOptions`

##### TOutput

`TOutput` = `TUserState`

##### TSelectedKind

`TSelectedKind` _extends_ `string` = `TKind`

##### THelper

`THelper` _extends_ [`Helper`](Helper.md)<`TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`> = [`Helper`](Helper.md)<`TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`>

#### Parameters

##### kind

`TSelectedKind`

##### options?

[`PipelineHelperStageOptions`](PipelineHelperStageOptions.md)<[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>, `TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`, `THelper`>

#### Returns

[`PipelineStage`](../type-aliases/PipelineStage.md)<[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>, `TRunResult`>

---

### makeLifecycleStage()

```ts
readonly makeLifecycleStage: (lifecycle) => PipelineStage<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>, TRunResult>;
```

#### Parameters

##### lifecycle

`string`

#### Returns

[`PipelineStage`](../type-aliases/PipelineStage.md)<[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>, `TRunResult`>

---

### pause()?

```ts
readonly optional pause: (state, options?) => PipelinePaused<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>>;
```

#### Parameters

##### state

[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>

##### options?

[`PipelinePauseOptions`](PipelinePauseOptions.md)

#### Returns

[`PipelinePaused`](PipelinePaused.md)<[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>>
