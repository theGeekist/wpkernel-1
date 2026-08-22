import {
	createHelper,
	createSerialPipeline,
	type PipelineReporter,
	type SerialPipelineExtension,
} from '../src/v1.js';

type Context = { readonly reporter: PipelineReporter };
type Options = { readonly async?: boolean };

export function createProgramme(overrides?: {
	readonly fail?: boolean;
	readonly rollback?: () => void;
	readonly extension?: SerialPipelineExtension<Context, Options, string[]>;
	readonly helperControl?: unknown;
	readonly terminalControl?: unknown;
}) {
	return createSerialPipeline({
		createBuildOptions: (options: Options) => options,
		createContext: () => ({ reporter: {} }),
		createFragmentState: () => [] as string[],
		createFragmentArgs: ({ context, draft }) => ({
			context,
			input: undefined,
			output: draft,
			reporter: context.reporter,
		}),
		finalizeFragmentState: ({ draft }) => draft,
		createBuilderArgs: ({ context, artifact }) => ({
			context,
			input: undefined,
			output: artifact,
			reporter: context.reporter,
		}),
		createRunResult: ({ artifact }) =>
			overrides && 'terminalControl' in overrides
				? overrides.terminalControl
				: artifact,
		fragments: [
			createHelper({
				key: 'first',
				kind: 'fragment',
				apply: ({ output }) => {
					(output as string[]).push('first');
					return overrides?.rollback
						? { rollback: { run: overrides.rollback } }
						: undefined;
				},
			}),
			createHelper({
				key: 'second',
				kind: 'fragment',
				apply: ({ output }) => {
					if (overrides?.fail) {
						throw new Error('helper failed');
					}
					(output as string[]).push('second');
					return overrides?.helperControl as never;
				},
			}),
		],
		builders: [],
		extensions: overrides?.extension ? [overrides.extension] : [],
	});
}
