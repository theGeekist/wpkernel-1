# WPKernel Roadmap

**Status**: Active beta development; production qualification is incomplete

**Workspace version**: v0.12.6-beta.3

**Status audit**: 2026-07-31

Package implementation, package verification, integration, packed
qualification, release, and production qualification are tracked separately.
The existence of a harness or passing unit tests does not mean the corresponding
runtime path is production-qualified.

---

## ✓ Completed

### Foundation (Sprints 0-1.5)

Monorepo infrastructure, TypeScript strict mode, Vite 7 builds, Jest coverage,
Playwright configuration, CI/CD, documentation site, and wp-env + Playground
environments. The WordPress/browser E2E suite and required CI gate remain
incomplete.

### Resources & Data (Sprint 1)

`defineResource()` with typed REST contracts, automatic @wordpress/data stores, cache management (invalidate, invalidateAll, cache key matching), React hooks (useGet, useList, usePrefetch), dual-surface API (thin-flat + grouped), client methods (fetch, create, update, remove).

### E2E Utils (Sprint 2)

`@wpkernel/e2e-utils` package with namespaced API, Playwright fixture, test
helpers (auth, REST, store, events, database, project), and utility unit tests.
This marks package implementation, not completion of the currently absent
domain E2E suite.

### Capabilities (Sprint 3)

`defineCapability()` with full capability checking, `can()`/`assert()` helpers, `useCapability()` React hook, capability context management, caching layer, automatic UI control gating, `wpk.capability.denied` events, capability reporter integration, WordPress capability provider.

### Actions (Sprint 4)

Write-path orchestration with `defineAction()`, middleware layer, lifecycle events (`wpk.action.start/complete/error`), cache invalidation, error handling, domain events (`{namespace}.{resource}.created/updated/removed`).

### WordPress Data Integration (Sprint 4)

`configureWPKernel()` provides two integration layers: 1) Registry integration (`wpkEventsPlugin` bridges errors → `core/notices`, connects lifecycle events to `wp.hooks` for ecosystem extensibility, reporter integration) - recommended for production, and 2) Redux middleware (`createActionMiddleware` enables action dispatch via envelopes) - only needed when using `useAction()` React hook. Resources auto-register stores without the bootstrap.

### Unified Reporting (Sprint 4.5)

`createReporter()` with pluggable transports (console, hooks, "all" channel), consolidated logging across all packages, request correlation IDs, reporter context management, noop reporter for production.

### React Hooks Integration (Sprint 5 - Completed, v0.4.0)

- ✓ `useAction()` - Complete action dispatch system with 4 concurrency modes
- ✓ `useGet()` & `useList()` - Resource data fetching hooks
- ✓ `useCapability()` - Capability checks in UI
- ✓ Prefetching hooks: `usePrefetcher()`, `useVisiblePrefetch()`, `useHoverPrefetch()`, `useNextPagePrefetch()`
- ✓ Lazy attachment mechanism for resources defined before UI loads

### Architecture Implementation Sprint 5.5 (Phases 1-9), Completed v0.4.0

Completed the bootstrap transition to `configureWPKernel()`, replaced global UI shims with the adapter-driven runtime, introduced the typed event bus, unified action/capability/job signatures around configuration objects, threaded resource reporters through client/store/cache/transport for full observability, and refreshed the documentation stack so every guide, reference, and showcase page matches the final architecture.

**Phase 8 - Resource Reporter Wiring**: Propagated wpk reporters through resource definitions, clients, store resolvers, and grouped APIs with comprehensive 615-line test suite. Resources now emit structured telemetry aligned with actions/capabilities.

**Phase 9 - Cache & Transport Telemetry**: Extended reporter hierarchy to cache invalidation and transport layer. Request lifecycles now share correlation IDs and structured logs from resource → client → transport → cache. Fully backwards compatible.

---

## 🚧 In Progress

**PHP authoring and codegen qualification**

Reorganise `@wpkernel/php-json-ast` around explicit AST, codec, authoring,
source, and pipeline capabilities; keep `@wpkernel/wp-json-ast` as the
WordPress semantic layer; repair CLI codemod adoption; and restore real
WordPress/browser qualification.

**Production truth loop**

Restore a required packed-artifact path covering scaffold, generate, apply,
plugin activation, authenticated REST behavior, admin/browser behavior, and
repeat generation. The current smoke job proves toolchain mechanics but not
WordPress runtime behavior.

**Guided Examples & Bindings** (post-architecture polish)
Deepen the learning surface with refreshed block binding walkthroughs, Interactivity API blueprints, and expanded showcase coverage that demonstrates the completed wpk architecture in practice.

---

## 🔮 Upcoming

- **Sprint 6** - Admin Mount & UI Surface (minimal admin scaffolding)
- **Sprint 7 follow-up** - CLI upgrade, repair, and packed-consumer qualification
- **Sprint 9** - PHP Bridge (JS → PHP event mirroring, legacy plugin integration)
- **Sprint 10** - Server Bindings (SSR for SEO-critical fields)
- **Sprint 11** - SlotFill (UI extension points)
- **Sprint 13** - CI Matrices & Playgrounds (expanded WP/PHP test matrices)
- **Sprint 14-16** - Showcase App (public discovery, applications, admin pipeline)
- **Sprint 17** - Hardening (performance, accessibility, i18n), including
  DataViews keyboard, contrast, ARIA announcement, and screen-reader guidance.
- **Sprint 18** - Documentation v2 & Migration Guide

**Note:** Sprint 8 (Jobs & background processing) has been descoped. Sprint 12 (Reporter & Transport Middleware) was completed as part of Sprint 4.5 (Unified Reporting).

---

## Timeline

| Phase                     | Status                                             |
| ------------------------- | -------------------------------------------------- |
| Alpha (v0.1.x)            | Complete                                           |
| Beta (v0.4.x–v0.12.x)     | Active                                             |
| PHP codegen qualification | Planned; roadmap baselined                         |
| **RC**                    | Blocked on production truth loop and release gates |
| **v1.0**                  | Planned                                            |

---

**Get Involved**: [GitHub](https://github.com/wpkernel/wpkernel) · [Issues](https://github.com/wpkernel/wpkernel/issues) · [Contributing](https://wpkernel.dev/contributing/)

_Last updated: July 31, 2026_
