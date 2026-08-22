[**@wpkernel/cli v0.12.6-beta.3**](../index.md)

***

[@wpkernel/cli](../index.md) / PipelineExtensionHookResult

# Interface: PipelineExtensionHookResult

Result returned by a pipeline extension hook.

## Properties

### artifact?

```ts
readonly optional artifact: IRv1;
```

Optional: A modified IR artifact.

***

### commit()?

```ts
readonly optional commit: () =&gt; MaybePromise&lt;void&gt;;
```

Optional: A function to commit changes made by the hook.

#### Returns

`MaybePromise`&lt;`void`&gt;

***

### rollback()?

```ts
readonly optional rollback: () =&gt; MaybePromise&lt;void&gt;;
```

Optional: A function to rollback changes made by the hook.

#### Returns

`MaybePromise`&lt;`void`&gt;
