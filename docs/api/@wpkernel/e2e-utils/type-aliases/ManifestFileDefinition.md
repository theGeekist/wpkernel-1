[**@wpkernel/e2e-utils v0.12.6-beta.3**](../index.md)

---

[@wpkernel/e2e-utils](../index.md) / ManifestFileDefinition

# Type Alias: ManifestFileDefinition

```ts
type ManifestFileDefinition =
	| string
	| {
			contents: string;
			mode?: number;
	  };
```

Definition for seeding files before collecting a manifest snapshot.
