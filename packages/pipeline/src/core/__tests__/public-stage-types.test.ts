import {
	createHelper,
	createSerialPipeline,
	runPipeline,
	type CreateSerialPipelineOptions,
	type PipelineReporter,
	type PipelineRunState,
} from '../../v1.js';

type Context = { readonly reporter: PipelineReporter };
type Result = PipelineRunState<readonly string[]>;

const options: CreateSerialPipelineOptions<
	Record<string, never>,
	Record<string, never>,
	Context,
	string[],
	readonly string[],
	Result,
	void,
	string[],
	void,
	readonly string[]
> = {
	createBuildOptions: () => ({}),
	createContext: () => ({ reporter: {} }),
	createFragmentState: () => [],
	createFragmentArgs: ({ context, draft }) => ({
		context,
		input: undefined,
		output: draft,
		reporter: context.reporter,
	}),
	finalizeFragmentState: ({ draft }) => Object.freeze([...draft]),
	createBuilderArgs: ({ context, artifact }) => ({
		context,
		input: undefined,
		output: artifact,
		reporter: context.reporter,
	}),
	createRunResult: ({ artifact, diagnostics, steps }) => ({
		artifact,
		diagnostics,
		steps,
	}),
	fragments: [
		createHelper({
			key: 'fragment',
			kind: 'fragment',
			apply: ({ output }) => void output.push('fragment'),
		}),
	],
	builders: [],
};

describe('public serial compatibility types', () => {
	it('constructs and runs without exposing mutable registration', () => {
		const pipeline = createSerialPipeline(options);
		const result = runPipeline({ pipeline, options: {} });

		expect(pipeline.kind).toBe('serial-pipeline');
		expect(result).not.toBeInstanceOf(Promise);
		// @ts-expect-error compatibility programmes have no mutable registration
		void pipeline.use;
		// @ts-expect-error compatibility programmes have no runner method
		void pipeline.run;
	});
});
