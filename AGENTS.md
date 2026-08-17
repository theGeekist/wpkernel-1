# WPKernel repository rules

## Repository authority and publication

This project uses two GitHub repositories with distinct roles:

- `origin` must be `https://github.com/theGeekist/wpkernel-1.git`. It is the
  authoring fork and the only permitted push target for ordinary development.
- `upstream` must be `https://github.com/wpkernel/wpkernel.git`. It is the
  public projection and must not be pushed to directly.

Before any push, verify the mapping with `git remote -v`. Fail closed if either
remote is absent, renamed, or points somewhere else. Do not compensate by
pushing directly, opening a public pull request, or changing public branches,
tags, releases, or Pages configuration.

Updates to the public projection must go through the established publishing or
sync process. If that process cannot be identified or is unavailable, stop and
ask rather than inventing a replacement. Preserve the repository-local Git
author identity unless an explicit instruction says otherwise.

The canonical operational procedure is
[`docs/maintainers/repository-publication.md`](docs/maintainers/repository-publication.md).
Read it before changing remotes, public workflows, Pages configuration, branch
history, tags, releases, or publication credentials.

## Generated API documentation

`docs/api` is generated output. Update public source TSDoc, then regenerate with
`pnpm docs:api`. Verify the site with `pnpm docs:site` or run the combined
`pnpm docs:build`. Do not hand-edit generated API Markdown.
