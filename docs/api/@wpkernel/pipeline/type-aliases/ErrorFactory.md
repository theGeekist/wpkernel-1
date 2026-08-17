[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / ErrorFactory

# Type Alias: ErrorFactory

```ts
type ErrorFactory = (code, message) =&gt; Error;
```

Creates the domain error thrown for pipeline validation and runtime failures.

Supply an `ErrorFactory` through a pipeline's `createError` option when a
host needs its own error subclass, machine-readable code or observability
metadata. The pipeline treats `code` as an opaque category and preserves the
returned `Error` as the failure object. The surrounding run determines
whether that failure is thrown synchronously or becomes a rejection. The
factory itself is synchronous and should be deterministic.

Returning an `Error` does not require throwing it inside the factory. The
pipeline owns the eventual throw and preserves the returned instance.

## Parameters

### code

`string`

Pipeline error category, such as `ValidationError`.

### message

`string`

Complete human-readable failure description.

## Returns

`Error`

An error instance for the pipeline to throw.

## Example

```ts
import {
  makePipeline,
  type ErrorFactory,
  type PipelineReporter,
} from '@wpkernel/pipeline';

class HostError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const createError: ErrorFactory = (code, message) =&gt;
  new HostError(code, message);

const pipeline = makePipeline({
  helperKinds: [],
  createContext: () =&gt; ({ reporter: {} as PipelineReporter }),
  createError,
});
```
