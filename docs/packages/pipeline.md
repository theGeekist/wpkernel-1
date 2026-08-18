# @wpkernel/pipeline

`@wpkernel/pipeline` 1.4.1 provides dependency-validated serial helper
composition, extension hooks, process-local suspension and rollback guarantees
shared by the kernel, CLI and codemod packages. It validates a helper graph,
then executes one ordered transformation chain. It is not a concurrent dataflow
scheduler.

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
qualification in the current 1.4.1 release.

- [Architecture Guide](./pipeline/architecture.md)
- [Framework Contributors](./pipeline/framework-contributors.md)
- [Historical Hardening Record](./pipeline/hardening-plan.md)
