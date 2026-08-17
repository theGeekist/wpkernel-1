# Repository publication

This runbook defines the authority boundary between the WPKernel authoring
repository and its public projection. Use it before changing remotes, branch
history, documentation deployment, tags, releases, or publication credentials.

## Authority map

| Role                              | Repository              | Local remote | Allowed routine writes                   |
| --------------------------------- | ----------------------- | ------------ | ---------------------------------------- |
| Authoring authority               | `theGeekist/wpkernel-1` | `origin`     | Branches and ordinary development pushes |
| Public projection and Pages owner | `wpkernel/wpkernel`     | `upstream`   | Automated Pages deployments only         |

The repository-local identity is:

```text
Pipe Work <780157+pipewrk@users.noreply.github.com>
```

The expected local configuration is:

```bash
git remote -v
git config --get remote.pushDefault
git config --local --get user.name
git config --local --get user.email
```

Expected results:

- `origin` resolves to `https://github.com/theGeekist/wpkernel-1.git`.
- `upstream` resolves to `https://github.com/wpkernel/wpkernel.git`.
- `remote.pushDefault` is `origin`.
- `.husky/pre-push` rejects every push URL except the authoring repository.

## Ordinary development flow

1. Commit with the repository-local Pipe Work identity.
2. Push only to `origin`.
3. Wait for the authoring repository's `CI` workflow to pass for the exact main
   SHA.
4. The public repository's `Deploy Documentation` workflow polls authoring main,
   verifies the identity and exact-SHA CI result, builds the site from that
   checkout, and deploys only the Pages artifact.

The Pages workflow runs every fifteen minutes and supports manual dispatch. It
has no permission to write public source, tags, releases, or npm packages.

## Documentation source

`docs/api` is generated from the authoring repository:

```bash
pnpm docs:api
pnpm docs:site
```

The generated site must contain `docs/.vitepress/dist/api/index.html` and each
package must have its own `index.html`. Do not repair generated Markdown by
hand.

## Recovery and exceptional operations

Before rewriting authoring history:

1. Fetch both remotes and record their exact main SHAs.
2. Create and verify a recovery branch at the current authoring main.
3. Preserve local refs, stashes, dirty tracked changes, and untracked files.
4. Use an exact `--force-with-lease` value. Never use an unqualified force.

The 2026-08-17 recovery anchor is:

```text
recovery/pre-projection-main-20260817
```

Changing the public Pages workflow is exceptional. Make and qualify the same
workflow change in the authoring repository first. A one-time public bootstrap
requires explicit approval. It must not weaken permissions or add source,
tag, release, or package publication.

## Diagnosing a broken public API route

Check these in order:

1. The exact authoring main SHA and its `CI` conclusion.
2. The public `Deploy Documentation` workflow result and deployed source SHA.
3. The Pages artifact for `api/index.html` and package `index.html` files.
4. The live response from `https://wpkernel.dev/api/`.

If authoring CI has not passed, deployment is intentionally deferred. Do not
push directly to public main or bypass the qualification check.

## Out of scope

Source-tree projection, tags, GitHub releases, and npm publication are separate
capabilities. They require their own authority, credentials, validation, and
recovery design. The documentation workflow must never grow those powers.
