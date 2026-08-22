[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / GraphExtensionRegistration

# Interface: GraphExtensionRegistration&lt;TConfiguration, TContribution&gt;

One immutable extension registration in a Pipeline configuration.

## Type Parameters

### TConfiguration

`TConfiguration` *extends* [`GraphValue`](../type-aliases/GraphValue.md) = [`GraphValue`](../type-aliases/GraphValue.md)

### TContribution

`TContribution` *extends* [`GraphContribution`](GraphContribution.md) = [`GraphContribution`](GraphContribution.md)

## Properties

### configuration

```ts
readonly configuration: TConfiguration;
```

***

### extension

```ts
readonly extension: GraphExtension&lt;TConfiguration, TContribution&gt;;
```
