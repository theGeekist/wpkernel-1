[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / NodeResult

# Type Alias: NodeResult&lt;TOutput, TFailure, TRequest&gt;

```ts
type NodeResult&lt;TOutput, TFailure, TRequest&gt; =
  | {
  effects: readonly TRequest[];
  kind: "success";
  output: TOutput;
  pause?: PauseRequest;
}
  | {
  error: TFailure;
  kind: "failure";
}
  | {
  kind: "cancelled";
  reason?: unknown;
};
```

Algebraic node settlement: success, declared failure or cancellation.
`cancelled` is valid only after the supplied signal is aborted; premature
cancellation is an invalid-node-result contract failure.

## Type Parameters

### TOutput

`TOutput` *extends* [`GraphValue`](GraphValue.md)

### TFailure

`TFailure`

### TRequest

`TRequest`
