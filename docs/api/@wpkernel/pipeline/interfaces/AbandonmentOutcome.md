[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / AbandonmentOutcome

# Interface: AbandonmentOutcome&lt;TEffects&gt;

Complete result of explicitly abandoning one suspension.
Cleanup runs in reverse logical journal order and retains every failure.

## Type Parameters

### TEffects

`TEffects` *extends* [`EffectRegistry`](../type-aliases/EffectRegistry.md)

## Properties

### cleanupFailures

```ts
readonly cleanupFailures: readonly EffectJournalFailure&lt;TEffects&gt;[];
```

***

### diagnostics

```ts
readonly diagnostics: RunDiagnostics;
```

***

### effectJournal

```ts
readonly effectJournal: readonly EffectJournalEntry&lt;TEffects&gt;[];
```

***

### kind

```ts
readonly kind: "abandoned";
```

***

### observerFailures

```ts
readonly observerFailures: readonly RunObserverFailure[];
```
