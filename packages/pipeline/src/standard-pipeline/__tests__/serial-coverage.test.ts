import {
	createHelper,
	createSerialPipeline,
	runPipeline,
	type PipelineReporter,
} from '../../v1.js';
import {
	openSerialRun,
	releaseSerialRun,
	retainFinalisedSerialRun,
} from '../serial-authority.js';
import * as serialPrepare from '../serial-prepare.js';
import * as serialSettlement from '../serial-settlement.js';
import * as nativeRuntime from '../../v2/pipeline/runtime.js';
import {
	commitSerialEffect,
	compensateSerialEffect,
	prepareSerialEffect,
	serialNodeExecutor,
} from '../serial-participant.js';
import {
	projectNativeOutcome,
	readEffectFailure,
	readGraphFailure,
	readNativeFailure,
} from '../serial-projection.js';

type Context = { readonly reporter: PipelineReporter };

function options(overrides: Record<string, unknown> = {}) {
	return {
		createBuildOptions: () => ({}),
		createContext: () => ({ reporter: {} }),
		createFragmentState: () => [] as string[],
		createFragmentArgs: ({
			context,
			draft,
		}: {
			readonly context: Context;
			readonly draft: string[];
		}) => ({
			context,
			input: undefined,
			output: draft,
			reporter: context.reporter,
		}),
		finalizeFragmentState: ({ draft }: { readonly draft: string[] }) =>
			draft,
		createBuilderArgs: ({
			context,
			artifact,
		}: {
			readonly context: Context;
			readonly artifact: string[];
		}) => ({
			context,
			input: undefined,
			output: artifact,
			reporter: context.reporter,
		}),
		createRunResult: ({ artifact }: { readonly artifact: string[] }) =>
			artifact,
		fragments: [],
		builders: [],
		...overrides,
	};
}

function hostileThenable(error: unknown) {
	return Object.defineProperty({}, 'then', {
		get() {
			throw error;
		},
	});
}

describe('serial compatibility defensive coverage', () => {
	it('covers helper output, compensation and extension result variants', async () => {
		const extensionRollback = jest.fn();
		const pipeline = createSerialPipeline({
			...options(),
			adoptFragmentOutput: ({ output }) => output as string[],
			adoptBuilderOutput: ({ output }) => output as string[],
			fragments: [
				createHelper({
					key: 'empty-rollback',
					kind: 'fragment',
					origin: 'coverage',
					apply: () => ({
						output: ['fragment'],
						rollback: undefined,
					}),
				}),
			],
			builders: [
				createHelper({
					key: 'builder',
					kind: 'builder',
					apply: () => ({ output: ['builder'] }),
				}),
			],
			extensions: [
				{ key: 'default', hook: () => undefined },
				{
					key: 'replace',
					lifecycle: 'before-builders',
					hook: () => ({ artifact: ['extension'] }),
				},
				{
					key: 'rollback',
					lifecycle: 'after-builders',
					hook: () => ({ rollback: extensionRollback }),
				},
			],
		});

		expect(await runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
			result: ['builder'],
		});
		expect(extensionRollback).not.toHaveBeenCalled();
	});

	it('covers cached failure without explicit recovery and hostile thenables', () => {
		const downstream = new Error('downstream');
		const cachedFailure = createSerialPipeline({
			...options(),
			fragments: [
				createHelper({
					key: 'outer',
					kind: 'fragment',
					apply: (_args, next) => {
						try {
							next?.();
						} catch {}
					},
				}),
				createHelper({
					key: 'downstream',
					kind: 'fragment',
					dependsOn: ['outer'],
					apply: () => {
						throw downstream;
					},
				}),
			],
		});
		expect(
			runPipeline({ pipeline: cachedFailure, options: {} })
		).toMatchObject({
			kind: 'failed',
			error: downstream,
		});

		const hostile = createSerialPipeline({
			...options(),
			fragments: [
				createHelper({
					key: 'hostile',
					kind: 'fragment',
					apply: () =>
						hostileThenable(new Error('then getter')) as never,
				}),
			],
		});
		expect(runPipeline({ pipeline: hostile, options: {} })).toMatchObject({
			kind: 'failed',
		});
	});

	it('shares pending and settled continuation output without an explicit result', async () => {
		for (const asynchronous of [false, true]) {
			const pipeline = createSerialPipeline({
				...options(),
				adoptFragmentOutput: ({ output }) => output as string[],
				fragments: [
					createHelper({
						key: 'around',
						kind: 'fragment',
						apply: (_args, next) => {
							const downstream = next?.(['replacement']);
							return asynchronous
								? Promise.resolve()
										.then(() => downstream)
										.then(() => undefined)
								: undefined;
						},
					}),
					createHelper({
						key: 'downstream',
						kind: 'fragment',
						dependsOn: ['around'],
						apply: ({ output }) => {
							const mutate = () =>
								void (output as string[]).push('downstream');
							return asynchronous
								? Promise.resolve().then(mutate)
								: mutate();
						},
					}),
				],
			});
			expect(await runPipeline({ pipeline, options: {} })).toMatchObject({
				kind: 'succeeded',
				result: ['replacement', 'downstream'],
			});
		}
	});

	it('adopts pending continuation output when the wrapper returns no output', async () => {
		const pipeline = createSerialPipeline({
			...options(),
			adoptFragmentOutput: ({ output }) => output as string[],
			fragments: [
				createHelper({
					key: 'around',
					kind: 'fragment',
					apply: (_args, next) => void next?.(['replacement']),
				}),
				createHelper({
					key: 'downstream',
					kind: 'fragment',
					dependsOn: ['around'],
					apply: async ({ output }) => {
						await Promise.resolve();
						(output as string[]).push('downstream');
					},
				}),
			],
		});
		expect(await runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
			result: ['replacement', 'downstream'],
		});
	});

	it('covers synchronous extension and finalisation failures', () => {
		for (const pipeline of [
			createSerialPipeline({
				...options(),
				extensions: [
					{
						key: 'throw',
						hook: () => {
							throw new Error('extension');
						},
					},
				],
			}),
			createSerialPipeline({
				...options(),
				finalizeFragmentState: () => {
					throw new Error('finalize');
				},
			}),
		]) {
			expect(runPipeline({ pipeline, options: {} })).toMatchObject({
				kind: 'failed',
			});
		}
	});

	it('uses the default result and captures pre-state and observed failures', () => {
		const defaultResult = createSerialPipeline({
			...options(),
			createRunResult: undefined,
		});
		expect(
			runPipeline({ pipeline: defaultResult, options: {} })
		).toMatchObject({
			kind: 'succeeded',
			result: { artifact: [], diagnostics: [], steps: [] },
		});

		const beforeState = createSerialPipeline({
			...options(),
			createBuildOptions: () => {
				throw new Error('before state');
			},
		});
		expect(
			runPipeline({ pipeline: beforeState, options: {} })
		).toMatchObject({
			kind: 'failed',
		});

		const observedFailure = createSerialPipeline({
			...options(),
			createRunResult: () =>
				hostileThenable(new Error('result then')) as never,
		});
		expect(
			runPipeline({ pipeline: observedFailure, options: {} })
		).toMatchObject({
			kind: 'failed',
		});
	});

	it('covers native defensive participants without exposing them publicly', () => {
		expect(serialNodeExecutor({ capabilities: { run: {} } })).toMatchObject(
			{ kind: 'failure' }
		);
		expect(prepareSerialEffect({ payload: 'missing' })).toMatchObject({
			kind: 'failure',
		});

		const run = { programme: {} as never, options: {} };
		const handle = openSerialRun(run);
		const prepare = jest
			.spyOn(serialPrepare, 'evaluateSerialRun')
			.mockReturnValueOnce(
				hostileThenable(new Error('prepare')) as never
			);
		expect(prepareSerialEffect({ payload: handle })).toMatchObject({
			kind: 'failure',
		});
		prepare.mockRestore();
		releaseSerialRun(handle);

		const prepared = { journal: [] } as never;
		const commit = jest
			.spyOn(serialSettlement, 'commitSerialRun')
			.mockReturnValueOnce(hostileThenable(new Error('commit')) as never);
		expect(commitSerialEffect({ prepared })).toMatchObject({
			kind: 'failure',
		});
		commit.mockRestore();
		const compensate = jest
			.spyOn(serialSettlement, 'compensateSerialRun')
			.mockReturnValueOnce(
				hostileThenable(new Error('compensate')) as never
			);
		expect(compensateSerialEffect({ prepared })).toMatchObject({
			kind: 'failure',
		});
		compensate.mockRestore();
	});

	it('unwraps only recognised native failure variants', () => {
		const original = { error: 'inner', marker: 'original' };
		const effect = {
			participant: 'serial.evaluate',
			phase: 'commit',
			kind: 'declared',
			error: original,
		};
		expect(readEffectFailure(effect)).toBe(original);
		expect(readEffectFailure({ ...effect, kind: 'unknown' })).toMatchObject(
			{
				kind: 'unknown',
			}
		);
		expect(readGraphFailure(original)).toBe(original);
		expect(
			readGraphFailure({
				node: 'node',
				nodeOrdinal: 0,
				kind: 'effect',
				error: effect,
			})
		).toBe(original);
		const unknownGraphFailure = {
			node: 'node',
			nodeOrdinal: 0,
			kind: 'unknown',
			error: original,
		};
		expect(readGraphFailure(unknownGraphFailure)).toBe(unknownGraphFailure);
		expect(
			readGraphFailure({
				node: 'node',
				nodeOrdinal: 0,
				kind: 'contract',
				error: original,
			})
		).toBe(original);
		expect(readNativeFailure(null)).toBeNull();
		expect(
			readNativeFailure({ kind: 'admission-failed', error: original })
		).toBe(original);
		expect(
			readNativeFailure({
				kind: 'failed',
				primaryFailure: {
					node: 'node',
					nodeOrdinal: 0,
					kind: 'thrown',
					error: original,
				},
				nodes: [],
				failures: [],
			})
		).toBe(original);
		expect(readNativeFailure({ kind: 'other' })).toEqual({ kind: 'other' });
		expect(readNativeFailure({ kind: 'admission-failed' })).toEqual({
			kind: 'admission-failed',
		});
	});

	it('projects success authority gaps, cancellation and admission failures', () => {
		const evidence = {
			nodes: [],
			observerFailures: [],
			effectJournal: [],
			effectFailures: [],
			diagnostics: {},
		};
		expect(
			projectNativeOutcome(
				{ kind: 'succeeded', outputs: {}, ...evidence } as never,
				'missing'
			)
		).toMatchObject({ kind: 'failed' });
		expect(
			projectNativeOutcome(
				{ kind: 'succeeded', outputs: {}, ...evidence } as never,
				undefined
			)
		).toMatchObject({ kind: 'failed' });
		const failedHandle = openSerialRun({
			programme: {} as never,
			options: {},
		});
		retainFinalisedSerialRun(failedHandle, {
			kind: 'failed',
			error: 'prepared',
		});
		expect(
			projectNativeOutcome(
				{ kind: 'succeeded', outputs: {}, ...evidence } as never,
				failedHandle
			)
		).toMatchObject({ kind: 'failed', error: 'prepared' });
		releaseSerialRun(failedHandle);
		expect(
			projectNativeOutcome(
				{ kind: 'cancelled', reason: 'stop', ...evidence } as never,
				undefined
			)
		).toMatchObject({ kind: 'cancelled', reason: 'stop' });
		expect(
			projectNativeOutcome(
				{ kind: 'cancelled', ...evidence } as never,
				undefined
			)
		).toMatchObject({ kind: 'cancelled' });
		expect(
			projectNativeOutcome(
				{ kind: 'admission-failed', error: 'admission' } as never,
				undefined
			)
		).toEqual({ kind: 'failed', error: 'admission' });
		expect(
			projectNativeOutcome(
				{
					kind: 'suspended',
					suspension: { live: true },
					...evidence,
				} as never,
				undefined
			)
		).toMatchObject({
			kind: 'failed',
			error: expect.objectContaining({
				message: expect.stringContaining('unsupported'),
			}),
		});
	});

	it('projects a hostile native observer failure synchronously', () => {
		const native = jest
			.spyOn(nativeRuntime, 'runPipeline')
			.mockReturnValueOnce(
				hostileThenable(new Error('native then')) as never
			);
		expect(
			runPipeline({
				pipeline: createSerialPipeline(options()),
				options: {},
			})
		).toMatchObject({ kind: 'failed' });
		native.mockRestore();
	});

	it('rejects non-object extensions and captures optional observers', () => {
		expect(() =>
			createSerialPipeline({ ...options(), extensions: [null as never] })
		).toThrow('invalid');
		expect(() =>
			createSerialPipeline({
				...options({
					onDiagnostic: () => undefined,
					onExtensionRollbackError: () => undefined,
					onHelperRollbackError: () => undefined,
					fragmentProvidedKeys: ['provided'],
					builderProvidedKeys: ['provided'],
					createMissingDependencyDiagnostic: () => ({
						type: 'missing',
					}),
					createUnusedHelperDiagnostic: () => ({ type: 'unused' }),
				}),
			})
		).not.toThrow();
		const raw = {
			key: 'raw',
			kind: 'fragment',
			mode: 'extend',
			priority: 0,
			apply: () => undefined,
		};
		const other = createHelper({
			key: 'other',
			kind: 'fragment',
			apply: () => undefined,
		});
		const override = createHelper({
			key: 'raw',
			kind: 'fragment',
			mode: 'override',
			apply: () => undefined,
		});
		expect(() =>
			createSerialPipeline({
				...options(),
				createRunResult: undefined,
				fragments: [raw as never, other, override],
			})
		).not.toThrow();
	});
});
