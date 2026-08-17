[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

---

[@wpkernel/php-json-ast](../index.md) / PhpStmtDeclare

# Interface: PhpStmtDeclare

Represents a PHP `declare` statement.

## Extends

- [`PhpStmtBase`](PhpStmtBase.md)

## Properties

### attributes

```ts
readonly attributes: PhpAttributes;
```

#### Inherited from

[`PhpStmtBase`](PhpStmtBase.md).[`attributes`](PhpStmtBase.md#attributes)

---

### declares

```ts
readonly declares: PhpDeclareItem[];
```

---

### nodeType

```ts
readonly nodeType: "Stmt_Declare";
```

#### Overrides

[`PhpStmtBase`](PhpStmtBase.md).[`nodeType`](PhpStmtBase.md#nodetype)

---

### stmts

```ts
readonly stmts: PhpStmt[] | null;
```
