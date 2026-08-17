[**@wpkernel/e2e-utils v0.12.6-beta.3**](../index.md)

***

[@wpkernel/e2e-utils](../index.md) / ManifestMutationDefinition

# Type Alias: ManifestMutationDefinition

```ts
type ManifestMutationDefinition = 
  | string
  | {
  contents?: string;
  delete?: boolean;
  mode?: number;
};
```

Definition for mutating files between manifest comparisons.
