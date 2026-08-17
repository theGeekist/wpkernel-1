[**@wpkernel/cli v0.12.6-beta.3**](../index.md)

***

[@wpkernel/cli](../index.md) / PipelineStep

# Interface: PipelineStep

Represents a single step executed within the pipeline.

## Extends

- [`HelperDescriptor`](HelperDescriptor.md)

## Properties

### dependsOn

```ts
readonly dependsOn: readonly string[];
```

Helper keys that must complete before this helper may execute.

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`dependsOn`](HelperDescriptor.md#dependson)

***

### id

```ts
readonly id: string;
```

A unique identifier for the step.

***

### index

```ts
readonly index: number;
```

The execution order of the step.

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
readonly kind: string;
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

[`HelperDescriptor`](HelperDescriptor.md).[`mode`](HelperDescriptor.md#mode)

***

### priority

```ts
readonly priority: number;
```

Relative ordering hint; higher values run first when dependencies permit.

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`priority`](HelperDescriptor.md#priority)

***

### origin?

```ts
readonly optional origin: string;
```

Optional package or subsystem label used in diagnostics.

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`origin`](HelperDescriptor.md#origin)
