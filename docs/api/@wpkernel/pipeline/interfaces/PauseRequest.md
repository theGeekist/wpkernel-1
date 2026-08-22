[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PauseRequest

# Interface: PauseRequest

A successful node's request to stop new admission after admitted work drains.
Concurrent pause requests fail the run; this is not a durable checkpoint.

## Properties

### reason?

```ts
readonly optional reason: string;
```
