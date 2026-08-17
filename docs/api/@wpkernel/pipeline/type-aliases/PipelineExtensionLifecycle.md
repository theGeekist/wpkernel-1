[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelineExtensionLifecycle

# Type Alias: PipelineExtensionLifecycle

```ts
type PipelineExtensionLifecycle = string;
```

Name of an extension execution point in a stage composition.

## Remarks

Lifecycle names are application-defined strings. Configuring a lifecycle
makes it available to [PipelineStageDependencies.makeLifecycleStage](../interfaces/PipelineStageDependencies.md#makelifecyclestage);
it does not execute the lifecycle automatically in a custom composition.
