# @wpkernel/php-json-ast

`@wpkernel/php-json-ast` provides typed TypeScript contracts and builders for
the JSON representation used by `nikic/php-parser`, together with the PHP
bridge used to parse, transform, inspect, and print PHP programs.

The package is experimental. Its low-level AST and bridge capabilities are
substantial, but its public surface, framework-neutral authoring API, pipeline
coupling, and runtime qualification are still being reorganised.

## Architecture direction

The package is being organised into explicit capabilities:

- `ast` — canonical raw PHP node contracts and primitive builders.
- `codec` — versioned PhpParser JSON normalization and schema parity.
- `authoring` — ergonomic values, expressions, statements, declarations,
  files, and typed PHP fragments.
- `source` — parser, printer, codemod, query, and bounded process execution.
- `pipeline` — optional WPKernel orchestration and artifact adapters.

WordPress-specific routes, resources, capabilities, storage, plugin bootstrap,
and block behavior remain in `@wpkernel/wp-json-ast`.

## API reference

See the [generated API reference](/api/@wpkernel/php-json-ast/README).
