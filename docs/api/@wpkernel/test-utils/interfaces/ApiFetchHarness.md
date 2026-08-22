[**@wpkernel/test-utils v0.12.6-beta.3**](../index.md)

***

[@wpkernel/test-utils](../index.md) / ApiFetchHarness

# Interface: ApiFetchHarness

A harness for testing `apiFetch` interactions.

## Properties

### apiFetch

```ts
apiFetch: Mock;
```

The mock `apiFetch` function.

***

### doAction

```ts
doAction: Mock;
```

The mock `doAction` function from `wp.hooks`.

***

### harness

```ts
harness: WordPressTestHarness;
```

The underlying WordPress test harness.

***

### hooks

```ts
hooks: any;
```

The mock WordPress hooks object.
