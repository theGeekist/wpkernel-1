# Pipeline v2 execution and effects

> **V2 availability:** This is the current root surface. Import native v2 from
> `@wpkernel/pipeline`; import the serial compatibility adapter from
> `@wpkernel/pipeline/v1`.

## Readiness and concurrency

A node becomes ready when every declared predecessor has succeeded. The
scheduler admits ready nodes in canonical order until the configured capacity
is full. It invokes that selected set in order, but their asynchronous work may
settle in any order. A slow unrelated branch does not create a graph-wide wave
barrier.

On graph failure, Pipeline stops new admission, drains work already admitted,
blocks dependants and retains failures. A synchronous failure does not erase a
sibling already selected for admission. Primary failure follows canonical graph
order, not settlement timing.

Cancellation is cooperative. An already-aborted signal admits no nodes,
prepares or commits. Abort during work stops later admission, lets active work
drain and runs the relevant cleanup. It cannot terminate user code, a child
process or an external request that ignores its signal.

## Synchronous settlement

`MaybePromise<T>` is exactly `T | PromiseLike<T>`. For each participant return,
Pipeline reads `then` once. An absent or non-callable `then` remains
synchronous; a callable `then` is adopted through normal promise resolution;
and a throwing getter is a synchronous participant failure. When configuration,
nodes, middleware, effects and terminal observers are all synchronous, the
operation remains synchronous. Deliberately awaiting an outcome may normalise
that boundary when a caller needs one asynchronous shape. An observer thenable
can delay or promote terminal delivery, but cannot change graph meaning,
admission, values, primary failure or journal order.

Pipeline exports the composition algebra instead of making every consumer
rebuild it:

- `adoptMaybePromise` observes once and returns a tagged record containing
  either the direct value or its adopted native promise;
- `isPromiseLike` applies the same read-once thenable boundary;
- `maybeThen` maps without promoting a direct value;
- `AwaitedTuple` names the fresh mutable tuple of position-specific fulfilled
  values returned by a join;
- `maybeAll` joins values and thenables, returning an `AwaitedTuple` directly
  when all are direct while preserving heterogeneous tuple positions;
- `maybeTry` recovers synchronous throws and asynchronous rejection through one
  shape;
- `processSequentially` traverses in order without manufacturing a promise for
  wholly synchronous work.

These are root exports because they are useful FP primitives, not private
scheduler authority. Native v2 participant observation shares
`adoptMaybePromise`; that does not make the runtime the algebra's owner.

## Runtime roles

`NodeMiddleware` is local to one exact static node key. It has ordered
`before`, `after`, `error` and `cancel` phases. Before phases run forward;
after, error and cancellation unwinds run in reverse among middleware whose
before phase completed. Middleware cannot replace node input or output, recover
a failure, admit nodes, access the scheduler or call `next`.

There is no public node-tag selector. Reuse middleware through a pure factory
that returns separately typed middleware for each node. A selector such as
"all write nodes" would need an implemented tag model, not optimistic prose.

`RunObserver` receives immutable node, effect and terminal events. Observers
run in registration order for an event, but their delivery is not awaited
before admission, preparation, commitment or compensation. Delivery order can
record timing; it cannot change graph semantics.

`EffectParticipant` owns one declared external-effect contract. It alone
interprets a request payload into prepared state, a receipt and compensation.
Nodes and middleware request effects; they do not commit them from their bodies.

## Prepare, commit and compensate

An effect request prepares while its node is executing. Requests within one
node prepare serially; independent nodes may prepare concurrently. Pipeline
assigns each request a logical journal position from canonical node ordinal and
the request's ordinal within that node. It sorts this journal for later work,
not the order in which promises happened to settle.

After every graph node succeeds and admitted work drains, commits run serially
in ascending journal order. If graph work, preparation, commit, cancellation
or abandonment fails, Pipeline compensates every successfully prepared entry
in reverse journal chronology. Compensation is non-cancellable and Pipeline
attempts later entries even if an earlier compensation fails.

This is bounded process-local compensation:

- a node that directly sends an email has created an eager external effect
  outside the journal;
- a participant may fail while compensating, leaving the external system in a
  state the host must reconcile;
- Pipeline does not provide atomicity, durable receipts, idempotency or a
  guarantee that an external effect is delivered only once.

Place durable outbox records, idempotency keys and retry admission in the host.
The participant receives the authority the host supplies; Pipeline does not
manufacture it from a well-organised array.

## Suspension, resume and abandonment

A successful node may return a `PauseRequest`. Pipeline stops new admission,
drains admitted work, checks that there is only one request, then returns a
`suspended` `RunOutcome` containing a live `Suspension`. Prepared effects stay
prepared and uncommitted while suspended.

`resume({ suspension, signal? })` consumes that value once and
continues the same in-memory run. `abandon({ suspension })` consumes it instead
and compensates its prepared journal entries. A second resume, a resume after
abandonment, or a deserialised lookalike has no authority.

Suspension is not a checkpoint format. It can retain callbacks, maps, live
capabilities and private scheduler state. A host that survives deployment or
process loss stores its own durable intent, then constructs and admits a new
Pipeline invocation.
