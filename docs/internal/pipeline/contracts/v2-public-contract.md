# Pipeline v2 public semantic contract

Status: Accepted
Owner task: P2-001
Governing decisions: ADR-001, ADR-002, ADR-003

This document fixes the semantics, public operations and generic relationships
that v2 public types must preserve.

## 1. Boundary and authority

Pipeline v2 evaluates one immutable compiled dataflow graph per process-local
run. A `Pipeline` token is the sole public authority for starting that work.

- The compiled `Graph` is the scheduler's internal execution authority. It is
  reachable publicly only through its owning `Pipeline`. Nodes and extension
  roles cannot admit, suppress or invoke other nodes.
- An `Edge` is a data dependency. It makes the source output available to the
  target and unlocks the target only after the source succeeds. The target need
  not inspect that output; `undefined` and deliberately minimal immutable
  completion facts are valid graph values. An edge is still not a resource
  claim or middleware ordering.
- Nodes receive immutable external inputs and direct predecessor outputs and
  produce independent replacement values. There is no shared draft or threaded
  current output.
- Independent ready nodes may execute concurrently. Timing cannot determine
  values, joins, primary failure, journal order or commit order.
- Pipeline owns evaluation, process-local effects, diagnostics, cancellation
  and suspension. The host owns durable admission and idempotency keys, leases,
  retries, process supervision, portable checkpoints and exactly-once
  external-effect claims.
- Pipeline claims no durability, crash recovery or distributed coordination.

There is no native stage programme, helper chain or callable continuation.

## 2. Value and asynchronous algebras

Graph data is the closed, acyclic `GraphValue` algebra of null, undefined,
booleans, numbers, bigints, strings, recursive arrays and string-keyed records.
`MaybePromise<T>` is exactly `T | PromiseLike<T>`.

Arrays must have exactly `Array.prototype`. Objects must have exactly
`Object.prototype` or `null` as their prototype and own enumerable
string-keyed data properties. Accessors, symbol keys, cycles, functions,
promises, errors, dates, class instances, maps, sets, weak collections, typed
arrays and mutable buffers are not graph values. JavaScript exposes no general
test for transparent proxies, so admission is deliberately observational: every
prototype, own-key and descriptor inspection must succeed and the observed
shape must satisfy this closed algebra. Throwing or exotic proxy behaviour is
rejected; a transparent proxy with an indistinguishable valid shape is admitted
and copied into scheduler-owned data.

At run admission, after each node returns and for every effect-request payload,
the runtime validates, deep-copies and recursively freezes the value before
storing or sharing it. The copy is scheduler-owned; aliases to the caller's
original cannot mutate it.
Capabilities, middleware state and prepared effect state are not graph data.
Capabilities may be shared across concurrent nodes, so their provider owns
thread safety and must not make graph meaning depend on access timing.

`MaybePromise` is exact: the runtime gets `then` once from every participant
return. A non-callable or absent `then` remains synchronous; a callable `then`
is adopted by the ECMAScript promise-resolution procedure. A throwing getter is
a synchronous participant failure. All structurally valid thenables are
accepted, and first settlement wins. The run promotes to a promise only when a
callable `then` is observed.

## 3. Heterogeneous graph and effect types

Node and effect registries retain literal keys and member-specific types through
public compilation. Erasure is permitted only inside compiler and scheduler
implementation details.

```ts
type NodeKey = string;
type EffectKey = string;
declare const nodeType: unique symbol;
declare const effectType: unique symbol;

interface NodeContract<
	TExternalKeys extends string,
	TOutput extends GraphValue,
	TFailure = unknown,
	TEffectKeys extends EffectKey = never,
> {
	readonly externalInputs: readonly TExternalKeys[];
	readonly effectKeys: readonly TEffectKeys[];
	readonly priority: number;
	readonly [nodeType]?: () => {
		readonly output: TOutput;
		readonly failure: TFailure;
	};
}

type NodeRegistry = Readonly<
	Record<NodeKey, NodeContract<string, GraphValue, unknown, EffectKey>>
>;

interface Edge<TFrom extends NodeKey = NodeKey, TTo extends NodeKey = NodeKey> {
	readonly from: TFrom;
	readonly to: TTo;
}

interface EffectContract<
	TPayload extends GraphValue,
	TPrepared,
	TReceipt,
	TFailure,
> {
	readonly [effectType]?: () => {
		readonly payload: TPayload;
		readonly prepared: TPrepared;
		readonly receipt: TReceipt;
		readonly failure: TFailure;
	};
}

type EffectRegistry = Readonly<
	Record<EffectKey, EffectContract<GraphValue, unknown, unknown, unknown>>
>;

type EffectTypes<T> =
	T extends EffectContract<infer P, infer S, infer R, infer F>
		? { payload: P; prepared: S; receipt: R; failure: F }
		: never;
type EffectPayload<T> = EffectTypes<T>['payload'];
type EffectPrepared<T> = EffectTypes<T>['prepared'];
type EffectReceipt<T> = EffectTypes<T>['receipt'];
type EffectFailure<T> = EffectTypes<T>['failure'];
```

`effectKeys` is required runtime declaration data as well as a literal typed
set. The phantom member carries output and failure types that have no runtime
representation; compilation validates every declared effect key against the
participant registry.

The inaccessible optional unique-symbol members are compile-time phantoms, not
readable runtime properties. Consumers construct contracts without assertions,
including the `never` effect-key case; emitted values contain only real fields.

For `TNodes`, edge tuple `TEdges` and node key `K`, invocation dependencies are
derived only from edges whose `to` is `K`:

```ts
type NodeTypes<T> =
	T extends NodeContract<infer I, infer O, infer F, infer E>
		? { input: I; output: O; failure: F; effects: E }
		: never;
type OutputOf<T> = NodeTypes<T>['output'];
type FailureOf<T> = NodeTypes<T>['failure'];
type ExternalKeysOf<T> = NodeTypes<T>['input'];
type EffectKeysOf<T> = NodeTypes<T>['effects'];
type Predecessors<TEdges extends readonly Edge[], K extends NodeKey> = Extract<
	TEdges[number],
	{ readonly to: K }
>['from'];
type DependencyOutputs<
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	K extends keyof TNodes & NodeKey,
> = {
	readonly [P in Predecessors<TEdges, K> & keyof TNodes]: OutputOf<TNodes[P]>;
};

type EffectRequestFor<
	TEffects extends EffectRegistry,
	K extends keyof TEffects,
> = K extends keyof TEffects
	? {
			readonly participant: K;
			readonly payload: EffectPayload<TEffects[K]>;
		}
	: never;

type EffectRequestsFor<
	TEffects extends EffectRegistry,
	K extends keyof TEffects,
> = { [P in K]: EffectRequestFor<TEffects, P> }[K];

type OutputProjection<TNodes extends NodeRegistry> = Readonly<
	Record<string, keyof TNodes & NodeKey>
>;
type GraphOutputs<
	TNodes extends NodeRegistry,
	TProjection extends OutputProjection<TNodes>,
> = { readonly [K in keyof TProjection]: OutputOf<TNodes[TProjection[K]]> };
```

`NodeExecutors` is a keyed mapped type whose dependencies come only from the
canonical edge tuple:

```ts
interface NodeInvocation<TExternal, TDependencies, TCapabilities> {
	readonly input: {
		readonly external: TExternal;
		readonly dependencies: TDependencies;
	};
	readonly capabilities: TCapabilities;
	readonly signal: AbortSignal;
}

type NodeExecutors<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TCapabilities,
> = {
	readonly [K in keyof TNodes & NodeKey]: (
		options: NodeInvocation<
			Readonly<Pick<TInputs, ExternalKeysOf<TNodes[K]> & keyof TInputs>>,
			DependencyOutputs<TNodes, TEdges, K>,
			TCapabilities
		>
	) => MaybePromise<
		NodeResult<
			OutputOf<TNodes[K]>,
			FailureOf<TNodes[K]>,
			EffectRequestsFor<
				TEffects,
				EffectKeysOf<TNodes[K]> & keyof TEffects
			>
		>
	>;
};

type NodeResult<TOutput extends GraphValue, TFailure, TRequest> =
	| {
			readonly kind: 'success';
			readonly output: TOutput;
			readonly effects: readonly TRequest[];
			readonly pause?: PauseRequest;
	  }
	| { readonly kind: 'failure'; readonly error: TFailure }
	| { readonly kind: 'cancelled'; readonly reason?: unknown };
```

A `cancelled` result is valid only after `signal.aborted`; otherwise it is a
node contract failure. Throws and rejections become failures without replacing
the original error.

`GraphDeclaration<TInputs, TNodes, TEdges, TEffects, TProjection,
TCapabilities>` contains keyed contracts and executors, the literal edge tuple,
effect contracts, `TProjection extends OutputProjection<TNodes>` and a required
policy. Its output is exactly `GraphOutputs<TNodes, TProjection>`, never a free
generic. The compiled `Graph` preserves these arguments plus immutable
adjacency and ranks. Compiler-private erased call tables cannot escape the
Pipeline boundary.

One edge exposes its source node's whole output under that node key. A join is
an ordinary node with every source edge declared and an explicit reducer in its
executor. Compilation rejects duplicate keys, missing references, cycles,
invalid projections, effect-key mismatches and invalid policy. The scheduler
never merges or spreads parent values. A dependant may intentionally ignore an
available predecessor output, including `undefined`, when predecessor success
is itself the causal fact. Relations that request order without making source
success or output a prerequisite, and resource relations, require distinct
future types.

## 4. Compilation, registration and canonical order

`createPipeline(options)` owns the base declaration and one dense, immutable
extension-registration tuple in two phases. It first inspects the complete
tuple and captures every callback identity plus every owned configuration,
retaining indexed ownership failures while continuing. Only after that frozen
capture exists does it invoke each valid `GraphExtension.contribute(options)`
callback exactly once, synchronously in tuple order. An earlier callback cannot
rewrite a later callback or configuration before capture. There is no public
registry, `use` method, mutable registration queue or compile operation. A new
configuration requires a new `createPipeline` call.

Every `TConfiguration` extends `GraphValue`. Before contribution begins, the
runtime validates, deep-copies and recursively freezes the configuration and
passes only that owned copy to the callback. Opaque services belong in run
capabilities, never extension configuration. Mutation of the caller's original
configuration after creation cannot change a pending contribution's meaning.

Each callback returns one complete immutable
`MaybePromise<GraphContribution>`. `GraphContribution` is the sole public name
for that authoring fragment. It may contain nodes, edges, anchors and output
projections, and it carries the executors for its contributed nodes. Nested
contribution programmes and re-entrant registration do not exist.

Registration order is the one-based tuple position. `runPipeline(options)`
drains every captured callback despite failure, then compiles every successful
contribution in registration order. It retains every extension failure and
every graph diagnostic produced by the successful subset. If any extension
failed, the lowest registration-order extension failure is primary. Otherwise
the first canonical graph diagnostic is primary. Role-configuration failures
follow extension and graph issues and become primary only when neither exists.
Structural role issues are retained in capture order. Once the final node and
effect identities are knowable, graph-dependent middleware issues follow in
registration order, then extra and missing participant keys in raw UTF-16 key
order. Every knowable issue is collected before any executable role compiler is
called. No graph work is admitted after any configuration failure.

Pending settlement is shared safely by repeated and concurrent runs, while
compiled scheduler state remains run-local. Once the captured generation is
quiescent, a wholly synchronous compile, run and terminal observer path returns
synchronously.

Canonical topological rank is `0` for a source and otherwise one plus the
maximum predecessor rank. Compilation assigns a total canonical node ordinal
by ascending rank, descending finite numeric priority, ascending key, then
ascending registration order, exactly matching ADR-001. Key comparison is raw
UTF-16 code-unit order:
compare the first unequal code unit numerically, with a shorter prefix first.
It never uses locale, normalisation or settlement order. Base declarations
share registration order `0`. Registration order is the final deterministic
tie-break used while reporting duplicate-key compilation failures; valid graph
keys are unique.

The ready comparator is canonical node ordinal. `ExecutionPolicy` requires
`maxConcurrency: PositiveSafeInteger | 'unbounded'`; omission, zero, fractions
and non-finite numbers are invalid. The baseline supplies no implicit default.

## 5. Scheduling, cancellation and observation

The scheduler selects ready nodes in canonical order up to available capacity
and invokes the complete selected set in that order. A synchronous failure does
not suppress selected siblings. A dependant becomes ready as soon as its own
predecessors succeed; unrelated branches create no wave barrier.

`runPipeline({ pipeline, inputs, capabilities, signal? })` accepts the sole
optional `AbortSignal`. Omission creates one internal, never-aborted signal;
the same signal is the only cancellation primitive seen by nodes, middleware,
effect prepare/commit and the scheduler.

Run admission reads each option field once. It validates, deep-copies and
recursively freezes the complete input record synchronously before observing a
pending extension generation; later exact-key validation uses that owned
snapshot without recopying or retaining a caller alias. Capabilities remain a
provider-owned alias. Invalid options, token authority, inputs or signal produce
the exact algebraic `{ kind: 'admission-failed', field, error }` result. A
synchronous generation returns that algebra synchronously. A genuinely pending
generation may promote exact-key validation, but its promise resolves to the
same algebra and does not reject for the caller fault. Throwing run-field
accessors are read once and contained as admission failure.

- If already aborted at invocation, no node, prepare or commit is admitted.
- During graph work or preparation, abort stops new nodes and later forward
  phases or requests within admitted nodes. The active callback or prepare
  drains, each node performs the section 6 cancel unwind, then successful
  prepares are compensated.
- After graph success but before commit, abort admits no commit and compensates.
- During the serial commit queue, abort drains the active commit, admits no
  later commit and then compensates all prepared entries.
- Compensation is non-cancellable. Abort never skips or interrupts an admitted
  compensation, including abandonment cleanup.

Cancellation is cooperative and cannot terminate user code or a process. Every
failure outranks cancellation. An existing graph or commit primary remains
authoritative over compensation failures; absent one, the first compensation
failure makes the run failed.
After admitted work drains, any graph failure outranks every cancel-phase
failure. Without a graph failure, the first cancel failure by canonical node
order then reverse middleware order becomes primary and the run is failed;
later cancel failures are secondary.

The scheduler publishes immutable `RunEvent` values to a FIFO observer-delivery
queue after state transitions. It never awaits observer delivery before node
admission, prepare, commit or compensation. For each event, observers run in
registration order; event order may reflect settlement timing and is diagnostic
only. Terminal settlement waits for delivery through the terminal event, so an
observer promise may delay or promote only the returned terminal outcome.
Observer failures are retained and never alter that outcome or primary failure.

## 6. Middleware

Eligibility is compiled only from the exact static node key named by each
registration. V2 defines no public node-tag system. Middleware cannot change
eligibility at run time. For eligible middleware `M1..Mn` in registration
order. `NodeMiddlewareFor` derives invocation, output and allowed effect-request
types from that exact node, its incoming edges and the effect registry.

Each middleware declaration and registration names exactly one `node`. Reuse
comes from a pure factory returning separately typed `NodeMiddlewareFor` values,
never one callback spanning heterogeneous nodes.

1. `before` runs serially `M1..Mn`. Each successful result yields immutable
   invocation-local state and typed effect requests; its requests prepare
   serially before the next `before`.
2. If all before phases succeed, the node runs once. Its returned output is
   isolated under the graph-value rule before middleware may observe it.
3. On node success, every entered `after` runs serially `Mn..M1`, even after an
   earlier after failure. Successful results may emit typed effect requests,
   prepared before the next after. Output remains hidden until all after work
   succeeds.
4. A before failure skips later before, the node and all after phases. A node
   failure skips after. Any before, node, after or phase-prepare failure invokes
   `error` serially in reverse order for middleware whose before completed.
   Every error phase runs despite errors and returns only `void`.
5. Cancellation without a graph failure invokes a named `cancel` phase serially
   in reverse order for every middleware whose before completed, regardless of
   which later phase was active. Every cancel phase runs despite errors and
   returns only `void`. A local failure plus abort uses only error unwind; a
   later sibling graph failure still supersedes this node's cancel failures.

The first failure in the defined before, node or after invocation order is the
node's failure. Further after and error failures are secondary. Cancel failures
are secondary when a graph failure exists; otherwise the first follows section
5 and becomes primary. Error and cancel phases cannot emit effect requests
because the run cannot commit them. Middleware cannot replace inputs or
outputs, recover failure, admit nodes or access the scheduler. It has no `next`.
Before and after requests use the node's allowed `EffectRequestFor` union and
the unified journal below.

## 7. Unified effects and journal chronology

`EffectParticipants<TEffects>` is an exact literal-keyed mapped registry. Each
participant's `prepare`, `commit` and `compensate` types derive payload,
prepared, receipt and declared-failure values from its `EffectContract`.

Compensation deliberately receives no signal because it is non-cancellable.
Declared failures become `ParticipantFailure` records with `kind: 'declared'`.
Throws, rejected thenables and invalid phase results are retained with
`kind: 'thrown'` and `unknown` error. The registry therefore links every typed
participant failure without pretending JavaScript throws are typed.

Effect requests from middleware and nodes prepare within their admitted node
invocation. Requests are serial within that invocation but may prepare
concurrently across nodes. Each request receives a logical journal sequence
`(canonicalNodeOrdinal, perNodeEffectOrdinal)`. The second component increments
across before, node and after requests in section 6; cleanup emits none. Successful preparation
fills that sequence slot; settlement order never reorders it. This sorted
logical sequence is the deterministic journal chronology required by ADR-002.

A node settles successfully only after its requests prepare. Commit starts only
after graph success and admitted work drains, and runs serially in ascending
logical journal sequence. Graph, prepare, commit, cancellation or abandonment
failure compensates every successfully prepared entry exactly once per
process-local run state, serially in reverse logical journal chronology.
Compensation continues after failures and retains them all. Prepared values and
receipts are journal-owned process-local state and participants must treat them
as immutable.

Direct external mutation by a node, middleware or observer is outside this
guarantee. The journal is process-local evidence, not durable effect authority.

## 8. Outcomes, suspension and abandonment

Every node projects exactly one `succeeded`, `failed`, `blocked` or
cooperatively `cancelled` `NodeOutcome`. `RunOutcome<TOutputs>` is `succeeded`,
`failed`, `cancelled` or `suspended`; every variant includes canonically ordered
`NodeOutcome` values, diagnostics, observer failures and an effect-journal
projection. A failed outcome retains every failure. Scheduler-only
`pendingEffects` and `pendingPauses` are internal handoff state and never appear
on terminal `RunOutcome` values.

On graph failure, admission stops and admitted work drains. The primary graph
failure is the first failed node by canonical ordinal; failures within that node
use section 6 order. Timing never selects it. If graph evaluation succeeds but
commit fails, the first failure in commit order is primary and later commits are
not admitted.

A successful node may return one unlocated `PauseRequest`. On admission the
scheduler creates a `PauseRecord` containing the canonical node identity,
ordinal and request. The first request stops new admission and drains admitted
work; a concurrent second request is a graph failure. Failure outranks
cancellation, which outranks pause.

A clean pause yields a private, single-use `Suspension` containing the same
compiled graph, configuration, frontier, outputs and prepared journal. It is
not serialisable, portable or valid after process death. `resume({ suspension,
signal? })` consumes it and continues that run. `abandon({ suspension })`
instead consumes it, performs non-cancellable reverse-journal compensation and
returns a typed abandonment outcome retaining cleanup failures. Neither
operation may be repeated. Dropping a suspension without either operation has
no cleanup guarantee; the host must retain and explicitly consume it.
Resume reuses the captured signal unless a supplied signal becomes the sole
signal for the resumed segment.

`Frontier` is runtime-private. `Snapshot` means only an immutable diagnostic
projection and grants no resume authority.

## 9. Compatibility and closure rules

A v1 adapter is one serial native node. It may use `next` internally but cannot
affect native readiness. It maps the complete v1 journal, halt and pause
semantics exactly as specified in the vocabulary compatibility boundary; an
uncapturable rollback is unsupported and no second rollback authority remains.

Public callbacks exist only for named interpreter-owned lifetimes: node
execution, middleware phases, observer delivery, effect phases and graph
contribution. Factories return immutable declarations or data tokens. Run,
middleware, extension settlement and prepared state are explicit
interpreter-owned values, not method closures. No callback captures the
remaining graph.

`createPipeline(options)` returns a frozen, null-prototype nominal data token
with only enumerable `kind: 'pipeline'` data plus a real non-enumerable private
type witness. Module-private weak storage binds that exact token to process-local
authority. Spread, clone, proxy, serialised or reflected-brand copies are not
live Pipeline values and `runPipeline` rejects them algebraically as a Pipeline
admission failure. `Pipeline` has no `run`, `use` or `compile` method.

The hand-curated `v2/pipeline` module is the public orchestration surface. It
exports `createPipeline`, `runPipeline`, suspension consumption operations and
the authoring, role, outcome and diagnostic types needed to configure them.
`scheduleGraph`, graph and role compilers, extension generation, journals and
scheduler state remain internal seams.

## 10. Diagnostics, anchors and future policies

Compile-time `GraphDiagnostic` is exactly immutable `{ code, message, path }`,
where `path` is a string array. Runtime `RunDiagnostics` is exactly immutable
`{ nodes, events }`. Each `NodeDiagnostic` contains `node`, `nodeOrdinal`,
diagnostic `state`, and the applicable readiness, blocker, admission
sequence and settlement sequence fields. `RunEvent` remains the closed
`node-transition`, `effect-transition` and `run-terminal` algebra defined in
section 5. These are diagnostic projections without execution authority.

An anchor is an optional immutable authoring reference from an anchor name to
an existing node key. Contributions may add or replace anchors in registration
order. Compilation validates and owns them, but the scheduler does not read
anchors for readiness, precedence, middleware eligibility, admission or
effects. They are inert references for authoring adapters only.

Future scheduling or host policies remain open. They cannot reinterpret
anchors, introduce mutable graph data, stage authority, hidden continuations,
implicit joins, timing-dependent meaning or durability claims.
