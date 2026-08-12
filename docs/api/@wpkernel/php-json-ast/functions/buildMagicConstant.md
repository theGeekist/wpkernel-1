[**@wpkernel/php-json-ast v0.12.6-beta.3**](../README.md)

***

[@wpkernel/php-json-ast](../README.md) / buildMagicConstant

# Function: buildMagicConstant()

```ts
function buildMagicConstant(name, attributes?): PhpScalarMagicConst;
```

Builds a PHP magic constant node such as `__DIR__` or `__FILE__`.

## Parameters

### name

`string`

Magic constant name without surrounding underscores.

### attributes?

`Readonly`&lt;`Record`&lt;`string`, `unknown`&gt;&gt;

Optional attributes for the node.

## Returns

[`PhpScalarMagicConst`](../interfaces/PhpScalarMagicConst.md)

A `PhpScalarMagicConst` node.
