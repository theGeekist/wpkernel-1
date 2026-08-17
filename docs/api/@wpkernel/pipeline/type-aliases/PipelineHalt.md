[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelineHalt

# Type Alias: PipelineHalt&lt;TRunResult&gt;

```ts
type PipelineHalt&lt;TRunResult&gt; = 
  | {
  __halt: true;
  error: unknown;
  result?: never;
}
  | {
  __halt: true;
  result: TRunResult;
  error?: never;
};
```

Terminal result produced by a custom pipeline stage.

A halt is either a failure carrying `error`, or a successful early result
carrying `result`. Use the stage dependency `halt(error)` for failures;
successful result halts may be returned directly.

## Type Parameters

### TRunResult

`TRunResult`

Successful early-result type.

## Type Declaration

```ts
{
  __halt: true;
  error: unknown;
  result?: never;
}
```

### \_\_halt

```ts
readonly __halt: true;
```

Runtime discriminant.

### error

```ts
readonly error: unknown;
```

Failure propagated after rollback completes.

### result?

```ts
readonly optional result: never;
```

```ts
{
  __halt: true;
  result: TRunResult;
  error?: never;
}
```

### \_\_halt

```ts
readonly __halt: true;
```

Runtime discriminant.

### result

```ts
readonly result: TRunResult;
```

Successful result returned immediately from the run.

### error?

```ts
readonly optional error: never;
```

## Remarks

Error halts initiate rollback. Successful result halts stop remaining stages
and return the supplied result without committing further extension work.
The two branches are mutually exclusive.
