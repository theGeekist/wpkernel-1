[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / RunObserver

# Type Alias: RunObserver

```ts
type RunObserver = (event) =&gt; MaybePromise&lt;void&gt;;
```

Passive diagnostic consumer with no scheduler, data or effect authority.

Events enter one FIFO delivery tail. Observer failures are contained and
retained; an observer thenable may promote terminal settlement, but it cannot
change the run result.

## Parameters

### event

[`RunEvent`](RunEvent.md)

## Returns

[`MaybePromise`](MaybePromise.md)&lt;`void`&gt;
