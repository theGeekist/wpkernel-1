[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

***

[@wpkernel/php-json-ast](../index.md) / buildDocComment

# Function: buildDocComment()

```ts
function buildDocComment(lines, location): PhpDocComment;
```

Builds a PHP DocBlock comment node.

## Parameters

### lines

readonly `string`[]

An array of strings, where each string is a line of the docblock content.

### location

[`PhpCommentLocation`](../interfaces/PhpCommentLocation.md) = `{}`

Optional location information for the comment.

## Returns

[`PhpDocComment`](../type-aliases/PhpDocComment.md)

A `PhpDocComment` node.
