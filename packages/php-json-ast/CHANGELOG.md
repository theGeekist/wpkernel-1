# Changelog

All notable changes to `@wpkernel/php-json-ast` will be documented in this file.

## Unreleased

### Fixed

- Replaced discoverable symbol brands with private runtime provenance for
  authoring descriptors and rejected accessor-backed records and arrays without
  invoking caller-controlled getters.
- Preserved legal `__proto__` data keys through codec normalisation and prevented
  untyped node props from overriding `nodeType` or supplied attributes.

### In progress

- **Phase 8 placeholder** - Task 46 will collect incremental diagnostics (starting with the CLI LogLayer reporter) after the bootstrap flow ships.

## 0.11.0

### Maintenance

- Version bump to `0.11.0` to align with the Phase 7 plugin bootstrap flow release; no JSON AST updates were required.

## 0.10.0

### Maintenance

- Version bump to `0.10.0` to align with the Phase 6 core pipeline release; no JSON AST updates were required.

## 0.9.0

### Maintenance

- Version bump to `0.9.0` to stay aligned with the Phase 5 release; no
  additional AST helpers were required.

## 0.8.0

### Maintenance

- Version bump to `0.8.0` to mirror the CLI command migration release and keep
  downstream generators in sync.

## 0.7.0

### Maintenance

- Version bump to `0.7.0` to align with the Phase 3 release; builders remain unchanged aside from dependency version references.

## 0.1.0

- Initial package scaffolding with attribute helpers and JSON AST guard utilities.
