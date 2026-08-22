import {
	createHelper,
	createSerialPipeline,
	runPipeline,
	type HelperNext,
	type SerialRunOutcome,
} from '../../v1.js';

function createDeferred() {
	let resolve!: () => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<void>((onResolve, onReject) => {
		resolve = onResolve;
		reject = onReject;
	});
	return { promise, resolve, reject };
}

function createTestPipelineOptions(
	fragments: readonly unknown[],
	extensions: readonly unknown[] = []
) {
	return {
		createBuildOptions: () => ({}),
		createContext: () => ({ reporter: {} }),
		createFragmentState: () => [] as string[],
		createFragmentArgs: ({
			context,
			draft,
		}: {
			readonly context: { readonly reporter: object };
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
			readonly context: { readonly reporter: object };
			readonly artifact: string[];
		}) => ({
			context,
			input: undefined,
			output: artifact,
			reporter: context.reporter,
		}),
		createRunResult: ({ artifact }: { readonly artifact: string[] }) =>
			artifact,
		fragments: fragments as never,
		builders: [],
		extensions: extensions as never,
	};
}

function createTestPipeline(
	fragments: readonly unknown[],
	extensions: readonly unknown[] = []
) {
	return createSerialPipeline(
		createTestPipelineOptions(fragments, extensions)
	);
}

describe('serial v1 authority containment', () => {
	it('revokes a captured next after helper settlement', () => {
		let escaped: HelperNext<unknown> | undefined;
		let downstreamCalls = 0;
		const pipeline = createTestPipeline([
			createHelper({
				key: 'outer',
				kind: 'fragment',
				apply: (_args, next) => {
					escaped = next;
				},
			}),
			createHelper({
				key: 'downstream',
				kind: 'fragment',
				dependsOn: ['outer'],
				apply: () => {
					downstreamCalls += 1;
				},
			}),
		]);

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
		});
		expect(downstreamCalls).toBe(1);
		expect(() => escaped?.()).toThrow('next is no longer active');
		expect(downstreamCalls).toBe(1);
	});

	it('keeps automatic continuation private while downstream is pending', async () => {
		const outer = createDeferred();
		const downstream = createDeferred();
		const downstreamStarted = createDeferred();
		let escaped: HelperNext<unknown> | undefined;
		let downstreamCalls = 0;
		const pipeline = createTestPipeline([
			createHelper({
				key: 'outer',
				kind: 'fragment',
				apply: async (_args, next) => {
					escaped = next;
					await outer.promise;
				},
			}),
			createHelper({
				key: 'downstream',
				kind: 'fragment',
				dependsOn: ['outer'],
				apply: () => {
					downstreamCalls += 1;
					downstreamStarted.resolve();
					return downstream.promise;
				},
			}),
		]);
		const run = runPipeline({ pipeline, options: {} });

		outer.resolve();
		await downstreamStarted.promise;
		expect(downstreamCalls).toBe(1);
		expect(() => escaped?.()).toThrow('next is no longer active');
		expect(downstreamCalls).toBe(1);

		downstream.resolve();
		await expect(run).resolves.toMatchObject({ kind: 'succeeded' });
	});

	it('contains early downstream rejection while the outer helper remains pending', async () => {
		const outer = createDeferred();
		const unhandled = jest.fn();
		process.on('unhandledRejection', unhandled);
		try {
			const pipeline = createTestPipeline([
				createHelper({
					key: 'outer',
					kind: 'fragment',
					apply: async (_args, next) => {
						void next?.();
						await outer.promise;
						throw new Error('outer');
					},
				}),
				createHelper({
					key: 'downstream',
					kind: 'fragment',
					dependsOn: ['outer'],
					apply: () => Promise.reject(new Error('downstream')),
				}),
			]);
			const run = runPipeline({ pipeline, options: {} });
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
			expect(unhandled).not.toHaveBeenCalled();

			outer.resolve();
			await expect(run).resolves.toMatchObject({
				kind: 'failed',
				error: expect.objectContaining({ message: 'outer' }),
			});
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
			expect(unhandled).not.toHaveBeenCalled();
		} finally {
			process.off('unhandledRejection', unhandled);
		}
	});

	it('owns helper identity, dependencies and callback at construction', () => {
		const dependency = ['first'];
		const mutable = {
			key: 'second',
			kind: 'fragment',
			mode: 'extend' as const,
			priority: 0,
			dependsOn: dependency,
			apply: ({ output }: { readonly output: unknown }) => {
				(output as string[]).push('original');
			},
		};
		const pipeline = createTestPipeline([
			createHelper({
				key: 'first',
				kind: 'fragment',
				apply: ({ output }) => {
					(output as string[]).push('first');
				},
			}),
			mutable,
		]);

		mutable.key = 'mutated';
		mutable.kind = 'builder';
		dependency.splice(0, dependency.length, 'missing');
		mutable.apply = ({ output }) => {
			(output as string[]).push('mutated');
		};

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
			result: ['first', 'original'],
		});
	});

	it('rejects extension lifecycle typos during static capture', () => {
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
				fragments: [],
				builders: [],
				extensions: [
					{
						key: 'typo',
						lifecycle: 'after-fragment' as never,
						hook: () => undefined,
					},
				],
			})
		).toThrow('invalid lifecycle');
	});

	it('preserves original helper and commit failure identity', () => {
		for (const original of [
			{ error: 'inner', marker: 'helper' },
			{ primaryFailure: 'inner', marker: 'helper-primary' },
		]) {
			const pipeline = createTestPipeline([
				createHelper({
					key: 'failure',
					kind: 'fragment',
					apply: () => {
						throw original;
					},
				}),
			]);
			const outcome = runPipeline({
				pipeline,
				options: {},
			}) as SerialRunOutcome<string[]>;
			expect(outcome).toMatchObject({ kind: 'failed' });
			if (outcome.kind === 'failed') {
				expect(outcome.error).toBe(original);
			}
		}

		const commitFailure = { error: 'inner', marker: 'commit' };
		const pipeline = createTestPipeline(
			[],
			[
				{
					key: 'commit',
					lifecycle: 'finalize',
					hook: () => ({
						commit: () => {
							throw commitFailure;
						},
					}),
				},
			]
		);
		const outcome = runPipeline({
			pipeline,
			options: {},
		}) as SerialRunOutcome<string[]>;
		expect(outcome).toMatchObject({ kind: 'failed' });
		if (outcome.kind === 'failed') {
			expect(outcome.error).toBe(commitFailure);
		}
	});

	it('retains original helper identity for rollback attribution', () => {
		const original = createHelper({
			key: 'rollback-owner',
			kind: 'fragment',
			apply: () => ({
				rollback: {
					run: () => {
						throw new Error('rollback');
					},
				},
			}),
		});
		const observer = jest.fn();
		const pipeline = createSerialPipeline({
			...createTestPipelineOptions([original]),
			onHelperRollbackError: observer,
			createRunResult: () => {
				throw new Error('run');
			},
		});

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'failed',
		});
		expect(observer).toHaveBeenCalledWith(
			expect.objectContaining({ helper: original })
		);
	});

	it('passes original helpers to author callbacks without internal keys', () => {
		const original = createHelper({
			key: 'original',
			kind: 'fragment',
			apply: () => undefined,
		});
		const missing = createHelper({
			key: 'missing-owner',
			kind: 'fragment',
			dependsOn: ['absent'],
			apply: () => undefined,
		});
		const seen: unknown[] = [];
		const pipeline = createSerialPipeline({
			...createTestPipelineOptions([original]),
			createFragmentArgs: ({ helper, context, draft }) => {
				seen.push(helper);
				return {
					context,
					input: undefined,
					output: draft,
					reporter: context.reporter,
				};
			},
		});
		const diagnosticPipeline = createSerialPipeline({
			...createTestPipelineOptions([missing]),
			createMissingDependencyDiagnostic: ({
				helper,
				dependency,
				message,
			}) => {
				seen.push(helper);
				return {
					type: 'missing-dependency',
					key: helper.key,
					dependency,
					message,
				};
			},
			createUnusedHelperDiagnostic: ({ helper, message }) => {
				seen.push(helper);
				return {
					type: 'unused-helper',
					key: helper.key,
					message,
				};
			},
		});

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
		});
		expect(
			runPipeline({ pipeline: diagnosticPipeline, options: {} })
		).toMatchObject({
			kind: 'failed',
		});
		expect(seen).toEqual([original, missing, missing]);
		for (const helper of seen) {
			expect(helper).not.toHaveProperty('attribution');
		}
	});

	it('compensates around helpers in reverse execution order', async () => {
		for (const asynchronous of [false, true]) {
			const compensated: string[] = [];
			const outerRollback = () => void compensated.push('outer');
			const innerRollback = () => void compensated.push('inner');
			const outer = createHelper({
				key: 'outer',
				kind: 'fragment',
				apply: (_args, next) => {
					const downstream = next?.();
					return asynchronous
						? Promise.resolve(downstream).then(() => ({
								rollback: { run: outerRollback },
							}))
						: { rollback: { run: outerRollback } };
				},
			});
			const inner = createHelper({
				key: 'inner',
				kind: 'fragment',
				dependsOn: ['outer'],
				apply: () =>
					asynchronous
						? Promise.resolve({ rollback: { run: innerRollback } })
						: { rollback: { run: innerRollback } },
			});
			const pipeline = createSerialPipeline({
				...createTestPipelineOptions([outer, inner]),
				createRunResult: () => {
					throw new Error('later failure');
				},
			});

			expect(await runPipeline({ pipeline, options: {} })).toMatchObject({
				kind: 'failed',
			});
			expect(compensated).toEqual(['inner', 'outer']);
		}
	});

	it('compensates admitted work once when cancelled during preparation', async () => {
		const pending = createDeferred();
		const rollback = jest.fn();
		const commit = jest.fn();
		const controller = new AbortController();
		const pipeline = createSerialPipeline({
			...createTestPipelineOptions([
				createHelper({
					key: 'admitted',
					kind: 'fragment',
					apply: () => ({ rollback: { run: rollback } }),
				}),
				createHelper({
					key: 'pending',
					kind: 'fragment',
					dependsOn: ['admitted'],
					apply: () => pending.promise,
				}),
			]),
			extensions: [
				{
					key: 'commit',
					lifecycle: 'finalize',
					hook: () => ({ commit }),
				},
			],
		});
		const run = runPipeline({
			pipeline,
			options: {},
			signal: controller.signal,
		});
		controller.abort('stop');
		pending.resolve();

		await expect(run).resolves.toMatchObject({
			kind: 'cancelled',
			reason: 'stop',
		});
		expect(commit).not.toHaveBeenCalled();
		expect(rollback).toHaveBeenCalledTimes(1);
	});
});
