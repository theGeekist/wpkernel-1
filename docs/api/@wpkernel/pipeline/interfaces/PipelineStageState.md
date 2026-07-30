[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStageState

# Interface: PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;

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

## Properties

### context

```ts
readonly context: TContext;
```

---

### diagnostics

```ts
readonly diagnostics: readonly TDiagnostic[];
```

---

### executedLifecycles

```ts
readonly executedLifecycles: ReadonlySet&lt;string&gt;;
```

---

### reporter

```ts
readonly reporter: TReporter;
```

---

### runOptions

```ts
readonly runOptions: TRunOptions;
```

---

### steps

```ts
readonly steps: readonly PipelineStep&lt;string&gt;[];
```

---

### userState

```ts
readonly userState: TUserState;
```

---

### helperExecution?

```ts
readonly optional helperExecution: ReadonlyMap&lt;string, HelperExecutionSnapshot&lt;string&gt;&gt;;
```

---

### resumeInput?

```ts
readonly optional resumeInput: unknown;
```

---

### stageIndex?

```ts
readonly optional stageIndex: number;
```
