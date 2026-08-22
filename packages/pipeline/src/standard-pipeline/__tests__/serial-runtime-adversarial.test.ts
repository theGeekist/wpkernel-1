import {
	createHelper,
	createSerialPipeline,
	runPipeline,
	type PipelineReporter,
	type CreateSerialPipelineOptions,
	type SerialPipelineExtension,
} from '../../v1.js';
import * as nativeRuntime from '../../v2/pipeline/runtime.js';
import * as serialPrepare from '../serial-prepare.js';

type Context = { readonly reporter: PipelineReporter };
type Options = { readonly async?: boolean };

function createDeferred() {
	let resolve!: () => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<void>((onResolve, onReject) => {
		resolve = onResolve;
		reject = onReject;
	});
	return { promise, resolve, reject };
}

function createProgramme(overrides?: {
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
				apply: ({ output }, _next) => {
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

describe('serial v1 compatibility adversarial paths', () => {
	it('preserves an asynchronous outer rejection over launched downstream settlement', async () => {
		for (const settlement of ['fulfil', 'reject'] as const) {
			const visited: string[] = [];
			const deferred = createDeferred();
			const pipeline = createSerialPipeline({
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
				createRunResult: ({ artifact }) => artifact,
				fragments: [
					createHelper({
						key: 'outer',
						kind: 'fragment',
						apply: async (_args, next) => {
							visited.push('outer');
							void next?.();
							await Promise.resolve();
							throw new Error('outer');
						},
					}),
					createHelper({
						key: 'downstream',
						kind: 'fragment',
						dependsOn: ['outer'],
						apply: () => {
							visited.push('downstream');
							return deferred.promise;
						},
					}),
				],
				builders: [],
			});
			const run = runPipeline({ pipeline, options: {} });
			let settled = false;
			void Promise.resolve(run).then(() => {
				settled = true;
			});
			await Promise.resolve();
			await Promise.resolve();
			expect(settled).toBe(false);
			if (settlement === 'fulfil') {
				deferred.resolve();
			} else {
				deferred.reject(new Error('downstream'));
			}
			const outcome = await run;
			expect(outcome).toMatchObject({
				kind: 'failed',
				error: expect.objectContaining({ message: 'outer' }),
			});
			expect(visited).toEqual(['outer', 'downstream']);
		}
	});

	it('settles asynchronous extension commit and rejects extension evaluation', async () => {
		const committed = jest.fn();
		await expect(
			runPipeline({
				pipeline: createProgramme({
					extension: {
						key: 'async',
						lifecycle: 'finalize',
						hook: async () => ({
							commit: async () => {
								committed();
							},
						}),
					},
				}),
				options: {},
			})
		).resolves.toMatchObject({ kind: 'succeeded' });
		expect(committed).toHaveBeenCalledTimes(1);
		await expect(
			runPipeline({
				pipeline: createProgramme({
					extension: {
						key: 'reject',
						lifecycle: 'finalize',
						hook: () => Promise.reject(new Error('extension')),
					},
				}),
				options: {},
			})
		).resolves.toMatchObject({ kind: 'failed' });
	});

	it('retains an explicit around output while asynchronous downstream drains', async () => {
		const pipeline = createSerialPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: {} }),
			createFragmentState: () => [] as string[],
			createFragmentArgs: ({ context, draft }) => ({
				context,
				input: undefined,
				output: draft,
				reporter: context.reporter,
			}),
			finalizeFragmentState: ({ draft }) => draft,
			adoptFragmentOutput: ({ output }) => output as string[],
			createBuilderArgs: ({ context, artifact }) => ({
				context,
				input: undefined,
				output: artifact,
				reporter: context.reporter,
			}),
			createRunResult: ({ artifact }) => artifact,
			fragments: [
				createHelper({
					key: 'around',
					kind: 'fragment',
					apply: (_args, next) => {
						void next?.();
						return { output: ['explicit'] };
					},
				}),
				createHelper({
					key: 'later',
					kind: 'fragment',
					dependsOn: ['around'],
					apply: async () => undefined,
				}),
			],
			builders: [],
		});
		await expect(
			runPipeline({ pipeline, options: {} })
		).resolves.toMatchObject({ kind: 'succeeded', result: ['explicit'] });
	});

	it('rejects duplicate overrides and reports cyclic helper order', () => {
		const override = createHelper({
			key: 'same',
			kind: 'fragment',
			mode: 'override',
			apply: () => undefined,
		});
		expect(() =>
			createSerialPipeline({
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
				createRunResult: ({ artifact }) => artifact,
				fragments: [override, override],
				builders: [],
			})
		).toThrow();

		const warned = jest.fn();
		const cyclic = createSerialPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: { warn: warned } }),
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
			createRunResult: ({ artifact }) => artifact,
			fragments: [
				createHelper({
					key: 'a',
					kind: 'fragment',
					dependsOn: ['b'],
					apply: () => undefined,
				}),
				createHelper({
					key: 'b',
					kind: 'fragment',
					dependsOn: ['a'],
					apply: () => undefined,
				}),
			],
			builders: [],
		});
		expect(runPipeline({ pipeline: cyclic, options: {} })).toMatchObject({
			kind: 'failed',
		});
		expect(warned).toHaveBeenCalled();
	});

	it('contains asynchronous commit and compensation failures', async () => {
		await expect(
			runPipeline({
				pipeline: createProgramme({
					extension: {
						key: 'commit-fail',
						lifecycle: 'finalize',
						hook: () => ({
							commit: () => Promise.reject(new Error('commit')),
						}),
					},
				}),
				options: {},
			})
		).resolves.toMatchObject({ kind: 'failed' });
		for (const rollback of [
			() => Promise.resolve(),
			() => Promise.reject(new Error('rollback')),
		]) {
			await expect(
				runPipeline({
					pipeline: createProgramme({ fail: true, rollback }),
					options: {},
				})
			).resolves.toMatchObject({ kind: 'failed' });
		}
	});

	it('contains rejected internal asynchronous boundaries defensively', async () => {
		const prepare = jest
			.spyOn(serialPrepare, 'evaluateSerialRun')
			.mockReturnValueOnce(Promise.reject(new Error('prepare boundary')));
		await expect(
			runPipeline({ pipeline: createProgramme(), options: {} })
		).resolves.toMatchObject({ kind: 'failed' });
		prepare.mockRestore();

		const nativeRun = jest
			.spyOn(nativeRuntime, 'runPipeline')
			.mockReturnValueOnce(
				Promise.reject(new Error('native boundary')) as never
			);
		await expect(
			runPipeline({ pipeline: createProgramme(), options: {} })
		).resolves.toMatchObject({
			kind: 'failed',
			error: expect.objectContaining({ message: 'native boundary' }),
		});
		nativeRun.mockRestore();
	});

	it('validates the complete static authoring boundary', () => {
		const options: CreateSerialPipelineOptions<
			object,
			object,
			Context,
			string[],
			string[],
			string[]
		> = {
			createBuildOptions: () => ({}),
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
			createRunResult: ({ artifact }) => artifact,
			fragments: [],
			builders: [],
		};
		expect(() =>
			createSerialPipeline({
				...options,
				fragmentKind: 'same',
				builderKind: 'same',
			})
		).toThrow();
		expect(() =>
			createSerialPipeline({ ...options, fragments: [null as never] })
		).toThrow();
		expect(() =>
			createSerialPipeline({
				...options,
				fragments: [
					createHelper({
						key: 'wrong',
						kind: 'builder',
						apply: () => undefined,
					}),
				],
			})
		).toThrow();
		expect(() =>
			createSerialPipeline({
				...options,
				extensions: [{ key: 'bad', hook: null } as never],
			})
		).toThrow();
		const original = createHelper({
			key: 'replace',
			kind: 'fragment',
			apply: () => undefined,
		});
		const replacement = createHelper({
			key: 'replace',
			kind: 'fragment',
			mode: 'override',
			apply: () => undefined,
		});
		expect(() =>
			createSerialPipeline({
				...options,
				fragments: [original, replacement],
			})
		).not.toThrow();
	});

	it('allows an outer helper to contain synchronous downstream failure with explicit output', () => {
		const visited: string[] = [];
		const pipeline = createSerialPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: {} }),
			createFragmentState: () => [] as string[],
			createFragmentArgs: ({ context, draft }) => ({
				context,
				input: undefined,
				output: draft,
				reporter: context.reporter,
			}),
			finalizeFragmentState: ({ draft }) => draft,
			adoptFragmentOutput: ({ output }) => output as string[],
			createBuilderArgs: ({ context, artifact }) => ({
				context,
				input: undefined,
				output: artifact,
				reporter: context.reporter,
			}),
			createRunResult: ({ artifact }) => artifact,
			fragments: [
				createHelper({
					key: 'outer',
					kind: 'fragment',
					apply: (_args, next) => {
						visited.push('outer');
						expect(() => next?.()).toThrow('downstream');
						expect(() => next?.()).toThrow('downstream');
						return { output: ['recovered'] };
					},
				}),
				createHelper({
					key: 'downstream',
					kind: 'fragment',
					dependsOn: ['outer'],
					apply: () => {
						visited.push('downstream');
						throw new Error('downstream');
					},
				}),
			],
			builders: [],
		});
		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
			result: ['recovered'],
		});
		expect(visited).toEqual(['outer', 'downstream']);
	});
});
