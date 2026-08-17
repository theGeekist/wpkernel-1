[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

---

[@wpkernel/php-json-ast](../index.md) / PhpExprCastString

# Interface: PhpExprCastString

Represents a PHP string cast expression (e.g., `(string) $var`).

## Extends

- [`PhpExprBase`](PhpExprBase.md)

## Properties

### attributes

```ts
readonly attributes: PhpAttributes;
```

#### Inherited from

[`PhpExprBase`](PhpExprBase.md).[`attributes`](PhpExprBase.md#attributes)

---

### expr

```ts
readonly expr: PhpExpr;
```

---

### nodeType

```ts
readonly nodeType: "Expr_Cast_String";
```

#### Overrides

[`PhpExprBase`](PhpExprBase.md).[`nodeType`](PhpExprBase.md#nodetype)
