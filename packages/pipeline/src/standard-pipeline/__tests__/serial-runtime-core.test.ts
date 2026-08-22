import {
	createHelper,
	createSerialPipeline,
	runPipeline,
	type PipelineReporter,
	type SerialPipelineExtension,
	type SerialRunOutcome,
} from '../../v1.js';
import { createProgramme } from '../../../tests/serial-runtime.fixture.js';

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

describe('serial v1 compatibility core', () => {
	it('rejects forged programme tokens without evaluating them', () => {
		expect(
			runPipeline({
				pipeline: { kind: 'serial-pipeline' } as never,
				options: {},
			})
		).toMatchObject({ kind: 'failed', error: expect.any(TypeError) });
	});

	it('preserves synchronous settlement', () => {
		const result = runPipeline({
			pipeline: createProgramme(),
			options: {},
		});

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'succeeded',
			result: ['first', 'second'],
		});
		const settled = result as SerialRunOutcome<string[]>;
		if (settled.kind === 'succeeded') {
			expect(settled.native.effectJournal).toHaveLength(1);
			expect(settled.native.effectJournal[0]).not.toHaveProperty(
				'prepared'
			);
			expect(
				Object.values(settled.native.effectJournal[0]!).some(
					(value) => typeof value === 'function'
				)
			).toBe(false);
		}
	});

	it('promotes only genuinely asynchronous helpers', async () => {
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
			createBuilderArgs: ({ context, artifact }) => ({
				context,
				input: undefined,
				output: artifact,
				reporter: context.reporter,
			}),
			createRunResult: ({ artifact }) => artifact,
			fragments: [
				createHelper({
					key: 'async',
					kind: 'fragment',
					apply: async ({ output }) =>
						void (output as string[]).push('async'),
				}),
			],
			builders: [],
		});
		const result = runPipeline({ pipeline, options: {} });

		expect(result).toBeInstanceOf(Promise);
		await expect(result).resolves.toMatchObject({
			kind: 'succeeded',
			result: ['async'],
		});
	});

	it('settles extension commit through the native participant', () => {
		const commit = jest.fn();
		const pipeline = createProgramme({
			extension: {
				key: 'commit',
				lifecycle: 'finalize',
				hook: () => ({ commit }),
			},
		});

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
		});
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('compensates admitted helper work after failure', () => {
		const rollback = jest.fn();
		const result = runPipeline({
			pipeline: createProgramme({ fail: true, rollback }),
			options: {},
		});

		expect(result).toMatchObject({ kind: 'failed' });
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('rejects non-terminal halts and v1 pauses', () => {
		for (const helperControl of [
			{ __halt: true, result: 'too early' },
			{ __paused: true, snapshot: {} },
		]) {
			expect(
				runPipeline({
					pipeline: createProgramme({ helperControl }),
					options: {},
				})
			).toMatchObject({ kind: 'failed' });
		}
	});

	it('classifies terminal halt results', () => {
		expect(
			runPipeline({
				pipeline: createProgramme({
					terminalControl: { __halt: true, result: 'early' },
				}),
				options: {},
			})
		).toMatchObject({ kind: 'succeeded', result: 'early' });
		expect(
			runPipeline({
				pipeline: createProgramme({
					terminalControl: { __halt: true },
				}),
				options: {},
			})
		).toMatchObject({ kind: 'succeeded', result: undefined });
		expect(
			runPipeline({
				pipeline: createProgramme({
					terminalControl: {
						__halt: true,
						error: new Error('terminal failure'),
					},
				}),
				options: {},
			})
		).toMatchObject({ kind: 'failed' });
	});

	it('treats terminal __hasError as failure even without an error property', () => {
		for (const terminalControl of [
			{ __halt: true, __hasError: true },
			{ __halt: true, __hasError: true, result: 'must not win' },
		]) {
			const outcome = runPipeline({
				pipeline: createProgramme({ terminalControl }),
				options: {},
			});

			expect(outcome).toMatchObject({ kind: 'failed' });
			expect(outcome).toHaveProperty('error', undefined);
		}
	});

	it('evaluates builders and every declared extension lifecycle in order', () => {
		const visited: string[] = [];
		const extension = (
			lifecycle: SerialPipelineExtension<
				Context,
				Options,
				string[]
			>['lifecycle']
		): SerialPipelineExtension<Context, Options, string[]> => ({
			key: lifecycle ?? 'default',
			...(lifecycle ? { lifecycle } : {}),
			hook: () => {
				visited.push(lifecycle ?? 'default');
				return {
					commit: () => {
						visited.push(`commit:${lifecycle ?? 'default'}`);
					},
				};
			},
		});
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
			createBuilderArgs: ({ context, artifact }) => ({
				context,
				input: undefined,
				output: artifact,
				reporter: context.reporter,
			}),
			createRunResult: ({ artifact }) => artifact,
			fragments: [
				createHelper({
					key: 'fragment',
					kind: 'fragment',
					apply: ({ output }) =>
						void (output as string[]).push('fragment'),
				}),
			],
			builders: [
				createHelper({
					key: 'builder',
					kind: 'builder',
					apply: ({ output }) => {
						(output as string[]).push('builder');
					},
				}),
			],
			extensions: [
				extension('after-fragments'),
				extension('before-builders'),
				extension('after-builders'),
				extension('finalize'),
				extension(undefined),
			],
		});

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
			result: ['fragment', 'builder'],
		});
		expect(visited).toEqual([
			'after-fragments',
			'default',
			'before-builders',
			'after-builders',
			'finalize',
			'commit:after-fragments',
			'commit:default',
			'commit:before-builders',
			'commit:after-builders',
			'commit:finalize',
		]);
	});

	it('reports missing and unresolved helpers without observer authority', () => {
		const warned = jest.fn(() => {
			throw new Error('observer');
		});
		const pipeline = createSerialPipeline({
			createBuildOptions: () => ({}),
			createContext: () => ({ reporter: { warn: warned } }),
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
			fragments: [
				createHelper({
					key: 'orphan',
					kind: 'fragment',
					dependsOn: ['missing'],
					apply: () => undefined,
				}),
			],
			builders: [],
		});
		const outcome = runPipeline({ pipeline, options: {} });
		expect(outcome).toMatchObject({ kind: 'failed' });
		expect(warned).toHaveBeenCalled();
	});

	it('adopts thenables once and preserves the first settlement', async () => {
		let reads = 0;
		const thenable = {
			get then() {
				reads += 1;
				return (
					resolve: (value: void) => void,
					reject: (error: unknown) => void
				) => {
					resolve();
					reject(new Error('late'));
				};
			},
		};
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
			createBuilderArgs: ({ context, artifact }) => ({
				context,
				input: undefined,
				output: artifact,
				reporter: context.reporter,
			}),
			createRunResult: ({ artifact }) => artifact,
			fragments: [
				createHelper({
					key: 'thenable',
					kind: 'fragment',
					apply: () => thenable as never,
				}),
			],
			builders: [],
		});
		await expect(
			runPipeline({ pipeline, options: {} })
		).resolves.toMatchObject({ kind: 'succeeded' });
		expect(reads).toBe(1);
	});

	it('projects cancellation from an already aborted run', () => {
		const controller = new AbortController();
		controller.abort('stop');
		expect(
			runPipeline({
				pipeline: createProgramme(),
				options: {},
				signal: controller.signal,
			})
		).toMatchObject({ kind: 'cancelled' });
	});

	it('caches an asynchronous next continuation and permits post-processing', async () => {
		let calls = 0;
		const programme = createSerialPipeline({
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
					apply: async (_args, next) => {
						const first = next?.();
						const second = next?.();
						expect(first).toBe(second);
						await first;
						const settled = await next?.();
						return { output: [...(settled as string[]), 'after'] };
					},
				}),
				createHelper({
					key: 'downstream',
					kind: 'fragment',
					apply: async ({ output }) => {
						calls += 1;
						return {
							output: [...(output as string[]), 'downstream'],
						};
					},
				}),
			],
			builders: [],
		});
		await expect(
			runPipeline({ pipeline: programme, options: {} })
		).resolves.toMatchObject({
			kind: 'succeeded',
			result: ['downstream', 'after'],
		});
		expect(calls).toBe(1);
	});

	it('preserves an outer failure until launched downstream work settles', async () => {
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
						apply: (_args, next) => {
							visited.push('outer');
							void next?.();
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
});
