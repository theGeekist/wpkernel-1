[**@wpkernel/php-json-ast v0.12.6-beta.3**](../README.md)

***

[@wpkernel/php-json-ast](../README.md) / CreatePhpFileBuilderOptions

# Interface: CreatePhpFileBuilderOptions<TContext, TInput, TOutput>

## Extends

- `Omit`<[`CreatePhpProgramBuilderOptions`](CreatePhpProgramBuilderOptions.md)<`TContext`, `TInput`, `TOutput`>, `"build"`>

## Type Parameters

### TContext

`TContext` *extends* [`PipelineContext`](PipelineContext.md) = [`PipelineContext`](PipelineContext.md)

### TInput

`TInput` *extends* [`BuilderInput`](BuilderInput.md) = [`BuilderInput`](BuilderInput.md)

### TOutput

`TOutput` *extends* [`BuilderOutput`](BuilderOutput.md) = [`BuilderOutput`](BuilderOutput.md)

## Properties

### build()

```ts
readonly build: (builder, entry) => void | Promise<void>;
```

#### Parameters

##### builder

[`PhpAstBuilderAdapter`](PhpAstBuilderAdapter.md)

##### entry

[`PhpAstContextEntry`](PhpAstContextEntry.md)

#### Returns

`void` \| `Promise`<`void`>

***

### filePath

```ts
readonly filePath: string;
```

#### Inherited from

```ts
Omit.filePath
```

***

### key

```ts
readonly key: string;
```

#### Inherited from

```ts
Omit.key
```

***

### metadata

```ts
readonly metadata: PhpFileMetadata;
```

#### Inherited from

```ts
Omit.metadata
```

***

### namespace

```ts
readonly namespace: string;
```

#### Inherited from

```ts
Omit.namespace
```

***

### dependsOn?

```ts
readonly optional dependsOn: readonly string[];
```

Prerequisite helper keys.

#### Default Value

`[]`

#### Inherited from

[`CreateHelperOptions`](CreateHelperOptions.md).[`dependsOn`](CreateHelperOptions.md#dependson)

***

### mode?

```ts
readonly optional mode: HelperMode;
```

Duplicate-key policy.

#### Default Value

`'extend'`

#### Inherited from

[`CreateHelperOptions`](CreateHelperOptions.md).[`mode`](CreateHelperOptions.md#mode)

***

### origin?

```ts
readonly optional origin: string;
```

Optional provenance label used in diagnostics.

#### Inherited from

[`CreateHelperOptions`](CreateHelperOptions.md).[`origin`](CreateHelperOptions.md#origin)

***

### priority?

```ts
readonly optional priority: number;
```

Relative ordering hint.

#### Default Value

`0`

#### Inherited from

[`CreateHelperOptions`](CreateHelperOptions.md).[`priority`](CreateHelperOptions.md#priority)
