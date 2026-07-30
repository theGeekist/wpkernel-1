[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / RunRollbackStackOptions

# Interface: RunRollbackStackOptions

Options for executing a rollback stack.

## Properties

### source

```ts
readonly source: "extension" | "helper";
```

---

### onError()?

```ts
readonly optional onError: (args) =&gt; void;
```

#### Parameters

##### args

###### entry

[`PipelineRollback`](PipelineRollback.md)

###### error

`unknown`

###### metadata

[`PipelineRollbackErrorMetadata`](PipelineRollbackErrorMetadata.md)

#### Returns

`void`
