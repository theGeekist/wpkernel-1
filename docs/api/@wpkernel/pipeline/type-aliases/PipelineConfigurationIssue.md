[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelineConfigurationIssue

# Type Alias: PipelineConfigurationIssue

```ts
type PipelineConfigurationIssue =
  | {
  failure: GraphExtensionFailure;
  kind: "extension";
}
  | {
  diagnostic: GraphDiagnostic;
  kind: "graph";
}
  | {
  error: GraphSchedulerError;
  kind: "role";
  role: "middleware" | "observer" | "participant";
  index?: number;
  key?: string;
};
```

One retained extension, graph or role issue found before node admission.
