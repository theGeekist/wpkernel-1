[**@wpkernel/pipeline v1.2.1**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelinePauseSnapshot

# Interface: PipelinePauseSnapshot<TState>

Snapshot captured when a pipeline run pauses.

This is a process-local suspension value. Its state can contain live maps,
sets, functions, extension coordinators, rollback callbacks, and other
non-serializable runtime objects. Consumers must not persist or transport it
as a durable checkpoint.

## Type Parameters

### TState

`TState`

## Properties

### createdAt

```ts
readonly createdAt: number;
```

---

### stageIndex

```ts
readonly stageIndex: number;
```

---

### state

```ts
readonly state: TState;
```

---

### pauseKind?

```ts
readonly optional pauseKind: string;
```

---

### payload?

```ts
readonly optional payload: unknown;
```

---

### token?

```ts
readonly optional token: unknown;
```
