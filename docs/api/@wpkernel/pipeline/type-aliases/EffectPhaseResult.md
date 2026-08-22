[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectPhaseResult

# Type Alias: EffectPhaseResult&lt;TValue, TFailure&gt;

```ts
type EffectPhaseResult&lt;TValue, TFailure&gt; =
  | {
  kind: "success";
  value: TValue;
}
  | {
  error: TFailure;
  kind: "failure";
};
```

Explicit success or declared failure returned by one effect phase.

## Type Parameters

### TValue

`TValue`

### TFailure

`TFailure`
