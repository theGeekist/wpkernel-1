# @wpkernel/pipeline

`@wpkernel/pipeline` delivers the helper DAG, extension hooks, and rollback guarantees shared by the kernel, CLI, and codemod packages. Use the architecture guide to understand execution phases, the framework contributor guide to extend helpers safely, and the migration guide when moving from legacy imports.

The [pipeline hardening plan](./pipeline/hardening-plan.md) tracks the
cross-package contract work, verification state, and independent release gates
required before downstream systems treat the package as a stable execution
substrate.

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

These names are implemented and pass external packed-artifact qualification
in the `1.2.0` release candidate.

- [Architecture Guide](./pipeline/architecture.md)
- [Framework Contributors](./pipeline/framework-contributors.md)
- [Hardening Plan](./pipeline/hardening-plan.md)
