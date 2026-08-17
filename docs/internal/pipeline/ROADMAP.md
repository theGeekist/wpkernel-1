# Pipeline v2 roadmap

Architecture version: 1
Role: dependency and execution guidance; task front matter owns status

## Release and consumer lanes

The 1.4.1 patch and v2 are separate release lines:

```text
publish Pipeline 1.4.1
  -> qualify Task Graph against exact 1.4.1
  -> release Task Graph
  -> update WPKernel's exact Task Graph dependency and lockfile
```

Do not override Task Graph's published 1.2.1 dependency from this repository.
Its own repository must qualify and release the corrected dependency first.

The llm-core specification compiler has a separate early migration:

```text
P2-001 contract freeze
  -> remove llm-core's non-semantic Pipeline wrapper
  -> preserve synchronous MaybePromise settlement
  -> preserve the asynchronous authority recheck
```

That work belongs in llm-core. It must not invent a synthetic Pipeline consumer
to justify v2.

## V2 programme

```text
P2-001 semantic contract and vocabulary
  -> P2-002 graph IR and compiler
       -> P2-003 immutable concurrent scheduler
  -> P2-004 middleware and extension compilation

P2-003 + P2-004
  -> P2-005 unified effect journal
  -> P2-006 graph-frontier suspension and concurrent diagnostics

P2-005 + P2-006
  -> P2-007 v1 adapter and consumer integration
       -> P2-008 TSDoc, authored docs and generated API
            -> P2-009 packed qualification and 2.0.0 release
```

P2-002 and P2-004 may run concurrently after P2-001. P2-005 and P2-006 may
run concurrently after their shared runtime contracts settle. P2-007 owns the
shared root exports and therefore integrates those lanes serially.

## Release meaning

Implementation, packed qualification, downstream adoption and publication are
separate evidence states. V2 is not shipped because its source tests pass. The
release task must pack once, qualify that exact archive, bind tag and version,
and publish that same archive through the trusted workflow.
