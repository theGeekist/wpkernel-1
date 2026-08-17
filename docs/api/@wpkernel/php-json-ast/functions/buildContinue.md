[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

---

[@wpkernel/php-json-ast](../index.md) / buildContinue

# Function: buildContinue()

```ts
function buildContinue(num, attributes?): PhpStmtContinue;
```

Builds a PHP `continue` statement node.

## Parameters

### num

The optional number of loops to continue (e.g., `continue 2`).

[`PhpExpr`](../type-aliases/PhpExpr.md) | `null`

### attributes?

`Readonly`&lt;`Record`&lt;`string`, `unknown`&gt;&gt;

Optional attributes for the node.

## Returns

[`PhpStmtContinue`](../interfaces/PhpStmtContinue.md)

A `PhpStmtContinue` node.
