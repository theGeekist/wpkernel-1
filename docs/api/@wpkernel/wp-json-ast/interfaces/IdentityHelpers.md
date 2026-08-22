[**@wpkernel/wp-json-ast v0.12.6-beta.3**](../index.md)

***

[@wpkernel/wp-json-ast](../index.md) / IdentityHelpers

# Interface: IdentityHelpers

## Properties

### buildIdentityGuardStatements()

```ts
readonly buildIdentityGuardStatements: (options) =&gt; readonly PhpStmt[];
```

#### Parameters

##### options

[`IdentityGuardOptions`](../type-aliases/IdentityGuardOptions.md)

#### Returns

readonly `PhpStmt`[]

***

### resolveIdentityConfig()

```ts
readonly resolveIdentityConfig: (resource) =&gt; ResolvedIdentity;
```

#### Parameters

##### resource

[`IdentityResolutionSource`](IdentityResolutionSource.md)

#### Returns

[`ResolvedIdentity`](../type-aliases/ResolvedIdentity.md)
