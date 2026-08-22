[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / RunOutcome

# Type Alias: RunOutcome&lt;TNodes, TOutputs, TEffects&gt;

```ts
type RunOutcome&lt;TNodes, TOutputs, TEffects&gt; = RunProjection&lt;TNodes, TEffects&gt; &
  | {
  kind: "succeeded";
  outputs: TOutputs;
}
  | {
  failures: readonly RunFailure&lt;TNodes, TEffects&gt;[];
  kind: "failed";
  primaryFailure: RunFailure&lt;TNodes, TEffects&gt;;
}
  | {
  kind: "cancelled";
  reason?: unknown;
}
  | {
  kind: "suspended";
  primaryPause: PauseRecord;
  suspension: Suspension&lt;TNodes, TOutputs, TEffects&gt;;
};
```

Complete immutable process-local run outcome after graph scheduling and the
effect work appropriate to its variant.

`nodes` is always in compiled canonical graph order. Successful runs commit
their prepared journal; failed and cancelled runs perform the applicable
reverse-journal compensation. A suspended run instead retains its prepared
entries for later resume or abandon: commit and compensation have not been
attempted for that suspension.

Node failures are primary by canonical node order. Effect preparation or
commit failures retain their logical journal order; compensation and observer
failures are contained as evidence and do not replace the triggering error.
A suspended outcome carries a live single-use process-local capability, not
a serialisable checkpoint.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TOutputs

`TOutputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](GraphValue.md)&gt;&gt;

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)
