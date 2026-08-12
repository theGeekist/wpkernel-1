[**@wpkernel/cli v0.12.6-beta.3**](../README.md)

***

[@wpkernel/cli](../README.md) / Helper

# Interface: Helper<TContext, TInput, TOutput, TReporter, TKind>

Executable helper descriptor accepted by pipeline registration.

## Remarks

Helpers created by `createHelper` are frozen and retain their object identity
through registration and execution.

## See

 - [HelperDescriptor](HelperDescriptor.md)
 - [HelperApplyFn](../type-aliases/HelperApplyFn.md)

## Extends

- [`HelperDescriptor`](HelperDescriptor.md)<`TKind`>

## Type Parameters

### TContext

`TContext`

Per-run context type.

### TInput

`TInput`

Phase-specific input type.

### TOutput

`TOutput`

Value transformed by the helper chain.

### TReporter

`TReporter` *extends* `PipelineReporter` = `PipelineReporter`

Reporter type available during execution.

### TKind

`TKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Literal helper kind represented by the descriptor.

## Properties

### apply

```ts
readonly apply: HelperApplyFn<TContext, TInput, TOutput, TReporter>;
```

Executes this helper when its dependency position is reached.

***

### dependsOn

```ts
readonly dependsOn: readonly string[];
```

Helper keys that must complete before this helper may execute.

#### Inherited from

[`PipelineStep`](PipelineStep.md).[`dependsOn`](PipelineStep.md#dependson)

***

### key

```ts
readonly key: string;
```

Dependency and override identity within [kind](HelperDescriptor.md#kind).

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`key`](HelperDescriptor.md#key)

***

### kind

```ts
readonly kind: TKind;
```

Execution phase and registry containing this helper.

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`kind`](HelperDescriptor.md#kind)

***

### mode

```ts
readonly mode: HelperMode;
```

Duplicate-key registration policy.

#### Inherited from

[`PipelineStep`](PipelineStep.md).[`mode`](PipelineStep.md#mode)

***

### priority

```ts
readonly priority: number;
```

Relative ordering hint; higher values run first when dependencies permit.

#### Inherited from

[`PipelineStep`](PipelineStep.md).[`priority`](PipelineStep.md#priority)

***

### origin?

```ts
readonly optional origin: string;
```

Optional package or subsystem label used in diagnostics.

#### Inherited from

[`PipelineStep`](PipelineStep.md).[`origin`](PipelineStep.md#origin)
