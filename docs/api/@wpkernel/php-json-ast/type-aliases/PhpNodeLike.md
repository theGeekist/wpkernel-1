[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

***

[@wpkernel/php-json-ast](../index.md) / PhpNodeLike

# Type Alias: PhpNodeLike

```ts
type PhpNodeLike = 
  | PhpStmt
  | PhpExpr
  | PhpScalar
  | PhpType
  | PhpAttribute
  | PhpAttrGroup
  | PhpParam
  | PhpArg
  | PhpConst
  | PhpClosureUse
  | PhpMatchArm
  | PhpPropertyHook;
```

Represents any PHP AST node that can be part of the syntax tree.
