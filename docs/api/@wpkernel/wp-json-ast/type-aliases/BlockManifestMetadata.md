[**@wpkernel/wp-json-ast v0.12.6-beta.3**](../index.md)

***

[@wpkernel/wp-json-ast](../index.md) / BlockManifestMetadata

# Type Alias: BlockManifestMetadata

```ts
type BlockManifestMetadata = BasePhpFileMetadata & object;
```

Metadata for a block manifest.

## Type Declaration

### kind

```ts
readonly kind: "block-manifest";
```

The kind of metadata.

### name?

```ts
readonly optional name: string;
```

The name of the block.

### validation?

```ts
readonly optional validation: object;
```

Validation errors for the manifest.

#### validation.errors

```ts
readonly errors: readonly BlockManifestValidationError[];
```

The validation errors.
