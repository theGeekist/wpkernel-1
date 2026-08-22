[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / NodeMiddleware

# Interface: NodeMiddleware&lt;TKey, TInvocation, TOutput, TState, TRequest&gt;

Ordered phases around exactly one node invocation.

Middleware has no continuation and cannot admit or suppress other nodes.
`before` phases enter in registration order; `after`, `error` and `cancel`
unwind entered middleware in reverse order. Each phase remains synchronous
until that phase's return exposes a callable `then`.

## Type Parameters

### TKey

`TKey` *extends* [`NodeKey`](../type-aliases/NodeKey.md)

### TInvocation

`TInvocation`

### TOutput

`TOutput`

### TState

`TState`

### TRequest

`TRequest`

## Properties

### node

```ts
readonly node: TKey;
```

***

### after()?

```ts
readonly optional after: (options) =&gt; MaybePromise&lt;readonly TRequest[]&gt;;
```

#### Parameters

##### options

[`MiddlewareEnteredOptions`](MiddlewareEnteredOptions.md)&lt;`TKey`, `TInvocation`, `TState`&gt; & `object`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;readonly `TRequest`[]&gt;

***

### before()?

```ts
readonly optional before: (options) =&gt; MaybePromise&lt;MiddlewareResult&lt;TState, TRequest&gt;&gt;;
```

#### Parameters

##### options

[`MiddlewareInvocationOptions`](MiddlewareInvocationOptions.md)&lt;`TKey`, `TInvocation`&gt;

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;[`MiddlewareResult`](MiddlewareResult.md)&lt;`TState`, `TRequest`&gt;&gt;

***

### cancel()?

```ts
readonly optional cancel: (options) =&gt; MaybePromise&lt;void&gt;;
```

#### Parameters

##### options

[`MiddlewareEnteredOptions`](MiddlewareEnteredOptions.md)&lt;`TKey`, `TInvocation`, `TState`&gt; & `object`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`void`&gt;

***

### error()?

```ts
readonly optional error: (options) =&gt; MaybePromise&lt;void&gt;;
```

#### Parameters

##### options

[`MiddlewareEnteredOptions`](MiddlewareEnteredOptions.md)&lt;`TKey`, `TInvocation`, `TState`&gt; & `object`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`void`&gt;
