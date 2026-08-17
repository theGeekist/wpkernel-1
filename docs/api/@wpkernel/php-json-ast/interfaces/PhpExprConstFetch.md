[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

---

[@wpkernel/php-json-ast](../index.md) / PhpExprConstFetch

# Interface: PhpExprConstFetch

Represents a PHP constant fetch expression (e.g., `MY_CONST`).

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

### name

```ts
readonly name: PhpName;
```

---

### nodeType

```ts
readonly nodeType: "Expr_ConstFetch";
```

#### Overrides

[`PhpExprBase`](PhpExprBase.md).[`nodeType`](PhpExprBase.md#nodetype)
