[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / CreatePipelineOptions

# Interface: CreatePipelineOptions&lt;TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities, TExtensions, TParticipants, TMiddleware&gt;

Complete configuration captured by [createPipeline](../functions/createPipeline.md).

Registration is a one-shot immutable tuple. Extension configuration is
copied and frozen before contribution begins; capabilities remain run-local.

## Example

```ts
import {
  createPipeline,
  runPipeline,
  type GraphDeclaration,
  type NodeContract,
} from '@wpkernel/pipeline';

type Inputs = Readonly&lt;{ source: string }&gt;;
type Nodes = Readonly&lt;{
  uppercase: NodeContract&lt;'source', string, never&gt;;
}&gt;;
type Outputs = Readonly&lt;{ result: 'uppercase' }&gt;;

const declaration: GraphDeclaration&lt;
  Inputs,
  Nodes,
  readonly [],
  Readonly&lt;Record&lt;never, never&gt;&gt;,
  Outputs,
  Readonly&lt;{ locale: string }&gt;
&gt; = {
  inputKeys: ['source'],
  nodes: {
    uppercase: { externalInputs: ['source'], effectKeys: [], priority: 0 },
  },
  edges: [],
  effects: {},
  outputs: { result: 'uppercase' },
  policy: { maxConcurrency: 1 },
  executors: {
    uppercase: ({ input }) =&gt; ({
      kind: 'success',
      output: input.external.source.toUpperCase(),
      effects: [],
    }),
  },
};

const pipeline = createPipeline({ declaration, participants: {} });
const outcome = runPipeline({
  pipeline,
  inputs: { source: 'honest dataflow' },
  capabilities: { locale: 'en-SG' },
});
```

## Type Parameters

### TInputs

`TInputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](../type-aliases/GraphValue.md)&gt;&gt;

### TNodes

`TNodes` *extends* [`NodeRegistry`](../type-aliases/NodeRegistry.md)

### TEdges

`TEdges` *extends* readonly [`Edge`](Edge.md)[]

### TEffects

`TEffects` *extends* [`EffectRegistry`](../type-aliases/EffectRegistry.md)

### TProjection

`TProjection` *extends* [`OutputProjection`](../type-aliases/OutputProjection.md)&lt;`TNodes`&gt;

### TCapabilities

`TCapabilities`

### TExtensions

`TExtensions` *extends* readonly `object`[]

### TParticipants

`TParticipants` *extends* `Readonly`&lt;`Record`&lt;`PropertyKey`, `unknown`&gt;&gt;

### TMiddleware

`TMiddleware` *extends* readonly `object`[]

## Properties

### declaration

```ts
readonly declaration: GraphDeclaration&lt;TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities&gt;;
```

***

### participants

```ts
readonly participants: TParticipants & EffectParticipants&lt;TEffects&gt; & Readonly&lt;Record&lt;Exclude&lt;keyof TParticipants, keyof TEffects&gt;, never&gt;&gt;;
```

***

### extensions?

```ts
readonly optional extensions: TExtensions;
```

Ordered extension tuple. The type checker validates each contribution
against the declaration plus every preceding contribution.

***

### middleware?

```ts
readonly optional middleware: TMiddleware;
```

Ordered middleware tuple. Each registration is checked against its exact
node invocation, output, state and admitted effect requests.

***

### observers?

```ts
readonly optional observers: readonly RunObserver[];
```
