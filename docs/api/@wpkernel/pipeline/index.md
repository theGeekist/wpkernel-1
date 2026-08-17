**@wpkernel/pipeline v1.4.0**

---

# @wpkernel/pipeline v1.4.0

## Interfaces

- [AgnosticPipeline](interfaces/AgnosticPipeline.md)
- [ConflictDiagnostic](interfaces/ConflictDiagnostic.md)
- [CreateHelperOptions](interfaces/CreateHelperOptions.md)
- [FragmentFinalizationMetadata](interfaces/FragmentFinalizationMetadata.md)
- [Helper](interfaces/Helper.md)
- [HelperApplyOptions](interfaces/HelperApplyOptions.md)
- [HelperApplyResult](interfaces/HelperApplyResult.md)
- [HelperDescriptor](interfaces/HelperDescriptor.md)
- [HelperExecutionSnapshot](interfaces/HelperExecutionSnapshot.md)
- [HelperNext](interfaces/HelperNext.md)
- [MissingDependencyDiagnostic](interfaces/MissingDependencyDiagnostic.md)
- [Pipeline](interfaces/Pipeline.md)
- [PipelineExecutionMetadata](interfaces/PipelineExecutionMetadata.md)
- [PipelineExtension](interfaces/PipelineExtension.md)
- [PipelineExtensionHookOptions](interfaces/PipelineExtensionHookOptions.md)
- [PipelineExtensionHookRegistration](interfaces/PipelineExtensionHookRegistration.md)
- [PipelineExtensionHookResult](interfaces/PipelineExtensionHookResult.md)
- [PipelineHelperRollback](interfaces/PipelineHelperRollback.md)
- [PipelineHelperStageOptions](interfaces/PipelineHelperStageOptions.md)
- [PipelinePaused](interfaces/PipelinePaused.md)
- [PipelinePauseOptions](interfaces/PipelinePauseOptions.md)
- [PipelinePauseSnapshot](interfaces/PipelinePauseSnapshot.md)
- [PipelineRegisteredHelper](interfaces/PipelineRegisteredHelper.md)
- [PipelineReporter](interfaces/PipelineReporter.md)
- [PipelineRollback](interfaces/PipelineRollback.md)
- [PipelineRollbackErrorMetadata](interfaces/PipelineRollbackErrorMetadata.md)
- [PipelineRunState](interfaces/PipelineRunState.md)
- [PipelineStageDependencies](interfaces/PipelineStageDependencies.md)
- [PipelineStageDiagnostics](interfaces/PipelineStageDiagnostics.md)
- [PipelineStageState](interfaces/PipelineStageState.md)
- [PipelineStep](interfaces/PipelineStep.md)
- [ResumablePipeline](interfaces/ResumablePipeline.md)
- [UnusedHelperDiagnostic](interfaces/UnusedHelperDiagnostic.md)

## Type Aliases

### Pipeline

- [ErrorFactory](type-aliases/ErrorFactory.md)

### Other

- [AgnosticPipelineOptions](type-aliases/AgnosticPipelineOptions.md)
- [CreatePipelineExtensionOptions](type-aliases/CreatePipelineExtensionOptions.md)
- [CreatePipelineOptions](type-aliases/CreatePipelineOptions.md)
- [Halt](type-aliases/Halt.md)
- [HelperApplyFn](type-aliases/HelperApplyFn.md)
- [HelperKind](type-aliases/HelperKind.md)
- [HelperMode](type-aliases/HelperMode.md)
- [MaybePromise](type-aliases/MaybePromise.md)
- [PipelineDiagnostic](type-aliases/PipelineDiagnostic.md)
- [PipelineExtensionHook](type-aliases/PipelineExtensionHook.md)
- [PipelineExtensionLifecycle](type-aliases/PipelineExtensionLifecycle.md)
- [PipelineExtensionRegisterOutput](type-aliases/PipelineExtensionRegisterOutput.md)
- [PipelineExtensionRollbackErrorMetadata](type-aliases/PipelineExtensionRollbackErrorMetadata.md)
- [PipelineHalt](type-aliases/PipelineHalt.md)
- [PipelinePauseKind](type-aliases/PipelinePauseKind.md)
- [PipelineStage](type-aliases/PipelineStage.md)
- [PipelineStageResult](type-aliases/PipelineStageResult.md)
- [StandardPipelineExtension](type-aliases/StandardPipelineExtension.md)

## Functions

### Pipeline

- [createHelper](functions/createHelper.md)
- [createPipelineExtension](functions/createPipelineExtension.md)
- [createPipelineRollback](functions/createPipelineRollback.md)

### Other

- [createPipeline](functions/createPipeline.md)
- [isPromiseLike](functions/isPromiseLike.md)
- [makePipeline](functions/makePipeline.md)
- [makeResumablePipeline](functions/makeResumablePipeline.md)
- [maybeAll](functions/maybeAll.md)
- [maybeThen](functions/maybeThen.md)
- [maybeTry](functions/maybeTry.md)
