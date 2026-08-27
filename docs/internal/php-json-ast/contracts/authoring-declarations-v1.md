# PHP authoring declarations contract v1

## Status and scope

This is the immutable v1 contract produced by
`authoring-declarations-contract-v1`. It governs the generic declaration,
import, namespace, comment and file-composition surface implemented by
`authoring-declarations-v1`.

It applies below `@wpkernel/wp-json-ast` and above
`@wpkernel/php-json-ast/ast`:

```text
wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast
```

All authoring output is canonical `PhpProgram` and `PhpStmt` data. The
authoring layer does not print PHP, parse PHP, manage generated ownership,
invoke a process, infer WordPress semantics, or mutate an existing program.

This contract is deliberately smaller than PHP. A later capability requires a
new versioned contract or an explicitly compatible amendment. It must not be
smuggled into v1 through raw options, arbitrary AST records, source strings or
new modifier bits.

## Public v1 surface

The implementation exports the following from its eventual
`@wpkernel/php-json-ast/authoring` public front. Its internal normalisers,
descriptor brands and raw lowering helpers remain private.

```ts
interface PhpDeclarationValue {
	readonly kind: 'declaration';
	readonly declarationKind: 'class' | 'function';
}

type PhpTypeInput = string | PhpType | PhpTypeExpression;
type PhpTypeExpression =
	| { readonly kind: 'nullable'; readonly type: PhpTypeInput }
	| { readonly kind: 'union'; readonly types: readonly PhpTypeInput[] }
	| {
			readonly kind: 'intersection';
			readonly types: readonly PhpTypeInput[];
	  };

interface PhpParameterInput {
	readonly name: string;
	readonly type?: PhpTypeInput | null;
	readonly default?: PhpAuthoringValue;
	readonly byReference?: boolean;
	readonly variadic?: boolean;
}

interface PhpFunctionDeclarationInput {
	readonly name: string;
	readonly parameters?: readonly PhpParameterInput[];
	readonly returnType?: PhpTypeInput | null;
	readonly returnsByReference?: boolean;
	readonly statements?: readonly PhpStatementValue[];
	readonly doc?: readonly string[];
}

interface PhpMethodDeclarationInput extends PhpFunctionDeclarationInput {
	readonly visibility?: 'public' | 'protected' | 'private';
	readonly static?: boolean;
	readonly abstract?: boolean;
	readonly final?: boolean;
}

interface PhpClassDeclarationInput {
	readonly name: string;
	readonly abstract?: boolean;
	readonly final?: boolean;
	readonly extends?: string | null;
	readonly implements?: readonly string[];
	readonly methods?: readonly PhpMethodDeclarationInput[];
	readonly doc?: readonly string[];
}

interface PhpImportInput {
	readonly name: string;
	readonly alias?: string | null;
	readonly kind?: 'class' | 'function' | 'const';
}

interface PhpNamespaceInput {
	readonly name: string;
	readonly imports?: readonly PhpImportInput[];
	readonly declarations: readonly PhpDeclarationValue[];
}

interface PhpFileInput {
	readonly strictTypes?: boolean;
	readonly namespace?: PhpNamespaceInput | null;
	readonly declarations: readonly PhpDeclarationValue[];
	readonly doc?: readonly string[];
}

function phpType(input: PhpTypeInput): PhpType;
function parameter(input: PhpParameterInput): PhpParam;
function functionDeclaration(
	input: PhpFunctionDeclarationInput
): PhpDeclarationValue;
function methodDeclaration(input: PhpMethodDeclarationInput): PhpClassStmt;
function classDeclaration(input: PhpClassDeclarationInput): PhpDeclarationValue;
function phpImport(input: PhpImportInput): PhpStmtUse;
function namespaceDeclaration(input: PhpNamespaceInput): PhpStmtNamespace;
function phpFile(input: PhpFileInput): PhpProgram;
```

`methodDeclaration()` is deliberately a class-member factory rather than a
top-level statement factory. `classDeclaration()` is the only v1 consumer of
it. `namespaceDeclaration()` emits one controlled raw namespace statement for
an advanced AST caller; it cannot be supplied back as a declaration or nested
inside another namespace. `phpFile()` is the normal file-composition entry
point.

`PhpDeclarationValue` is a distinct, nominal authoring descriptor. It is not
an alias for `PhpStatementValue`, and declarations never pass through the
existing statement-descriptor `WeakSet` or `renderPhpStatements()` path. The
implementation creates declaration descriptors only in `declarations.ts`,
brands them in that module's private `WeakSet`, and lowers them through a new
private `renderPhpDeclarations()` boundary used only by
`namespaceDeclaration()` and `phpFile()`. A structural object with `kind` or
`declarationKind` fields is rejected as `AMBIGUOUS_VALUE`.

The only accepted declaration descriptor kinds are `class` and `function`.
Methods are accepted only as validated `methods` input to a class declaration.
No raw `PhpStmt`, `PhpStatementValue`, namespace descriptor, import statement,
expression statement or other nested statement is accepted where this contract
names `PhpDeclarationValue`.

## Name and type input

### PHP names

`name`, `extends`, `implements`, import names and named type strings use PHP
namespace-name syntax:

- a name has one or more non-empty identifier segments separated by `\\`;
- each segment follows the existing PHP identifier rule used for callable and
  variable helpers: `[A-Za-z_\\u0080-\\uFFFF][A-Za-z0-9_\\u0080-\\uFFFF]*`;
- one leading `\\` is allowed for fully-qualified type, `extends` and
  `implements` names; imports accept it only to normalise it away;
- the declaration, method, parameter and import-alias names are simple names:
  they cannot contain `\\` or a leading `\\`.

Namespace declaration names are bounded unqualified namespace names: they
cannot begin with `\\`. This prevents `namespaceDeclaration()` and `phpFile()`
from having to assign semantics to a fully-qualified namespace declaration.

Whitespace around a whole name is trimmed. Empty segments, repeated or trailing
separators, a bare `\\`, source punctuation, `::`, `$`, `;` and dynamic names
are invalid. Namespace names lower to `Name`. `extends` and `implements` lower
to `Name` or `Name_FullyQualified` according to their leading slash. Import
names lower to `Name` after an import leading slash has been removed. A
class-like type name lowers to `Name` or `Name_FullyQualified` according to its
leading slash.
Declaration, method, parameter and import-alias names lower to `Identifier`.

### Type vocabulary

`phpType()` accepts the following exact inputs.

| Input                                 | Lowering                        | Notes                                                           |
| ------------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| Simple built-in or pseudo-type string | `Identifier`                    | The permitted keyword set below is validated.                   |
| Class-like name string                | `Name` or `Name_FullyQualified` | A simple non-keyword name is class-like, never an `Identifier`. |
| Existing canonical `PhpType`          | The same node                   | It is accepted only after structural AST validation.            |
| `{ kind: 'nullable', type }`          | `NullableType`                  | `type` cannot itself be nullable, union or intersection.        |
| `{ kind: 'union', types }`            | `UnionType`                     | At least two distinct members.                                  |
| `{ kind: 'intersection', types }`     | `IntersectionType`              | At least two distinct named-class members.                      |

The context-free grammar accepts the built-in or pseudo-type keywords `array`,
`bool`, `callable`, `float`, `int`, `iterable`, `mixed`, `never`, `null`,
`object`, `parent`, `self`, `static`, `string`, `void`, `false` and `true`, or
a class-like PHP name. It validates shape only: a nullable has one atomic
member; a union has at least two atomic members or intersections; and an
intersection has at least two class-like members. A nullable cannot wrap a
nullable, union or intersection, or `mixed`, `never`, `void`, `null`, `false`
or `true`. An intersection cannot contain a built-in or pseudo-type. A union
cannot contain `mixed`, `void` or `never`, cannot repeat a member, and cannot
combine `bool` with `false` or `true`, `false` with `true`, `iterable` with
`array` or `Traversable`, `object` with any class-like member, or a nullable
representation with a separate `null` member. Duplicate type members are
compared after normalising a leading `\\` and case-folding class-like names;
member order otherwise remains caller order.

Contextual validation happens only when a type is assigned to a parameter or
return position. `void`, `never` and `static` are return-only. `static`, `self`
and `parent` are class-method-only, with `parent` requiring that the containing
class has `extends`. `null`, `false` and `true` are union-only. The same
contextual rules apply recursively to every union member. Thus `phpType()` can
construct a canonical shape without knowing a declaration context, while
`parameter()`, `functionDeclaration()` and `methodDeclaration()` decide whether
that shape is legal at its use site.

`PhpType` nodes supplied directly are not an escape hatch: their node type,
required own data fields and recursively supplied members must be valid
canonical type nodes. Attribute maps are preserved; ordinary accessor-backed
records are rejected through descriptor-safe reads. JavaScript `Proxy` traps
remain outside this authoring contract, as recorded by the foundation task:
callers must not pass proxies and the implementation does not claim it can
identify one without triggering it. Type strings do not parse PHP source, so
`A|B`, `?A`, `A&B`, `array<int>` and `Foo[]` are invalid strings rather than
alternate syntaxes for the structured forms above.

## Declarations

### Parameters

`parameter()` lowers to one canonical `Param` node:

- `var` is `Expr_Variable` from `name`, without the caller writing `$`;
- `type` is `null` when absent or explicitly `null`, otherwise `phpType(type)`;
- `default` is `null` when absent, otherwise `renderPhpValue(default)`;
- `byRef` and `variadic` default to `false`; and
- `flags`, `attrGroups` and `hooks` are always `0`, `[]` and `[]`.

Parameters must be dense arrays of trusted plain records. A variadic parameter
cannot have a default. There is no parameter `doc` input: an attempted `doc`
property is rejected as an unknown option because PHP has no parameter-attached
doc comment in this v1 AST surface. Parameter attributes,
promoted-property flags, property hooks and source-derived locations are out
of scope.

### Functions and methods

`functionDeclaration()` lowers to `Stmt_Function` with `name`, `params`,
`returnType`, `byRef`, `stmts`, `attrGroups: []` and `namespacedName: null`.
`methodDeclaration()` lowers to `Stmt_ClassMethod` with the same signature
fields and a validated modifier bitmask. Both lower `statements` through the
existing trusted `renderPhpStatements()` path. Omitting `statements` means an
empty body, not an abstract declaration.

For every named function and method, parameter names are unique under PHP's
case-sensitive variable-name rule, and a variadic parameter must be the final
parameter. These are declaration-level checks because `parameter()` alone has
no sibling list to inspect.

The method vocabulary is exact:

- visibility defaults to `public` and accepts only `public`, `protected` or
  `private`;
- `static`, `abstract` and `final` default to `false`;
- a method cannot be both `abstract` and `final`;
- an abstract method cannot be `private`, cannot be `final`, and must use
  `stmts: null` in its raw AST output. It therefore requires
  `abstract: true` and an omitted `statements` input;
- a non-abstract method always has a statement array, including `[]`.

Function visibility, `static`, `abstract` and `final` do not exist. Anonymous
functions remain expression authoring, not declaration authoring.

### Classes

`classDeclaration()` lowers to `Stmt_Class` with:

- `name: Identifier` from the required simple class name;
- `flags` derived only from `abstract` and `final`;
- `extends` as `null` or one PHP name;
- `implements` as a dense array of PHP names in caller order;
- `stmts` as the ordered output from `methods`;
- `attrGroups: []` and `namespacedName: null`.

`abstract` and `final` both default to `false` and cannot both be true.
`methods` defaults to `[]`. Duplicate implemented names, duplicate method
names under PHP's case-insensitive method-name rule, and duplicate parameter
names under PHP's case-sensitive variable-name rule are rejected. An
abstract method requires an abstract class. A final class cannot contain an
abstract method.

V1 supports classes, named functions and class methods only. It deliberately
does not support anonymous classes, interfaces, traits, enums, backed enums,
class constants, properties, promoted properties, trait adaptations, attributes,
generics, `declare` forms other than the file strict-types option, or arbitrary
class statements. These capabilities require their own versioned declaration
contract, even when canonical raw AST node interfaces already exist.

## Imports and namespaces

`phpImport()` lowers exactly one `Stmt_Use` containing exactly one `UseItem`.
It does not group imports. The PHP-parser type values are fixed by this
contract:

| `kind`            | `Stmt_Use.type` | `UseItem.type` |
| ----------------- | --------------: | -------------: |
| `class` (default) |             `1` |            `0` |
| `function`        |             `2` |            `0` |
| `const`           |             `3` |            `0` |

The imported `name` is a non-empty namespace name. A leading `\\` is
normalised away because import declarations are namespace-relative in their
canonical representation. `alias` is a simple identifier or `null`. Its
effective alias is the explicit alias, or the final segment of `name` when it
is omitted. The omitted alias is still lowered as `alias: null`, allowing the
printer to render PHP's normal implicit alias.

Imports use separate class, function and constant alias namespaces. Class and
function names, aliases and imported targets compare case-insensitively;
constant names and aliases compare case-sensitively. Exact duplicate entries
after that normalisation, including their effective alias, coalesce to one
`Stmt_Use`. Entries with the same kind and effective alias but different target
are `INVALID_STATEMENT`. The same target may be imported under two different
aliases. Aliases in different kinds do not collide.

`namespaceDeclaration()` requires a non-empty named namespace. It lowers to
one `Stmt_Namespace` whose `stmts` are all imports followed by all declaration
statements. Bracketed namespaces and `namespace { ... }` are not v1 inputs.
`namespaceDeclaration()` never emits a top-level `declare` statement.

Imports have deterministic order regardless of caller array order: `class`,
then `function`, then `const`; within a kind, ascending normalised target then
effective alias using a code-unit comparison on the corresponding comparison
keys. No import grouping or locale-sensitive sorting is permitted.
Declarations retain the caller's order.

## Comments

`doc` is an optional non-empty dense array of lines with no leading comment
delimiter. The implementation builds exactly one `Comment_Doc` using
`buildDocComment(doc)` and assigns it as the sole member of
`attributes.comments` on the declaration or file target described below. It
neither concatenates raw source nor accepts prebuilt comment AST.

- class, function and method docs attach to their respective AST node;
- for a file without a namespace, file docs attach to the first emitted
  declaration after any strict-types declare;
- for a namespaced file, file docs attach to `Stmt_Namespace`;
- for a file without a namespace, a file `doc` and a `doc` on the first
  declaration are mutually exclusive and the input is invalid if both exist;
- a file with `doc` and no declaration or namespace is invalid.

`PhpNamespaceInput` has no `doc` property. Direct `namespaceDeclaration()` is
therefore intentionally comment-free; `phpFile()` is the sole file-doc owner.
This makes a namespace/file doc collision unrepresentable.

The generic authoring layer does not create WordPress plugin headers,
`WPK:BEGIN AUTO` markers, ownership metadata or arbitrary line comments.
Those remain WordPress or generated-ownership concerns. Existing raw comments
inside trusted statement descriptors remain available only for statement
bodies, which are outside declaration composition.

## File composition

`phpFile()` is the only v1 file-composer. `strictTypes` defaults to `true`.
Its output has one of these exact layouts:

```text
strictTypes: true, namespace: null
  [Stmt_Declare(strict_types = 1), ...declarations]

strictTypes: false, namespace: null
  [...declarations]

strictTypes: true, namespace: { name, imports, declarations }
  [Stmt_Declare(strict_types = 1), Stmt_Namespace(imports..., declarations...)]

strictTypes: false, namespace: { name, imports, declarations }
  [Stmt_Namespace(imports..., declarations...)]
```

The strict declaration is exactly `Stmt_Declare` containing one `DeclareItem`
with `key: Identifier('strict_types')`, `value: Scalar_Int(1)` and
`stmts: null`. When `strictTypes` is false it is absent, never encoded as
`strict_types=0`. `phpFile()` does not emit the `<?php` opening tag, a closing
tag, blank-line/source-location metadata, file paths or printer options.

At most one namespace may occur. When `namespace` is non-null, top-level
`declarations` must be an empty array and nested `namespace.declarations` is
required. When it is `null` or omitted, imports are unavailable and
top-level `declarations` is required. Empty files are allowed only without a
file doc. These rules make it impossible to accidentally combine global and
named declarations or put imports outside their namespace.

Before lowering, `phpFile()` and `namespaceDeclaration()` reject duplicate
top-level declarations in their single declaration scope. Class names compare
case-insensitively with class names, and function names compare
case-insensitively with function names. A class and a function with the same
spelling are allowed because PHP gives them separate symbol categories. No
descriptor other than a branded `class` or `function` can enter this duplicate
check, so a nested namespace cannot be introduced through the declaration
array.

## Failure contract

Every public factory fails synchronously with `PhpAuthoringError`; it never
returns a partially lowered program. The existing codes remain the v1 public
taxonomy:

| Condition                                                                                                | Code                                 | Path convention                                                                                                                 |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Invalid simple, qualified or alias name                                                                  | `INVALID_IDENTIFIER`                 | `$class.name`, `$function.name`, `$method.name`, `$parameter.name`, `$namespace.name`, `$import.name`, `$import.alias`, `$type` |
| Invalid type structure or position                                                                       | `INVALID_EXPRESSION`                 | `$type`, `$parameter.type`, `$function.returnType`, `$method.returnType`                                                        |
| Invalid declaration/file option, modifier combination, duplicate or unsupported construct                | `INVALID_STATEMENT`                  | `$class`, `$function`, `$method`, `$parameter`, `$namespace`, `$import`, `$file` with an indexed child path                     |
| Untrusted descriptor, accessor-backed object/array, malformed raw canonical type, or raw statement input | `AMBIGUOUS_VALUE`                    | The offending public input path                                                                                                 |
| Invalid default value                                                                                    | The existing `renderPhpValue()` code | The existing value path nested below `$parameter.default`                                                                       |

All option records and arrays are read through the existing descriptor-safe
readers. Public factories must not invoke an accessor, a custom iterator, an
overridden `map`, or a prototype-provided field while validating ordinary
records. JavaScript `Proxy` traps remain outside the contract and are not
claimed to be detectably rejectable. Unknown option keys are rejected rather
than ignored. Error messages name the rejected invariant and a useful
correction; their stable code and path, not their prose, are the machine
contract.

## Compatibility and implementation boundaries

- This is a new semantic surface. It does not change the root package exports,
  legacy `programBuilder`, `BuilderFactory`, existing `wp-json-ast` helpers or
  raw AST constructors. Public-front and package-export work belongs to
  `compiler-public-entrypoints-v1`.
- `programBuilder` source lines, `appendStatement()`, raw use strings and
  BuilderFactory intent records are not accepted as inputs. They may be
  migrated later by a dedicated compatibility task, not by widening v1.
- A caller that needs lower-level AST remains free to use the raw AST package;
  raw AST is not silently treated as a v1 declaration descriptor.
- WordPress-specific docblocks, headers, hooks, routes, ownership markers and
  generated-file metadata remain in `wp-json-ast` or the CLI layer.
- The implementation task may add focused tests for every accepted shape and
  every failure row, including the distinct declaration provenance boundary and
  rejection of raw statements or nested namespaces, but it must not revise this
  document. It must integrate `renderPhpDeclarations()` without widening the
  existing `renderPhpStatements()` statement-body API. Any discovered missing
  shape is a coordinator decision and a new contract revision.

## Required implementation evidence

`authoring-declarations-v1` must identify this exact contract in its handoff
and prove, at minimum:

1. canonical AST snapshots for a strict named-class file, a global named
   function file, imported class/function/const names with aliases, type
   compositions, comments and each modifier combination;
2. the invalid-name, invalid-type, modifier-conflict, ordering, duplicate and
   untrusted-input failures above; and
3. its task-specific focused tests, package typecheck and `git diff --check`.

Those checks qualify the package surface only. PHP syntax, packed-consumer,
source bridge, WordPress, browser and release claims remain with their
dedicated later tasks.
