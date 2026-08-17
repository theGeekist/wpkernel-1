[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / Pipeline

# Interface: Pipeline&lt;TRunOptions, TRunResult, TContext, TReporter, TBuildOptions, TArtifact, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TDiagnostic, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper&gt;

A configured standard fragment-and-builder pipeline.

The dedicated [Pipeline.ir](#ir) and [Pipeline.builders](#builders) surfaces
validate helper kinds at registration. [Pipeline.use](#use) accepts either
configured kind while preserving the original helper object's identity.
Calls to [Pipeline.run](#run) preserve synchronous settlement until a helper,
extension, commit, rollback or stage actually becomes asynchronous.

Registrations are pipeline configuration. Each run waits for pending
extension registration to quiesce and captures immutable helper and hook
orders, so overlapping runs cannot acquire one another's later additions.

## Type Parameters

### TRunOptions

`TRunOptions`

### TRunResult

`TRunResult`

### TContext

`TContext` _extends_ `object`

### TReporter

`TReporter` _extends_ [`PipelineReporter`](PipelineReporter.md) = [`PipelineReporter`](PipelineReporter.md)

### TBuildOptions

`TBuildOptions` = `unknown`

### TArtifact

`TArtifact` = `unknown`

### TFragmentInput

`TFragmentInput` = `unknown`

### TFragmentOutput

`TFragmentOutput` = `unknown`

### TBuilderInput

`TBuilderInput` = `unknown`

### TBuilderOutput

`TBuilderOutput` = `unknown`

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

### TFragmentKind

`TFragmentKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = `"fragment"`

### TBuilderKind

`TBuilderKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = `"builder"`

### TFragmentHelper

`TFragmentHelper` _extends_ [`Helper`](Helper.md)&lt;`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`&gt; = [`Helper`](Helper.md)&lt;`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`&gt;

### TBuilderHelper

`TBuilderHelper` _extends_ [`Helper`](Helper.md)&lt;`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`&gt; = [`Helper`](Helper.md)&lt;`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`&gt;

## Properties

### builderKind

```ts
readonly builderKind: TBuilderKind;
```

Builder helper kind configured for this pipeline.

---

### builders

```ts
readonly builders: object;
```

Typed registration surface for builder helpers.

#### use()

```ts
use: (helper) =&gt; void;
```

Registers a builder helper by object identity.

##### Parameters

###### helper

`TBuilderHelper`

##### Returns

`void`

##### Throws

A validation error when `helper.kind` is not [Pipeline.builderKind](#builderkind).

---

### extensions

```ts
readonly extensions: object;
```

Extension registration surface for artifact lifecycle hooks.

#### use()

```ts
use: (extension) =&gt; unknown;
```

Registers extension setup and an optional lifecycle hook.

Returns synchronously for synchronous registration and a promise-like
value only when registration is asynchronous. Unawaited asynchronous
registration is still awaited by the next [Pipeline.run](#run).

##### Parameters

###### extension

[`StandardPipelineExtension`](../type-aliases/StandardPipelineExtension.md)&lt;`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TBuildOptions`, `TArtifact`, `TFragmentInput`, `TFragmentOutput`, `TBuilderInput`, `TBuilderOutput`, `TDiagnostic`, `TFragmentKind`, `TBuilderKind`, `TFragmentHelper`, `TBuilderHelper`&gt;

##### Returns

`unknown`

---

### fragmentKind

```ts
readonly fragmentKind: TFragmentKind;
```

Fragment helper kind configured for this pipeline.

---

### ir

```ts
readonly ir: object;
```

Typed registration surface for fragment helpers.

#### use()

```ts
use: (helper) =&gt; void;
```

Registers a fragment helper by object identity.

##### Parameters

###### helper

`TFragmentHelper`

##### Returns

`void`

##### Throws

A validation error when `helper.kind` is not [Pipeline.fragmentKind](#fragmentkind).

---

### run()

```ts
run: (options) =&gt; MaybePromise&lt;TRunResult&gt;;
```

Executes one isolated fragment, extension and builder sequence.

Returns `TRunResult` synchronously when all participating work is
synchronous; otherwise returns a promise-like value. Diagnostics belong to
this invocation and do not leak into overlapping or later runs.

#### Parameters

##### options

`TRunOptions`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TRunResult`&gt;

---

### use()

```ts
use: (helper) =&gt; void;
```

Registers either a configured fragment helper or builder helper while
preserving the original helper object's identity. Prefer [Pipeline.ir](#ir)
or [Pipeline.builders](#builders) when the helper family is known statically.

#### Parameters

##### helper

`TFragmentHelper` | `TBuilderHelper`

#### Returns

`void`
