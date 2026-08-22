# Pipeline v2 public vocabulary

Status: Accepted
Owner task: P2-001
Governing decisions: ADR-001, ADR-002, ADR-003

Every public noun has one meaning and one owning layer. Compound names are used
where bare `Input`, `Output`, `Snapshot` or `Extension` would be ambiguous.

## 1. Canonical v2 nouns

| Noun                       | Exact meaning                                                                                                                                                          | Owning layer                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `Pipeline`                 | A frozen nominal data token for one configured process-local evaluator. It has no methods; `runPipeline` starts fresh runs through its private authority.              | Public evaluator              |
| `GraphDeclaration`         | Immutable authoring data from which a graph is compiled. It has no execution methods.                                                                                  | Authoring and compilation     |
| `Graph`                    | The immutable compiled executable graph, including nodes, data edges, adjacency, canonical rank, projections and execution policy. It is internal scheduler authority. | Compiler and scheduler        |
| `Node`                     | One literal-keyed phantom contract and keyed executor. Dependency types derive from the edge tuple; only compiler internals erase heterogeneity.                       | Graph                         |
| `NodeKey`                  | Run-stable identity used by edges, dependency records, diagnostics and outcomes.                                                                                       | Graph                         |
| `NodeRegistry`             | The heterogeneous keyed registry preserving each node's external keys, output, failure and admitted effect keys.                                                       | Authoring and compilation     |
| `Edge`                     | One directed data dependency from a node output to a dependant node. It unlocks the target after source success even when the valid output is deliberately ignored.    | Graph                         |
| `GraphValue`               | A validated acyclic tree of scalar, array and plain-record values copied and frozen at scheduler ownership boundaries.                                                 | Graph and scheduler           |
| `GraphInput`               | An immutable external value admitted by the host under a declared key.                                                                                                 | Host boundary and graph       |
| `NodeInput`                | The immutable envelope containing a node's declared graph inputs and dependency outputs, keyed by identity.                                                            | Scheduler and node            |
| `NodeOutput`               | The single immutable replacement value produced by one successful node.                                                                                                | Node and graph                |
| `GraphOutput`              | A named projection key mapped to a node key; its value type is derived from that node's output phantom.                                                                | Graph and run                 |
| `JoinNode`                 | An ordinary node whose declared dependency record contains all values to reduce. It is vocabulary for a role, not a distinct scheduler primitive.                      | Graph                         |
| `Run`                      | One process-local evaluation of a captured graph and configuration snapshot with admitted inputs and capabilities.                                                     | Pipeline                      |
| `RunOutcome`               | The algebraic terminal result: succeeded, failed, cancelled or suspended, without scheduler-only pending handoff queues.                                               | Run                           |
| `NodeOutcome`              | The terminal projection for one graph node: succeeded, failed, blocked or cooperatively cancelled.                                                                     | Run                           |
| `PipelineAdmissionFailure` | Algebraic rejection of one caller-owned run field before graph work, identifying options, token, inputs, capabilities or signal.                                       | Public evaluator              |
| `ConfigurationFailure`     | Algebraic pre-run failure retaining all extension failures, graph diagnostics and role failures under deterministic precedence.                                        | Public evaluator              |
| `FailureRecord`            | A typed record retaining role, identity, phase and original error. Participant faults distinguish declared typed failures from unknown throws.                         | Run diagnostics               |
| `PrimaryFailure`           | The authoritative failure selected by canonical graph or commit order, never settlement order.                                                                         | Run outcome                   |
| `Capability`               | An explicit process-local service supplied to node execution but excluded from graph dataflow. Mutable or opaque services belong here.                                 | Host boundary                 |
| `ExecutionPolicy`          | Required scheduler configuration with a positive safe-integer concurrency bound or explicit `'unbounded'`. It cannot redefine graph meaning.                           | Graph and scheduler           |
| `AbortSignal`              | The sole host-to-run cancellation primitive, shared with admitted participants. Abort stops new work and drains admitted work but cannot terminate a process.          | Host boundary and scheduler   |
| `GraphExtension`           | A configuration-time contributor of immutable graph declarations. It cannot observe a run.                                                                             | Authoring and compilation     |
| `GraphContribution`        | One immutable authoring fragment returned by a graph extension, containing contributed nodes, edges, outputs, inert anchors and the matching executors.                | Authoring and compilation     |
| `NodeMiddleware`           | Ordered before/after plus reverse error/cancel phases around one node; cleanup cannot emit effects or capture a continuation.                                          | Node interpreter              |
| `RunObserver`              | A passive consumer of immutable run events and diagnostics. Its failures are contained.                                                                                | Diagnostics                   |
| `EffectRequest`            | Immutable data returned by a node naming an effect participant and payload.                                                                                            | Node output and effect system |
| `EffectRegistry`           | A literal-keyed phantom registry linking each effect key to payload, prepared, receipt and declared-failure types.                                                     | Effect system                 |
| `EffectParticipant`        | An explicit capability implementing prepare, commit and compensate for one effect kind.                                                                                | Effect system                 |
| `EffectJournal`            | The deterministic process-local record ordered by canonical node ordinal and per-node effect ordinal, never settlement time.                                           | Run and effect system         |
| `PauseRequest`             | A successful node's request to stop admission after draining admitted work.                                                                                            | Node and scheduler            |
| `PauseRecord`              | A scheduler-owned `PauseRequest` located by canonical node key and ordinal.                                                                                            | Scheduler and run             |
| `Suspension`               | A private, single-use, process-local resume capability returned after a clean paused drain.                                                                            | Run                           |
| `Resume`                   | The operation that consumes one suspension and continues the same run.                                                                                                 | Pipeline                      |
| `Abandon`                  | The operation that consumes a suspension and compensates its prepared journal without resuming graph work.                                                             | Pipeline and effect system    |
| `Frontier`                 | Runtime-private suspended readiness state. It is owned by a suspension and is not directly public or mutable.                                                          | Scheduler                     |
| `Snapshot`                 | An immutable diagnostic projection only. It carries no resume authority.                                                                                               | Diagnostics                   |
| `Anchor`                   | Optional inert authoring reference to an existing node. It has no scheduling, middleware, admission or effect meaning.                                                 | Authoring                     |

Bare `Input`, `Output`, `Extension`, `Observer`, `Effect`, `Pause`, `Resume`,
`Snapshot` and `Frontier` are prose terms, not sufficient public type names
unless their owner is unambiguous from the enclosing type.

## 2. Terms excluded from the baseline

| Term                | Disposition                         | Reason                                                                                                                                            |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`              | Removed                             | A callable continuation makes one node responsible for the remaining graph and recreates a serial chain.                                          |
| `Stage`             | Removed as runtime authority        | Sequential stages would be a second programme beside the graph. Named lifecycle locations may survive only as compiled `Anchor` values.           |
| `Helper`            | Renamed to `Node`                   | `Helper` understates an independently scheduled dataflow computation and carries v1 chain semantics.                                              |
| `Standard Pipeline` | Removed as a v2 runtime distinction | V2 has one `Pipeline` semantic contract. Product-specific presets belong to authoring adapters, not a second evaluator algebra.                   |
| `Agnostic Pipeline` | Renamed to `Pipeline`               | Runtime independence is part of the base contract rather than a separate public noun.                                                             |
| `Rollback`          | Replaced by effect compensation     | Compensation is one phase of a declared effect participant and follows the unified journal. It is not an arbitrary callback attached to a helper. |
| `Lifecycle hook`    | Split by role                       | Transforming hooks compile to nodes; diagnostics use observers; single-node interception uses middleware; external work uses effect participants. |
| `Reporter`          | Renamed to `RunObserver`            | Reporting is a passive run role, not a mutable service or scheduling authority.                                                                   |
| `Halt`              | Removed                             | Nodes return algebraic success or failure. Cancellation and pause use their own explicit controls. A node cannot halt the graph imperatively.     |
| `Threaded output`   | Removed                             | Each node owns a distinct output; joins are explicit nodes.                                                                                       |
| `Pause snapshot`    | Renamed to `Suspension`             | The value is a live, single-use process-local capability, not portable serialised state.                                                          |

## 3. V1 root surface to v2 disposition

This table covers the current package root exports. `Compatibility only` means
the name may exist in a v1 adapter but cannot influence native v2 scheduling.

| V1 export or family                                                                                 | V2 disposition                | V2 noun or rule                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `createPipeline`                                                                                    | Retain name, adapt semantics  | Owns one declaration, extension tuple and role snapshot and returns a nominal v2 `Pipeline` data token.                                   |
| `makePipeline`                                                                                      | Remove from native v2         | Compatibility factory for the v1 agnostic runtime only.                                                                                   |
| `makeResumablePipeline`                                                                             | Remove from native v2         | Top-level `resume(options)` consumes `Suspension`; Pipeline has no method facade.                                                         |
| `createHelper`                                                                                      | Rename                        | Graph authoring defines a `Node`. A compatibility adapter may translate a serial helper boundary.                                         |
| `Helper`, `HelperDescriptor`                                                                        | Rename and adapt              | Literal-keyed `NodeContract` plus keyed executor; edge-derived dependencies and one output.                                               |
| `HelperKind`                                                                                        | Remove as execution partition | Optional authoring metadata cannot create separate registries or stage authority.                                                         |
| `HelperMode`                                                                                        | Remove from compiled contract | Compiled node identities are unique. Any authoring replacement policy resolves before compilation.                                        |
| `HelperApplyFn`                                                                                     | Rename and narrow             | One entry in keyed `NodeExecutors`; dependencies derive from edges, with no `next`, current output or mutable draft.                      |
| `HelperApplyOptions`                                                                                | Replace                       | `NodeInvocation` with edge-derived input, capabilities and one `AbortSignal`.                                                             |
| `HelperApplyResult`                                                                                 | Replace                       | Algebraic `NodeResult`, including output, declared effect requests and optional pause request.                                            |
| `HelperRollback`                                                                                    | Compatibility only            | Type-only v1 helper cleanup descriptor. The callback is consumer-owned; admission and reverse traversal remain evaluator-owned.           |
| `HelperNext`                                                                                        | Remove                        | No native v2 equivalent.                                                                                                                  |
| `CreateHelperOptions`                                                                               | Replace                       | Node declaration options; exact factory name remains unresolved.                                                                          |
| `PipelineStep`                                                                                      | Rename and adapt              | Immutable `NodeOutcome` or diagnostic execution record, never a stage step.                                                               |
| `HelperExecutionSnapshot`                                                                           | Replace                       | `NodeOutcome`; diagnostic snapshots remain projections without authority.                                                                 |
| `PipelineRunState`                                                                                  | Rename and adapt              | `RunOutcome`; state and terminal result are not conflated.                                                                                |
| `PipelineReporter`                                                                                  | Rename                        | `RunObserver`.                                                                                                                            |
| `PipelineDiagnostic`, `ConflictDiagnostic`, `MissingDependencyDiagnostic`, `UnusedHelperDiagnostic` | Adapt                         | Split compile-time `GraphDiagnostic` from `RunDiagnostics`, `RunEvent` and typed failure records.                                         |
| `PipelinePauseKind`                                                                                 | Adapt                         | A reason or discriminator within `PauseRequest`, not an extension-defined execution mode.                                                 |
| `PipelinePauseOptions`                                                                              | Replace                       | `PauseRequest`; no serialisable-state promise.                                                                                            |
| `PipelinePauseSnapshot`                                                                             | Rename                        | Single-use `Suspension`, consumed by top-level `resume` or compensating `abandon`, with private `Frontier`.                               |
| `PipelinePaused`                                                                                    | Replace                       | The `suspended` variant of `RunOutcome`.                                                                                                  |
| `PipelineStage`, `PipelineStageState`, `PipelineStageResult`                                        | Remove                        | Graph scheduling and `RunOutcome` replace the stage interpreter.                                                                          |
| `PipelineStageDependencies`                                                                         | Remove                        | Scheduler dependencies are internal; node capabilities are explicit run inputs.                                                           |
| `PipelineHelperStageOptions`                                                                        | Remove                        | Node declarations and graph policy replace helper-stage factories.                                                                        |
| `PipelineRegisteredHelper`                                                                          | Replace                       | Compiled node metadata in `Graph`.                                                                                                        |
| `PipelineHelperRollback`                                                                            | Replace                       | `EffectParticipant.compensate` with explicit prepared state.                                                                              |
| `PipelineStageDiagnostics`                                                                          | Replace                       | Compiler and run diagnostics under their owning layers.                                                                                   |
| `PipelineHalt`, `Halt`                                                                              | Remove                        | Native v2 has algebraic outcomes. Compatibility error halt fails; terminal-only result/bare halt succeeds; non-terminal halt is rejected. |
| `AgnosticPipelineOptions`                                                                           | Replace                       | Pipeline or graph creation options with explicit role registries.                                                                         |
| `AgnosticPipeline`                                                                                  | Rename                        | `Pipeline`.                                                                                                                               |
| `ResumablePipeline`                                                                                 | Fold into `Pipeline`          | Top-level `resume(options)` consumes a process-local `Suspension`; no second evaluator exists.                                            |
| `createPipelineExtension`                                                                           | Split                         | Graph contribution uses `GraphExtension`; other behaviours register under their explicit roles.                                           |
| `PipelineExtension`                                                                                 | Split                         | `GraphExtension`, `NodeMiddleware`, `RunObserver` or `EffectParticipant`.                                                                 |
| `PipelineExtensionLifecycle`                                                                        | Remove                        | Lifecycle anchors compile to graph structure; phases are not a second engine.                                                             |
| `PipelineExtensionHook`, `PipelineExtensionHookOptions`, `PipelineExtensionHookResult`              | Split                         | Node transformation becomes a node; diagnostics become observer events; effect work becomes requests and participants.                    |
| `PipelineExtensionHookRegistration`                                                                 | Remove                        | Register the owning role explicitly.                                                                                                      |
| `PipelineExtensionRegisterOutput`                                                                   | Replace                       | Immutable `GraphContribution` during configuration.                                                                                       |
| `CreatePipelineExtensionOptions`                                                                    | Replace                       | Role-specific options, avoiding one wide extension interface.                                                                             |
| `StandardPipelineExtension`                                                                         | Remove                        | Product presets may bundle role values but have no combined runtime role.                                                                 |
| `PipelineRollback`, `createPipelineRollback`                                                        | Replace                       | Native effect participant. A compatibility node must aggregate its complete v1 journal into one native effect request.                    |
| `PipelineRollbackErrorMetadata`, `PipelineExtensionRollbackErrorMetadata`                           | Replace                       | Typed effect failure records carrying participant, request, phase and original error.                                                     |
| `PipelineExecutionMetadata`, `FragmentFinalizationMetadata`                                         | Adapt or move                 | Run/node metadata must belong to explicit outcome or authoring types; product fragment vocabulary is not core runtime vocabulary.         |
| `CreatePipelineOptions`                                                                             | Adapt                         | Immutable declaration, extension tuple, exact-node middleware, observers and exact effect participants.                                   |
| `Pipeline`                                                                                          | Retain, redefine              | Frozen nominal data token for the sole v2 configured evaluator; operations are top-level functions.                                       |
| `ErrorFactory`                                                                                      | Adapt                         | May construct typed boundary errors but cannot replace retained original graph failures.                                                  |
| `MaybePromise`                                                                                      | Retain and export             | Exactly `T \| PromiseLike<T>`; every callable `then` is adopted and only that observation promotes settlement.                            |
| `AwaitedTuple`                                                                                      | Add                           | Fresh mutable result tuple preserving every input position and its recursively awaited fulfilled value type.                              |
| `adoptMaybePromise`, `isPromiseLike`, `maybeAll`, `maybeThen`, `maybeTry`, `processSequentially`    | Retain and export             | The complete shared composition algebra preserves v2 synchronous settlement and carries no graph authority.                               |

## 4. Generic parameter conventions

Use semantic names rather than positional letters:

| Parameter        | Meaning                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `TInputs`        | Complete external graph-input record admitted for a run.                   |
| `TExternal`      | The subset of external graph inputs declared by one node.                  |
| `TDependencies`  | Direct predecessor outputs keyed by `NodeKey`.                             |
| `TOutput`        | One node's immutable output value.                                         |
| `TOutputs`       | The graph's explicit successful output projection.                         |
| `TCapabilities`  | Explicit process-local services excluded from graph data.                  |
| `TFailure`       | Typed failure value returned by a node or participant.                     |
| `TEffects`       | Literal-keyed effect registry linking payload, prepared and receipt types. |
| `TPayload`       | Immutable payload interpreted by an effect participant.                    |
| `TPrepared`      | Immutable process-local value produced by effect preparation.              |
| `TReceipt`       | Immutable result of effect commit used for evidence or compensation.       |
| `TConfiguration` | Immutable configuration supplied while contributing a graph.               |

Public functions take one options object. Positional arguments are acceptable
only for a unary value with no plausible ambiguity. Generic defaults must not
erase the distinction between graph data, capabilities and external effects.

## 5. Verb conventions

| Verb         | Meaning                                                                |
| ------------ | ---------------------------------------------------------------------- |
| `define`     | Create immutable authoring data without compiling or executing it.     |
| `contribute` | Add immutable declarations during ordered configuration.               |
| `compile`    | Validate declarations and create the immutable executable graph.       |
| `run`        | `runPipeline(options)` evaluates one fresh run from admitted input.    |
| `execute`    | Evaluate exactly one node under scheduler authority.                   |
| `observe`    | Consume immutable events without influencing admission or values.      |
| `prepare`    | Establish process-local prepared effect state during node execution.   |
| `commit`     | Apply prepared effects after graph success in canonical order.         |
| `compensate` | Attempt reverse-journal remediation without implying transactionality. |
| `pause`      | Request a drained process-local suspension.                            |
| `resume`     | Consume one suspension and continue the same run.                      |
| `abandon`    | Consume one suspension and compensate its prepared effects.            |
| `cancel`     | Request admission stop and cooperative drain.                          |

Avoid `process`, `handle`, `apply`, `hook` and `executeNext` in the public core
when a more specific verb above identifies the owning interpreter.

## 6. Compatibility boundary

A v1 compatibility adapter may retain `Helper`, `Stage`, `next`, lifecycle-hook
and threaded-output vocabulary inside one explicitly serial compatibility node.
It aggregates the complete v1 commit/rollback journal into one native effect;
an uncapturable rollback contract is unsupported. Error halt fails. Result or
bare halt succeeds only for a terminal compatibility node. V1 pause/resume is
unsupported.

Compatibility documentation must label the semantic loss. It must not describe
v1 `dependsOn` as native v2 dataflow, retain a second rollback authority or
present a v1 pause snapshot as v2 suspension.
