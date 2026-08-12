import { createPipeline } from '../createPipeline';
import type {
	Helper,
	PipelineReporter,
	PipelineRunState,
} from '../../core/types';

describe('standard pipeline runner coverage', () => {
	const baseReporter: PipelineReporter = { warn: jest.fn() };

	it('invokes diagnostic factories for conflicts and missing dependencies', () => {
		const conflictSpy = jest.fn();
		const missingSpy = jest.fn();
		const unusedSpy = jest.fn();

		const pipeline = createPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: baseReporter }),
			createFragmentState: () => ({ draft: true }),
			createFragmentArgs: ({ draft, context }) => ({
				context,
				input: draft,
				output: undefined,
				reporter: baseReporter,
			}),
			finalizeFragmentState: ({ draft }) => draft,
			createBuilderArgs: ({ artifact, context }) => ({
				context,
				input: artifact,
				output: undefined,
				reporter: baseReporter,
			}),
			createConflictDiagnostic: conflictSpy,
			createMissingDependencyDiagnostic: missingSpy,
			createUnusedHelperDiagnostic: unusedSpy,
		});

		const helperBase: Helper<
			{ reporter: PipelineReporter },
			unknown,
			unknown,
			PipelineReporter,
			'fragment'
		> = {
			key: 'dup',
			kind: 'fragment',
			mode: 'override',
			priority: 1,
			dependsOn: [],
			apply: () => undefined,
		};

		pipeline.ir.use(helperBase);

		expect(() =>
			pipeline.ir.use({
				...helperBase,
				priority: 2,
			})
		).toThrow('Multiple overrides registered for helper "dup".');

		const missingDepHelper: Helper<
			{ reporter: PipelineReporter },
			unknown,
			unknown,
			PipelineReporter,
			'fragment'
		> = {
			key: 'needs-missing',
			kind: 'fragment',
			mode: 'extend',
			priority: 1,
			dependsOn: ['unknown'],
			apply: () => undefined,
		};

		pipeline.ir.use(missingDepHelper);

		expect(() => pipeline.run({})).toThrow();
		expect(conflictSpy).toHaveBeenCalled();
		expect(missingSpy).toHaveBeenCalled();
		expect(unusedSpy).toHaveBeenCalled();
	});

	it('runs standard extension hooks against the finalised artifact', async () => {
		const reporter: PipelineReporter = { warn: jest.fn() };
		let builderArtifact: unknown;

		const pipeline = createPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter }),
			createFragmentState: () => ({ draftTitle: 'draft' }),
			createFragmentArgs: ({ draft, context }) => ({
				context,
				input: draft,
				output: undefined,
				reporter,
			}),
			finalizeFragmentState: ({ draft }) => ({
				title: `${draft.draftTitle}-finalised`,
			}),
			createBuilderArgs: ({ artifact, context }) => {
				builderArtifact = artifact;
				return {
					context,
					input: artifact,
					output: undefined,
					reporter,
				};
			},
		});

		pipeline.ir.use({
			key: 'fragment',
			kind: 'fragment',
			mode: 'extend',
			priority: 1,
			dependsOn: [],
			apply: () => undefined,
		});

		pipeline.builders.use({
			key: 'builder',
			kind: 'builder',
			mode: 'extend',
			priority: 1,
			dependsOn: [],
			apply: () => undefined,
		});

		pipeline.extensions.use({
			key: 'after-fragments-hook',
			register:
				() =>
				({ artifact }) => {
					expect(artifact).toEqual({ title: 'draft-finalised' });
					return { artifact: { title: 'extension-updated' } };
				},
		});

		pipeline.extensions.use({
			key: 'artifact-hook',
			register: () => ({
				hook: () => ({ artifact: { title: 'artifact-updated' } }),
				lifecycle: 'before-builders',
			}),
		});

		const result = (await pipeline.run({})) as PipelineRunState<{
			title: string;
		}>;

		expect(result.artifact.title).toBe('artifact-updated');
		expect((builderArtifact as { title: string }).title).toBe(
			'artifact-updated'
		);
	});

	it('preserves the artifact when extension hooks return no replacement', async () => {
		const commit = jest.fn();
		const voidHook = jest.fn();
		const pipeline = createPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: baseReporter }),
			createFragmentState: () => ({ value: 'draft' }),
			createFragmentArgs: ({ draft, context }) => ({
				context,
				input: draft,
				output: undefined,
				reporter: baseReporter,
			}),
			finalizeFragmentState: () => ({ value: 'final' }),
			createBuilderArgs: ({ artifact, context }) => ({
				context,
				input: artifact,
				output: undefined,
				reporter: baseReporter,
			}),
		});

		pipeline.extensions.use({
			key: 'void',
			register: () => voidHook,
		});
		pipeline.extensions.use({
			key: 'commit-only',
			register: () => () => ({ commit }),
		});

		const result = (await pipeline.run({})) as PipelineRunState<{
			value: string;
		}>;

		expect(result.artifact).toEqual({ value: 'final' });
		expect(voidHook).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('reports failing helper rollback with the original helper', async () => {
		const onHelperRollbackError = jest.fn();
		const fragment = {
			key: 'fragment.rollback',
			kind: 'fragment' as const,
			mode: 'extend' as const,
			priority: 0,
			dependsOn: [] as const,
			apply: () => ({
				rollback: {
					run: () => {
						throw new Error('rollback failed');
					},
				},
			}),
		};
		const pipeline = createPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: baseReporter }),
			createFragmentState: () => ({}),
			createFragmentArgs: ({ draft, context }) => ({
				context,
				input: draft,
				output: undefined,
				reporter: baseReporter,
			}),
			finalizeFragmentState: ({ draft }) => draft,
			createBuilderArgs: ({ artifact, context }) => ({
				context,
				input: artifact,
				output: undefined,
				reporter: baseReporter,
			}),
			onHelperRollbackError,
		});

		pipeline.ir.use(fragment);
		pipeline.builders.use({
			key: 'builder.failure',
			kind: 'builder',
			mode: 'extend',
			priority: 0,
			dependsOn: [],
			apply: () => {
				throw new Error('builder failed');
			},
		});

		expect(() => pipeline.run({})).toThrow('builder failed');
		expect(onHelperRollbackError).toHaveBeenCalledWith(
			expect.objectContaining({ helper: fragment })
		);
	});

	it('does not finalise a draft after fragment execution halts', () => {
		const finalizeFragmentState = jest.fn(() => ({}));
		const pipeline = createPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: baseReporter }),
			createFragmentState: () => ({}),
			createFragmentArgs: ({ draft, context }) => ({
				context,
				input: draft,
				output: undefined,
				reporter: baseReporter,
			}),
			finalizeFragmentState,
			createBuilderArgs: ({ artifact, context }) => ({
				context,
				input: artifact,
				output: undefined,
				reporter: baseReporter,
			}),
		});

		pipeline.ir.use({
			key: 'fragment.failure',
			kind: 'fragment',
			mode: 'extend',
			priority: 0,
			dependsOn: [],
			apply: () => {
				throw new Error('fragment failed');
			},
		});

		expect(() => pipeline.run({})).toThrow('fragment failed');
		expect(finalizeFragmentState).not.toHaveBeenCalled();
	});

	it('throws for helper kind mismatches with and without custom errors', () => {
		const pipelineWithError = createPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: baseReporter }),
			createFragmentState: () => ({}),
			createFragmentArgs: ({ draft, context }) => ({
				context,
				input: draft,
				output: undefined,
				reporter: baseReporter,
			}),
			finalizeFragmentState: ({ draft }) => draft,
			createBuilderArgs: ({ artifact, context }) => ({
				context,
				input: artifact,
				output: undefined,
				reporter: baseReporter,
			}),
			createError: (code, message) => {
				const error = new Error(message);
				(error as { code?: string }).code = code;
				return error;
			},
		});

		expect(() =>
			pipelineWithError.ir.use({
				key: 'wrong',
				kind: 'builder',
				mode: 'extend',
				priority: 1,
				dependsOn: [],
				apply: () => undefined,
			} as unknown as Helper<
				{ reporter: PipelineReporter },
				unknown,
				unknown,
				PipelineReporter,
				'fragment'
			>)
		).toThrow('expected "fragment"');

		const pipelineNoError = createPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: baseReporter }),
			createFragmentState: () => ({}),
			createFragmentArgs: ({ draft, context }) => ({
				context,
				input: draft,
				output: undefined,
				reporter: baseReporter,
			}),
			finalizeFragmentState: ({ draft }) => draft,
			createBuilderArgs: ({ artifact, context }) => ({
				context,
				input: artifact,
				output: undefined,
				reporter: baseReporter,
			}),
		});

		expect(() =>
			pipelineNoError.builders.use({
				key: 'wrong',
				kind: 'fragment',
				mode: 'extend',
				priority: 1,
				dependsOn: [],
				apply: () => undefined,
			} as unknown as Helper<
				{ reporter: PipelineReporter },
				unknown,
				unknown,
				PipelineReporter,
				'builder'
			>)
		).toThrow('expected "builder"');
	});
});
