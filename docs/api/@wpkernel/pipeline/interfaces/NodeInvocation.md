[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / NodeInvocation

# Interface: NodeInvocation&lt;TExternal, TDependencies, TCapabilities&gt;

Immutable data, capabilities and cooperative signal supplied to one node.

## Type Parameters

### TExternal

`TExternal`

### TDependencies

`TDependencies`

### TCapabilities

`TCapabilities`

## Properties

### capabilities

```ts
readonly capabilities: TCapabilities;
```

***

### input

```ts
readonly input: object;
```

#### dependencies

```ts
readonly dependencies: TDependencies;
```

#### external

```ts
readonly external: TExternal;
```

***

### signal

```ts
readonly signal: AbortSignal;
```
