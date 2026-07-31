# @wpkernel/php-json-ast

Typed TypeScript contracts, builders, and runtime bridges for working with the
JSON AST emitted by
[`nikic/php-parser`](https://github.com/nikic/PHP-Parser).

> **Status:** Experimental. Low-level AST construction, PHP parsing/printing,
> codemod ingestion, diagnostics, NodeFinder queries, and a BuilderFactory
> prototype exist. The public API and the missing framework-neutral authoring
> layer are being reorganised and qualified.

## Installation

```bash
pnpm add @wpkernel/php-json-ast
```

## Usage

The current stable building blocks are the typed raw node constructors:

```ts
import {
	buildReturn,
	buildScalarString,
	type PhpProgram,
} from '@wpkernel/php-json-ast';

const program: PhpProgram = [buildReturn(buildScalarString('Hello'))];
```

The package roadmap is introducing explicit `ast`, `authoring`, `source`, and
`pipeline` entry points. New integrations should avoid unsupported deep imports.

## Contributing

This package is part of the WPKernel monorepo. Please see the root [CONTRIBUTING](../../DEVELOPMENT.md) guide for local development instructions.
