[**@wpkernel/e2e-utils v0.12.6-beta.3**](../index.md)

***

[@wpkernel/e2e-utils](../index.md) / compareManifestStates

# Function: compareManifestStates()

```ts
function compareManifestStates(workspace, definition): Promise&lt;{
  after: FileManifest;
  before: FileManifest;
  diff: FileManifestDiff;
}&gt;;
```

Apply mutations and collect before/after manifests for comparison.

## Parameters

### workspace

[`IsolatedWorkspace`](../interfaces/IsolatedWorkspace.md)

### definition

[`ManifestComparisonDefinition`](../interfaces/ManifestComparisonDefinition.md)

## Returns

`Promise`&lt;\{
  `after`: [`FileManifest`](../interfaces/FileManifest.md);
  `before`: [`FileManifest`](../interfaces/FileManifest.md);
  `diff`: [`FileManifestDiff`](../interfaces/FileManifestDiff.md);
\}&gt;
