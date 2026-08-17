# Pipeline v2 task briefs

Task front matter is the executable authority for status, dependencies and
write ownership. Pipeline uses the task-schema v1 stages `contract`, `source`,
`integration`, `qualification` and `release`. Status values are `proposed`, `ready`,
`claimed`, `in_progress`, `review`, `blocked`, `done` and `cancelled`.

Workers must read [`../README.md`](../README.md),
[`../COORDINATION.md`](../COORDINATION.md), the named ADRs and their task brief
before editing. Shared exports, manifests, lockfiles, generated API output and
release surfaces belong to integration or release tasks only.

P2-010 is a non-blocking delivery investigation. It measures why implementation
work can finish early while review and qualification consume most of the elapsed
time. It is deliberately outside the Pipeline v2 release dependency chain.
