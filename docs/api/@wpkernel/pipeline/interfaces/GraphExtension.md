[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / GraphExtension

# Interface: GraphExtension&lt;TConfiguration, TContribution&gt;

Configuration-time role that contributes declarations but cannot see runs.

Configuration is validated, copied and recursively frozen before invocation.
The callback runs exactly once in registration order and cannot register more
work re-entrantly.

## Type Parameters

### TConfiguration

`TConfiguration` *extends* [`GraphValue`](../type-aliases/GraphValue.md)

### TContribution

`TContribution` *extends* [`GraphContribution`](GraphContribution.md) = [`GraphContribution`](GraphContribution.md)

## Properties

### contribute()

```ts
readonly contribute: (options) =&gt; MaybePromise&lt;TContribution&gt;;
```

#### Parameters

##### options

###### configuration

`ImmutableGraphValue`&lt;`TConfiguration`&gt;

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TContribution`&gt;
