import { createHelper, createSerialPipeline, runPipeline } from '../../v1.js';

describe('serial consumer callback authority', () => {
	it('invokes author callbacks and participants without a bound interpreter', () => {
		const bound: Array<readonly [string, unknown]> = [];
		const record = (name: string, receiver: unknown) =>
			void bound.push([name, receiver]);
		const fragment = createHelper({
			key: 'fragment',
			kind: 'fragment',
			apply(this: unknown) {
				record('fragment.apply', this);
				return { output: ['fragment'] };
			},
		});
		const builder = createHelper({
			key: 'builder',
			kind: 'builder',
			apply(this: unknown) {
				record('builder.apply', this);
				return { output: ['builder'] };
			},
		});
		const pipeline = createSerialPipeline({
			createBuildOptions(this: unknown) {
				record('createBuildOptions', this);
				return {};
			},
			createContext(this: unknown) {
				record('createContext', this);
				return { reporter: {} };
			},
			createFragmentState(this: unknown) {
				record('createFragmentState', this);
				return [] as string[];
			},
			createFragmentArgs(this: unknown, { context, draft }) {
				record('createFragmentArgs', this);
				return {
					context,
					input: undefined,
					output: draft,
					reporter: context.reporter,
				};
			},
			adoptFragmentOutput(this: unknown, { output }) {
				record('adoptFragmentOutput', this);
				return output;
			},
			finalizeFragmentState(this: unknown, { draft }) {
				record('finalizeFragmentState', this);
				return draft;
			},
			createBuilderArgs(this: unknown, { context, artifact }) {
				record('createBuilderArgs', this);
				return {
					context,
					input: undefined,
					output: artifact,
					reporter: context.reporter,
				};
			},
			adoptBuilderOutput(this: unknown, { output }) {
				record('adoptBuilderOutput', this);
				return output;
			},
			createRunResult(this: unknown, { artifact, steps }) {
				record('createRunResult', this);
				expect(steps[0]).toHaveProperty('origin', undefined);
				expect(Object.hasOwn(steps[0]!, 'origin')).toBe(true);
				return artifact;
			},
			fragments: [fragment],
			builders: [builder],
			extensions: [
				{
					key: 'extension',
					hook(this: unknown) {
						record('extension.hook', this);
						return {
							commit(this: unknown) {
								record('extension.commit', this);
							},
						};
					},
				},
			],
		});

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
			result: ['builder'],
		});
		expect(bound.map(([name]) => name)).toEqual([
			'createContext',
			'createBuildOptions',
			'createFragmentState',
			'createFragmentArgs',
			'fragment.apply',
			'adoptFragmentOutput',
			'finalizeFragmentState',
			'extension.hook',
			'createBuilderArgs',
			'builder.apply',
			'adoptBuilderOutput',
			'extension.commit',
			'createRunResult',
		]);
		for (const [, receiver] of bound) {
			expect(receiver).toBeUndefined();
		}
	});

	it('invokes diagnostics, rollback observers and reporters unbound', () => {
		const calls: Array<readonly [string, unknown]> = [];
		const capture = (name: string, receiver: unknown) =>
			void calls.push([name, receiver]);
		const helper = createHelper({
			key: 'helper',
			kind: 'fragment',
			apply(this: unknown) {
				capture('helper.apply', this);
				return {
					rollback: {
						run(this: unknown) {
							capture('helper.rollback', this);
							throw new Error('rollback');
						},
					},
				};
			},
		});
		const pipeline = createSerialPipeline({
			createError(this: unknown, _code, message) {
				capture('createError', this);
				return new Error(message);
			},
			createBuildOptions: () => ({}),
			createContext: () => ({
				reporter: {
					warn(this: unknown) {
						capture('reporter.warn', this);
					},
				},
			}),
			createFragmentState: () => [],
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
			createRunResult: () => {
				throw new Error('run');
			},
			fragments: [helper],
			builders: [],
			extensions: [
				{
					key: 'extension',
					lifecycle: 'finalize',
					hook(this: unknown) {
						capture('extension.hook', this);
						return {
							rollback(this: unknown) {
								capture('extension.rollback', this);
								throw new Error('extension rollback');
							},
						};
					},
				},
			],
			onHelperRollbackError(this: unknown) {
				capture('onHelperRollbackError', this);
			},
			onExtensionRollbackError(this: unknown) {
				capture('onExtensionRollbackError', this);
			},
		});
		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'failed',
		});

		const missing = createHelper({
			key: 'missing',
			kind: 'fragment',
			dependsOn: ['absent'],
			apply: () => undefined,
		});
		const diagnosticPipeline = createSerialPipeline({
			createError(this: unknown, _code, message) {
				capture('createError', this);
				return new Error(message);
			},
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: {} }),
			createFragmentState: () => [],
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
			fragments: [missing],
			builders: [],
			createMissingDependencyDiagnostic(
				this: unknown,
				{ dependency, message }
			) {
				capture('createMissingDependencyDiagnostic', this);
				return {
					type: 'missing-dependency',
					key: 'missing',
					dependency,
					message,
				};
			},
			createUnusedHelperDiagnostic(this: unknown, { message }) {
				capture('createUnusedHelperDiagnostic', this);
				return { type: 'unused-helper', key: 'missing', message };
			},
			onDiagnostic(this: unknown) {
				capture('onDiagnostic', this);
			},
		});
		expect(
			runPipeline({ pipeline: diagnosticPipeline, options: {} })
		).toMatchObject({ kind: 'failed' });
		expect(calls.map(([name]) => name)).toEqual([
			'helper.apply',
			'extension.hook',
			'extension.rollback',
			'onExtensionRollbackError',
			'reporter.warn',
			'helper.rollback',
			'onHelperRollbackError',
			'reporter.warn',
			'createMissingDependencyDiagnostic',
			'onDiagnostic',
			'createUnusedHelperDiagnostic',
			'onDiagnostic',
			'createError',
		]);
		for (const [, receiver] of calls) {
			expect(receiver).toBeUndefined();
		}
	});
});
