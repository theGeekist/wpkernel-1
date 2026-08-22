[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelineConfigurationFailure

# Interface: PipelineConfigurationFailure

Complete algebraic configuration failure before any graph work is admitted.

Extension failures precede graph diagnostics, which precede role failures.
The corresponding arrays retain every knowable issue in canonical order.

## Properties

### extensionFailures

```ts
readonly extensionFailures: readonly GraphExtensionFailure[];
```

***

### failures

```ts
readonly failures: readonly PipelineConfigurationIssue[];
```

***

### graphDiagnostics

```ts
readonly graphDiagnostics: readonly GraphDiagnostic[];
```

***

### kind

```ts
readonly kind: "configuration-failed";
```

***

### primaryFailure

```ts
readonly primaryFailure: PipelineConfigurationIssue;
```

***

### roleFailures

```ts
readonly roleFailures: readonly object[];
```
