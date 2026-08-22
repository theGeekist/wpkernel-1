[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / RunDiagnostics

# Interface: RunDiagnostics

Immutable node records with canonical identity, final state and graph order,
plus honest timing-dependent admission and settlement sequences and FIFO
events. Timing evidence is not used to choose graph meaning or failure
precedence.

## Properties

### events

```ts
readonly events: readonly RunEvent[];
```

***

### nodes

```ts
readonly nodes: readonly NodeDiagnostic[];
```
