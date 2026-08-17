# @wpkernel/pipeline

`@wpkernel/pipeline` delivers the helper DAG, extension hooks, and rollback guarantees shared by the kernel, CLI, and codemod packages. Use the architecture guide to understand execution phases and the framework contributor guide to extend helpers safely.

Use the architecture guide to understand the released execution model and the
framework contributor guide to extend helpers without relying on private runner
types. The older [hardening record](./pipeline/hardening-plan.md) is retained as
release history, not current guidance.

## Public custom-stage contract

Custom pipelines use `makePipeline` and the root-exported
`PipelineStageDependencies` facade. `createState`, the state passed through
`createStages`, helper-stage options, and `createRunResult.state` share one
generic `PipelineStageState` contract. Consumers must not import
`core/runner` types or recreate `AgnosticStageDeps`.

The Phase 6 exported type set is:

- `AgnosticPipelineOptions`
- `PipelineStageDependencies`
- `PipelineStageState`
- `PipelineStageResult`
- `PipelineStage`
- `PipelineHelperStageOptions`
- `PipelineRegisteredHelper`
- `PipelineHelperRollback`
- `PipelineStageDiagnostics`
- `PipelineHalt`

These names were introduced in 1.2.0 and pass external packed-artifact
qualification through the current 1.4 line.

- [Architecture Guide](./pipeline/architecture.md)
- [Framework Contributors](./pipeline/framework-contributors.md)
- [Historical Hardening Record](./pipeline/hardening-plan.md)
