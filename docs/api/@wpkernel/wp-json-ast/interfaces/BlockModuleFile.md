[**@wpkernel/wp-json-ast v0.12.6-beta.3**](../index.md)

---

[@wpkernel/wp-json-ast](../index.md) / BlockModuleFile

# Interface: BlockModuleFile&lt;TMetadata&gt;

## Type Parameters

### TMetadata

`TMetadata` _extends_
\| [`BlockManifestMetadata`](../type-aliases/BlockManifestMetadata.md)
\| [`BlockRegistrarMetadata`](../type-aliases/BlockRegistrarMetadata.md)

## Properties

### docblock

```ts
readonly docblock: readonly string[];
```

---

### fileName

```ts
readonly fileName: string;
```

---

### metadata

```ts
readonly metadata: TMetadata;
```

---

### namespace

```ts
readonly namespace: string | null;
```

---

### program

```ts
readonly program: PhpProgram;
```
