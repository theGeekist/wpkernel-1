[**@wpkernel/cli v0.12.6-beta.3**](../index.md)

***

[@wpkernel/cli](../index.md) / registerCoreFragments

# Function: registerCoreFragments()

```ts
function registerCoreFragments(): readonly FragmentHelper[];
```

Registers the core IR fragments with the pipeline.

These fragments are responsible for extracting various pieces of information
from the configuration and building up the Intermediate Representation.

## Returns

readonly [`FragmentHelper`](../type-aliases/FragmentHelper.md)[]

The immutable core fragment programme.
