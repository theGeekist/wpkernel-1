[**@wpkernel/core v0.12.6-beta.3**](../index.md)

---

[@wpkernel/core](../index.md) / setWPKernelEventBus

# Function: setWPKernelEventBus()

```ts
function setWPKernelEventBus(bus): void;
```

Replace the shared WPKernel event bus. Intended for test suites that need to
inspect emitted events.

## Parameters

### bus

[`WPKernelEventBus`](../classes/WPKernelEventBus.md)

Custom event bus instance

## Returns

`void`
