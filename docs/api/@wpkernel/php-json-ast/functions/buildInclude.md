[**@wpkernel/php-json-ast v0.12.6-beta.3**](../README.md)

***

[@wpkernel/php-json-ast](../README.md) / buildInclude

# Function: buildInclude()

```ts
function buildInclude(
   expr,
   type,
   attributes?): PhpExprInclude;
```

Builds a PHP include or require expression.

## Parameters

### expr

[`PhpExpr`](../type-aliases/PhpExpr.md)

Path expression to include.

### type

[`PhpIncludeType`](../type-aliases/PhpIncludeType.md)

Include/require operation type.

### attributes?

`Readonly`<`Record`<`string`, `unknown`>>

Optional attributes for the node.

## Returns

[`PhpExprInclude`](../interfaces/PhpExprInclude.md)

A `PhpExprInclude` node.
