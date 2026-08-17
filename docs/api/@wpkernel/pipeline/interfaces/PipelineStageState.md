[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / PipelineStageState

# Interface: PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;

Public state threaded through custom pipeline stages.

Consumer stages may replace `userState` immutably by returning a spread of
the received state. Runner-owned fields are preserved by that spread without
becoming part of the public custom-stage contract.

## Remarks

The nominal brand prevents constructing a valid state from scratch. Return
the received state or derive a replacement from it. A resumed run re-enters
the stage that paused and exposes the caller's resume value through
[PipelineStageState.resumeInput](#resumeinput).

## Example

```ts
const increment = (state: PipelineStageState&lt;Options, State, Context&gt;) =&gt; ({
  ...state,
  userState: { ...state.userState, count: state.userState.count + 1 },
});
```

## Type Parameters

### TRunOptions

`TRunOptions`

Options supplied to `run()`.

### TUserState

`TUserState`

User-owned state threaded through stages.

### TContext

`TContext` _extends_ `object`

Per-run context.

### TReporter

`TReporter` _extends_ [`PipelineReporter`](PipelineReporter.md) = [`PipelineReporter`](PipelineReporter.md)

Reporter contained by the context.

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

Diagnostic union collected by the run.

## Properties

### context

```ts
readonly context: TContext;
```

Context created once for this run.

---

### diagnostics

```ts
readonly diagnostics: readonly TDiagnostic[];
```

Diagnostics recorded so far.

---

### executedLifecycles

```ts
readonly executedLifecycles: ReadonlySet&lt;string&gt;;
```

Extension lifecycle names already executed by this run.

---

### reporter

```ts
readonly reporter: TReporter;
```

Reporter associated with the current context.

---

### runOptions

```ts
readonly runOptions: TRunOptions;
```

Original options supplied to the run.

---

### steps

```ts
readonly steps: readonly PipelineStep&lt;string&gt;[];
```

Helpers executed so far.

---

### userState

```ts
readonly userState: TUserState;
```

User-owned state that stages may replace immutably.

---

### helperExecution?

```ts
readonly optional helperExecution: ReadonlyMap&lt;string, HelperExecutionSnapshot&lt;string&gt;&gt;;
```

Execution summary by helper kind after helper stages complete.

---

### resumeInput?

```ts
readonly optional resumeInput: unknown;
```

Value supplied to `resume()` when re-entering a paused stage.

---

### stageIndex?

```ts
readonly optional stageIndex: number;
```

Zero-based index of the currently executing stage.
