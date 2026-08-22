# Pipeline v2 architecture

Pipeline v2 has one execution authority: the immutable compiled graph owned by
one `Pipeline` token. A caller creates the token from a declaration and
creation-time role values; `runPipeline` then starts a fresh process-local run.
No node, extension, middleware value or observer can start, skip or invoke
another node.

> **V2 availability:** This is the reviewed v2 surface. Its public examples
> use the future `@wpkernel/pipeline` root import, which P2-007 exposes. The
> current `@wpkernel/pipeline` 1.4.1 release remains the v1 API.

## Graph dataflow, not stage order

An edge is a data dependency. It says that the target executor receives the
source node's whole output under the source key. It does not say merely "run
this first" and it is not a resource reservation or a middleware selector.

```text
parse ─┐
       ├─> render ─> publish
theme ─┘
```

`render` is the join. Its executor declares how `parse` and `theme` become its
own output. The scheduler never merges parent objects, spreads values or picks
the last value to settle.

The target does not have to inspect every predecessor output. `undefined` is a
valid graph value, so an edge can express a causal success dependency whose
value is deliberately irrelevant, or whose output is only a small immutable
completion fact. The edge still makes that output available and only unlocks
the target after the source succeeds. It is therefore not generic ordering, a
resource reservation or a middleware relation.

Nodes receive a frozen snapshot of their declared external inputs and direct
predecessor outputs. Each returns an independent replacement value. There is
no shared draft, current output, helper chain, stage programme or `next`.

## Canonical order and timing

Canonical order provides reproducible admission and diagnostics:

1. ascending topological rank;
2. descending finite node priority;
3. ascending raw UTF-16 node key;
4. ascending registration order.

The scheduler admits ready nodes in that order until the concurrency policy is
full. It does not wait for an unrelated branch before admitting a dependent
whose own predecessors have succeeded. Once nodes are running, their
settlement timing does not choose values, joins, primary failures, journal
chronology or commit order.

Priority ranks already-ready work. It does not create a dependency, change the
graph value, or permit a node to overtake an unmet predecessor.

## Owned values and live capabilities

Graph values are the closed algebra of primitive values, arrays and
string-keyed plain records. At input admission, node output and effect-request
boundaries, Pipeline validates, deep-copies and recursively freezes the value.
The stored value is Pipeline-owned: later mutation through the caller's alias
cannot change a graph run.

Capabilities are different. They are live, process-local services passed to
nodes and effect participants, such as a database client or credential broker.
They are not copied, frozen or made deterministic by Pipeline. A capability
provider must make concurrent access safe and must not allow access timing to
change graph meaning.

That distinction excludes a common awkward shortcut: putting a client, promise
or `Map` inside a graph input or extension configuration. Put static data in
the owned value; put the live service in capabilities.

## Admission versus diagnostics

Pipeline captures creation-time extensions before any contribution callback
runs. It copies and freezes each extension configuration, then invokes valid
contributions once in tuple order. Each run drains the captured generation and
collects extension failures, graph diagnostics and role configuration issues
before it calls an executable scheduler role.

Configuration failure is therefore an algebraic result, not partially admitted
graph work. The primary issue is canonical: lowest extension registration
failure first, otherwise the first canonical graph diagnostic, then role
configuration failures. The result retains the rest for diagnosis.

Run events are different. Observers receive immutable events after scheduler
state transitions. Event delivery can reflect real settlement timing and is
diagnostic only. It never decides node admission, graph values or primary
failure.

## Host boundary

Pipeline owns graph compilation, readiness scheduling, run-local diagnostics,
cancellation, live suspension and its in-memory effect journal. The host owns
durable admission, idempotency keys, leases, retry policy, portable
checkpoints, process supervision and external-effect authority.

A process can suspend a run after admitted work drains, then resume its live
`Suspension` once. It cannot write that value to a queue and expect another
process to resume it after a deployment. The host records durable intent and
constructs a new invocation when that is required.
