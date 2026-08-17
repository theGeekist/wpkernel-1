[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

***

[@wpkernel/php-json-ast](../index.md) / PhpStmtTraitUse

# Interface: PhpStmtTraitUse

Represents a PHP `trait use` statement.

## Extends

- [`PhpStmtBase`](PhpStmtBase.md)

## Properties

### adaptations

```ts
readonly adaptations: PhpNode[];
```

***

### attributes

```ts
readonly attributes: PhpAttributes;
```

#### Inherited from

[`PhpStmtBase`](PhpStmtBase.md).[`attributes`](PhpStmtBase.md#attributes)

***

### nodeType

```ts
readonly nodeType: "Stmt_TraitUse";
```

#### Overrides

[`PhpStmtBase`](PhpStmtBase.md).[`nodeType`](PhpStmtBase.md#nodetype)

***

### traits

```ts
readonly traits: PhpName[];
```
