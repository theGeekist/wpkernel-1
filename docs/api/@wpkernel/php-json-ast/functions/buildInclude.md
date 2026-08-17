[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

***

[@wpkernel/php-json-ast](../index.md) / buildInclude

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

`Readonly`&lt;`Record`&lt;`string`, `unknown`&gt;&gt;

Optional attributes for the node.

## Returns

[`PhpExprInclude`](../interfaces/PhpExprInclude.md)

A `PhpExprInclude` node.
