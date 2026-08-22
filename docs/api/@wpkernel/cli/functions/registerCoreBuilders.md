[**@wpkernel/cli v0.12.6-beta.3**](../index.md)

***

[@wpkernel/cli](../index.md) / registerCoreBuilders

# Function: registerCoreBuilders()

```ts
function registerCoreBuilders(): readonly BuilderHelper[];
```

Registers the core builders with the pipeline.

These builders are responsible for taking the Intermediate Representation
and generating various output artifacts (e.g., PHP, TypeScript, bundles).

## Returns

readonly [`BuilderHelper`](../type-aliases/BuilderHelper.md)[]

The immutable core builder programme.
