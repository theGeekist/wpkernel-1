[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

***

[@wpkernel/php-json-ast](../index.md) / CreatePhpProgramBuilderOptions

# Interface: CreatePhpProgramBuilderOptions&lt;TContext, TInput, TOutput&gt;

## Extends

- `Pick`&lt;[`CreateHelperOptions`](CreateHelperOptions.md)&lt;`TContext`, `TInput`, `TOutput`&gt;, `"dependsOn"` \| `"mode"` \| `"priority"` \| `"origin"`&gt;

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
readonly build: (builder, entry) =&gt; void | Promise&lt;void&gt;;
```

#### Parameters

##### builder

[`PhpAstBuilderAdapter`](PhpAstBuilderAdapter.md)

##### entry

[`PhpAstContextEntry`](PhpAstContextEntry.md)

#### Returns

`void` \| `Promise`&lt;`void`&gt;

***

### filePath

```ts
readonly filePath: string;
```

***

### key

```ts
readonly key: string;
```

***

### metadata

```ts
readonly metadata: PhpFileMetadata;
```

***

### namespace

```ts
readonly namespace: string;
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
