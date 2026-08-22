import { createHelper, createSerialPipeline, runPipeline } from '../../v1.js';

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((settle) => {
		resolve = settle;
	});
	return { promise, resolve };
}

function base(overrides: Record<string, unknown> = {}) {
	return {
		createBuildOptions: (options: { readonly id: string }) => options,
		createContext: () => ({ reporter: {} }),
		createFragmentState: ({
			options,
		}: {
			readonly options: { readonly id: string };
		}) => [options.id],
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
		fragments: [],
		builders: [],
		...overrides,
	};
}

describe('serial compatibility integration matrix', () => {
	it('isolates concurrent runs that settle out of order', async () => {
		const first = deferred();
		const second = deferred();
		const waits = new Map([
			['first', first],
			['second', second],
		]);
		const pipeline = createSerialPipeline({
			...base(),
			fragments: [
				createHelper({
					key: 'wait',
					kind: 'fragment',
					apply: async ({ output }) => {
						const artifact = output as string[];
						await waits.get(artifact[0]!)!.promise;
						artifact.push('settled');
					},
				}),
			],
		});
		const firstRun = runPipeline({ pipeline, options: { id: 'first' } });
		const secondRun = runPipeline({ pipeline, options: { id: 'second' } });

		second.resolve();
		const secondOutcome = await secondRun;
		first.resolve();
		const firstOutcome = await firstRun;
		expect(secondOutcome).toMatchObject({
			kind: 'succeeded',
			result: ['second', 'settled'],
		});
		expect(firstOutcome).toMatchObject({
			kind: 'succeeded',
			result: ['first', 'settled'],
		});
		if (
			firstOutcome.kind === 'succeeded' &&
			secondOutcome.kind === 'succeeded'
		) {
			const firstRequest = firstOutcome.native.effectJournal[0]?.request;
			const secondRequest =
				secondOutcome.native.effectJournal[0]?.request;
			expect(firstRequest).not.toEqual(secondRequest);
		}
	});

	it('stops later commits and compensates every admitted entry in reverse', () => {
		const committed: string[] = [];
		const compensated: string[] = [];
		const extension = (key: string, fails = false) => ({
			key,
			lifecycle: 'finalize' as const,
			hook: () => ({
				commit: () => {
					committed.push(key);
					if (fails) {
						throw new Error('commit');
					}
				},
				rollback: () => void compensated.push(key),
			}),
		});
		const pipeline = createSerialPipeline({
			...base(),
			extensions: [
				extension('one'),
				extension('two', true),
				extension('three'),
			],
		});

		expect(runPipeline({ pipeline, options: { id: 'run' } })).toMatchObject(
			{
				kind: 'failed',
			}
		);
		expect(committed).toEqual(['one', 'two']);
		expect(compensated).toEqual(['three', 'two', 'one']);
	});

	it('rejects pause shapes from extensions and terminal projection', () => {
		const extensionPause = createSerialPipeline({
			...base(),
			extensions: [
				{ key: 'pause', hook: () => ({ __paused: true }) as never },
			],
		});
		const terminalPause = createSerialPipeline({
			...base(),
			createRunResult: () => ({ __paused: true }) as never,
		});
		for (const pipeline of [extensionPause, terminalPause]) {
			expect(
				runPipeline({ pipeline, options: { id: 'run' } })
			).toMatchObject({
				kind: 'failed',
			});
		}
	});

	it('preserves v1 missing and cyclic dependency diagnostics', () => {
		const missing = createHelper({
			key: 'missing-owner',
			kind: 'fragment',
			origin: 'fixture',
			dependsOn: ['absent'],
			apply: () => undefined,
		});
		const missingDiagnostics: unknown[] = [];
		const missingPipeline = createSerialPipeline({
			...base(),
			fragments: [missing],
			onDiagnostic: ({ diagnostic }) =>
				void missingDiagnostics.push(diagnostic),
		});
		expect(
			runPipeline({ pipeline: missingPipeline, options: { id: 'run' } })
		).toMatchObject({ kind: 'failed' });
		expect(missingDiagnostics).toEqual([
			{
				type: 'missing-dependency',
				key: 'missing-owner',
				dependency: 'absent',
				message:
					'fragment helper "missing-owner" depends on unknown helper "absent".',
				kind: 'fragment',
				helper: 'fixture',
				dependsOn: ['absent'],
			},
			{
				type: 'unused-helper',
				key: 'missing-owner',
				message:
					'fragment helper "missing-owner" has missing dependencies.',
				kind: 'fragment',
				helper: 'fixture',
				dependsOn: ['absent'],
			},
		]);

		const cyclicDiagnostics: unknown[] = [];
		const cyclicPipeline = createSerialPipeline({
			...base(),
			fragments: [
				createHelper({
					key: 'one',
					kind: 'fragment',
					dependsOn: ['two'],
					apply: () => undefined,
				}),
				createHelper({
					key: 'two',
					kind: 'fragment',
					dependsOn: ['one'],
					apply: () => undefined,
				}),
			],
			createUnusedHelperDiagnostic: ({ helper, message }) => ({
				type: 'unused-helper',
				key: helper.key,
				message,
				kind: helper.kind,
				helper: helper.origin ?? helper.key,
				dependsOn: helper.dependsOn,
			}),
			onDiagnostic: ({ diagnostic }) => {
				cyclicDiagnostics.push(diagnostic);
				throw new Error('observer must be contained');
			},
		});
		expect(
			runPipeline({ pipeline: cyclicPipeline, options: { id: 'run' } })
		).toMatchObject({ kind: 'failed' });
		expect(cyclicDiagnostics).toHaveLength(2);
		expect(cyclicDiagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message:
						'fragment helper "one" has unresolved dependencies (possible cycle).',
					dependsOn: ['two'],
				}),
				expect.objectContaining({
					message:
						'fragment helper "two" has unresolved dependencies (possible cycle).',
					dependsOn: ['one'],
				}),
			])
		);
	});

	it('validates both helper orders before creating state or executing work', () => {
		const calls: string[] = [];
		const pipeline = createSerialPipeline({
			...base(),
			createContext: () => {
				calls.push('context');
				return { reporter: {} };
			},
			createBuildOptions: () => {
				calls.push('build-options');
				return {};
			},
			createFragmentState: () => {
				calls.push('fragment-state');
				return [] as string[];
			},
			createError: (_code, message) => {
				calls.push('error');
				return new Error(message);
			},
			onDiagnostic: () => void calls.push('diagnostic'),
			fragments: [
				createHelper({
					key: 'fragment',
					kind: 'fragment',
					apply: () => void calls.push('fragment'),
				}),
			],
			builders: [
				createHelper({
					key: 'builder',
					kind: 'builder',
					dependsOn: ['absent'],
					apply: () => void calls.push('builder'),
				}),
			],
			extensions: [
				{
					key: 'hook',
					hook: () => void calls.push('hook'),
				},
			],
		});
		expect(runPipeline({ pipeline, options: { id: 'run' } })).toMatchObject(
			{
				kind: 'failed',
			}
		);
		expect(calls).toEqual(['context', 'diagnostic', 'diagnostic', 'error']);
	});

	it('commits before result materialisation and compensates result failure', () => {
		const calls: string[] = [];
		const pipeline = createSerialPipeline({
			...base(),
			extensions: [
				{
					key: 'extension',
					lifecycle: 'finalize',
					hook: ({ artifact }) => ({
						commit: () => {
							calls.push('commit');
							(artifact as string[]).push('committed');
						},
						rollback: () => void calls.push('rollback'),
					}),
				},
			],
			createRunResult: ({ artifact }) => {
				calls.push(`result:${artifact.join(',')}`);
				throw new Error('result');
			},
		});
		expect(runPipeline({ pipeline, options: { id: 'run' } })).toMatchObject(
			{
				kind: 'failed',
			}
		);
		expect(calls).toEqual(['commit', 'result:run,committed', 'rollback']);
	});

	it('never materialises a result after commit failure', () => {
		const calls: string[] = [];
		const pipeline = createSerialPipeline({
			...base(),
			extensions: [
				{
					key: 'extension',
					lifecycle: 'finalize',
					hook: () => ({
						commit: () => {
							calls.push('commit');
							throw new Error('commit');
						},
						rollback: () => void calls.push('rollback'),
					}),
				},
			],
			createRunResult: () => {
				calls.push('result');
				return [];
			},
		});
		expect(runPipeline({ pipeline, options: { id: 'run' } })).toMatchObject(
			{
				kind: 'failed',
			}
		);
		expect(calls).toEqual(['commit', 'rollback']);
	});

	it('promotes only when an asynchronous commit precedes the result', async () => {
		const calls: string[] = [];
		const pipeline = createSerialPipeline({
			...base(),
			extensions: [
				{
					key: 'extension',
					lifecycle: 'finalize',
					hook: ({ artifact }) => ({
						commit: () =>
							Promise.resolve().then(() => {
								calls.push('commit');
								(artifact as string[]).push('committed');
							}),
					}),
				},
			],
			createRunResult: ({ artifact }) => {
				calls.push('result');
				return artifact;
			},
		});
		const outcome = runPipeline({ pipeline, options: { id: 'run' } });
		expect(outcome).toBeInstanceOf(Promise);
		expect(await outcome).toMatchObject({
			kind: 'succeeded',
			result: ['run', 'committed'],
		});
		expect(calls).toEqual(['commit', 'result']);
	});

	it('contains asynchronous result success, validation and rejection', async () => {
		const failure = new Error('async result');
		const successful = createSerialPipeline({
			...base(),
			createRunResult: ({ artifact }) => Promise.resolve(artifact),
		});
		const invalid = createSerialPipeline({
			...base(),
			createRunResult: () => Promise.resolve({ __paused: true }) as never,
		});
		const rejected = createSerialPipeline({
			...base(),
			createRunResult: () => Promise.reject(failure),
		});
		expect(
			await runPipeline({ pipeline: successful, options: { id: 'run' } })
		).toMatchObject({ kind: 'succeeded', result: ['run'] });
		expect(
			await runPipeline({ pipeline: invalid, options: { id: 'run' } })
		).toMatchObject({ kind: 'failed' });
		const rejectedOutcome = await runPipeline({
			pipeline: rejected,
			options: { id: 'run' },
		});
		expect(rejectedOutcome).toMatchObject({ kind: 'failed' });
		if (rejectedOutcome.kind === 'failed') {
			expect(rejectedOutcome.error).toBe(failure);
		}
	});

	it('delivers reused diagnostic objects once per invocation', () => {
		const reporter = {};
		const missingDiagnostic = {
			type: 'missing-dependency' as const,
			key: 'helper',
			dependency: 'absent',
			message: 'missing',
		};
		const unusedDiagnostic = {
			type: 'unused-helper' as const,
			key: 'helper',
			message: 'unused',
		};
		const observed: unknown[] = [];
		const pipeline = createSerialPipeline({
			...base(),
			createContext: () => ({ reporter }),
			fragments: [
				createHelper({
					key: 'helper',
					kind: 'fragment',
					dependsOn: ['absent'],
					apply: () => undefined,
				}),
			],
			createMissingDependencyDiagnostic: () => missingDiagnostic,
			createUnusedHelperDiagnostic: () => unusedDiagnostic,
			onDiagnostic: ({ diagnostic }) => void observed.push(diagnostic),
		});
		for (let invocation = 0; invocation < 2; invocation += 1) {
			expect(
				runPipeline({ pipeline, options: { id: `run-${invocation}` } })
			).toMatchObject({ kind: 'failed' });
		}
		expect(observed).toEqual([
			missingDiagnostic,
			unusedDiagnostic,
			missingDiagnostic,
			unusedDiagnostic,
		]);
	});
});
