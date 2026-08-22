[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / NodeContract

# Interface: NodeContract&lt;TExternalKeys, TOutput, TFailure, TEffectKeys&gt;

The static, literal-keyed contract of a graph node.

`effectKeys` is required runtime metadata. It permits the compiler to verify
every admitted effect key while retaining the member-specific literal union.

## Type Parameters

### TExternalKeys

`TExternalKeys` *extends* `string`

### TOutput

`TOutput` *extends* [`GraphValue`](../type-aliases/GraphValue.md)

### TFailure

`TFailure` = `unknown`

### TEffectKeys

`TEffectKeys` *extends* [`EffectKey`](../type-aliases/EffectKey.md) = `never`

## Properties

### effectKeys

```ts
readonly effectKeys: readonly TEffectKeys[];
```

***

### externalInputs

```ts
readonly externalInputs: readonly TExternalKeys[];
```

***

### priority

```ts
readonly priority: number;
```

***

### \[nodeType\]()?

```ts
readonly optional [nodeType]: () =&gt; object;
```

#### Returns

`object`

##### failure

```ts
readonly failure: TFailure;
```

##### output

```ts
readonly output: TOutput;
```
