import {
	createHelper,
	createSerialPipeline,
	runPipeline,
	type PipelineStep,
	type SerialRunOutcome,
} from '../../v1.js';
import { observeParticipant } from '../../v2/scheduler/maybe-promise.js';

function baseOptions(overrides: Record<string, unknown> = {}) {
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
		fragments: [],
		builders: [],
		...overrides,
	};
}

describe('serial static and admission boundaries', () => {
	it('contains malformed run options and snapshots each field once', () => {
		for (const malformed of [null, undefined, 1, 'run']) {
			expect(runPipeline(malformed as never)).toMatchObject({
				kind: 'failed',
			});
		}
		const inspectionFailure = Object.defineProperty({}, 'pipeline', {
			get() {
				throw new Error('inspection');
			},
		});
		expect(runPipeline(inspectionFailure as never)).toMatchObject({
			kind: 'failed',
			error: expect.objectContaining({ message: 'inspection' }),
		});

		const pipeline = createSerialPipeline(baseOptions());
		const reads = { pipeline: 0, options: 0, signal: 0 };
		const supplied = {
			get pipeline() {
				reads.pipeline += 1;
				return pipeline;
			},
			get options() {
				reads.options += 1;
				return {};
			},
			get signal() {
				reads.signal += 1;
				return undefined;
			},
		};
		expect(runPipeline(supplied)).toMatchObject({ kind: 'succeeded' });
		expect(reads).toEqual({ pipeline: 1, options: 1, signal: 1 });
	});

	it('captures helper and extension callback getters exactly once', () => {
		const executed: string[] = [];
		const reads = { apply: 0, key: 0, hook: 0, lifecycle: 0 };
		const helper = {
			key: 'helper',
			kind: 'fragment',
			mode: 'extend',
			priority: 0,
			dependsOn: [],
			get apply() {
				reads.apply += 1;
				return reads.apply === 1
					? () => void executed.push('helper')
					: () => void executed.push('substituted-helper');
			},
		};
		const extension = {
			get key() {
				reads.key += 1;
				return 'extension';
			},
			get lifecycle() {
				reads.lifecycle += 1;
				return 'finalize' as const;
			},
			get hook() {
				reads.hook += 1;
				return reads.hook === 1
					? () => void executed.push('extension')
					: () => void executed.push('substituted-extension');
			},
		};
		const pipeline = createSerialPipeline({
			...baseOptions(),
			fragments: [helper as never],
			extensions: [extension],
		});

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
		});
		expect(reads).toEqual({ apply: 1, key: 1, hook: 1, lifecycle: 1 });
		expect(executed).toEqual(['helper', 'extension']);
	});

	it('captures optional programme callbacks exactly once', () => {
		let resultReads = 0;
		const configured = baseOptions();
		Object.defineProperty(configured, 'createRunResult', {
			get() {
				resultReads += 1;
				return resultReads === 1 ? () => 'owned' : () => 'substituted';
			},
		});
		const pipeline = createSerialPipeline(configured as never);
		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
			result: 'owned',
		});
		expect(resultReads).toBe(1);
	});

	it('uses domain validation errors for invalid extensions', () => {
		const createError = jest.fn((code: string, message: string) =>
			Object.assign(new Error(message), { code })
		);
		expect(() =>
			createSerialPipeline({
				...baseOptions(),
				createError,
				extensions: [
					{
						key: 'bad',
						lifecycle: 'typo',
						hook: () => undefined,
					} as never,
				],
			})
		).toThrow();
		expect(createError).toHaveBeenCalledWith(
			'ValidationError',
			expect.stringContaining('invalid lifecycle')
		);
	});

	it('reindexes retained helper metadata after override', () => {
		const first = createHelper({
			key: 'same',
			kind: 'fragment',
			apply: () => undefined,
		});
		const other = createHelper({
			key: 'other',
			kind: 'fragment',
			apply: () => undefined,
		});
		const override = createHelper({
			key: 'same',
			kind: 'fragment',
			mode: 'override',
			apply: () => undefined,
		});
		const extension = createHelper({
			key: 'same',
			kind: 'fragment',
			apply: () => undefined,
		});
		const pipeline = createSerialPipeline({
			...baseOptions(),
			fragments: [first, other, override, extension],
			createRunResult: ({
				steps,
			}: {
				readonly steps: readonly PipelineStep[];
			}) => steps,
		});
		const outcome = runPipeline({ pipeline, options: {} });
		const observed =
			observeParticipant<SerialRunOutcome<readonly PipelineStep[]>>(
				outcome
			);
		expect(observed.kind).toBe('synchronous');
		if (
			observed.kind === 'synchronous' &&
			observed.value.kind === 'succeeded'
		) {
			expect(
				observed.value.result.map((step) => step.index).sort()
			).toEqual([1, 2, 3]);
		}
	});

	it('reads extension result fields once and contains throwing getters', () => {
		const committed = jest.fn();
		let commitReads = 0;
		let artifactReads = 0;
		let rollbackReads = 0;
		const pipeline = createSerialPipeline({
			...baseOptions(),
			extensions: [
				{
					key: 'owned-result',
					hook: () => ({
						get artifact() {
							artifactReads += 1;
							return ['owned'];
						},
						get commit() {
							commitReads += 1;
							return commitReads === 1
								? committed
								: () => undefined;
						},
						get rollback() {
							rollbackReads += 1;
							return undefined;
						},
					}),
				},
			],
		});
		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
			result: ['owned'],
		});
		expect({ artifactReads, commitReads, rollbackReads }).toEqual({
			artifactReads: 1,
			commitReads: 1,
			rollbackReads: 1,
		});
		expect(committed).toHaveBeenCalledTimes(1);

		const hostile = createSerialPipeline({
			...baseOptions(),
			extensions: [
				{
					key: 'hostile-result',
					hook: () =>
						Object.defineProperty({}, 'rollback', {
							get() {
								throw new Error('rollback getter');
							},
						}),
				},
			],
		});
		expect(runPipeline({ pipeline: hostile, options: {} })).toMatchObject({
			kind: 'failed',
		});
	});

	it('reads helper output presence and value once', () => {
		let outputChecks = 0;
		let outputReads = 0;
		const pipeline = createSerialPipeline({
			...baseOptions(),
			adoptFragmentOutput: ({ output }) => output as string[],
			fragments: [
				createHelper({
					key: 'around',
					kind: 'fragment',
					apply: (_args, next) => {
						try {
							next?.();
						} catch {}
						return new Proxy(
							{},
							{
								has(_target, key) {
									if (key !== 'output') {
										return false;
									}
									outputChecks += 1;
									return outputChecks === 1;
								},
								get(_target, key) {
									if (key !== 'output') {
										return undefined;
									}
									outputReads += 1;
									return ['recovered'];
								},
							}
						) as never;
					},
				}),
				createHelper({
					key: 'failure',
					kind: 'fragment',
					dependsOn: ['around'],
					apply: () => {
						throw new Error('downstream');
					},
				}),
			],
		});
		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
			result: ['recovered'],
		});
		expect({ outputChecks, outputReads }).toEqual({
			outputChecks: 1,
			outputReads: 1,
		});
	});

	it('preserves the current artifact when an extension returns undefined', () => {
		const pipeline = createSerialPipeline({
			...baseOptions(),
			extensions: [
				{
					key: 'undefined-artifact',
					hook: () => ({ artifact: undefined }) as never,
				},
			],
		});
		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'succeeded',
			result: [],
		});
	});

	it('retains truthy invalid settlement values for phase-accurate failure', () => {
		const compensated = jest.fn();
		const invalidCommit = createSerialPipeline({
			...baseOptions(),
			extensions: [
				{
					key: 'invalid-commit',
					hook: () => ({ commit: 1, rollback: compensated }) as never,
				},
			],
		});
		expect(
			runPipeline({ pipeline: invalidCommit, options: {} })
		).toMatchObject({
			kind: 'failed',
		});
		expect(compensated).toHaveBeenCalledTimes(1);

		const extensionFailure = jest.fn();
		const helperFailure = jest.fn();
		const invalidRollback = createSerialPipeline({
			...baseOptions(),
			fragments: [
				createHelper({
					key: 'invalid-helper-rollback',
					kind: 'fragment',
					apply: () => ({ rollback: 1 }) as never,
				}),
			],
			extensions: [
				{
					key: 'invalid-extension-rollback',
					hook: () => ({ rollback: 1 }) as never,
				},
			],
			onExtensionRollbackError: extensionFailure,
			onHelperRollbackError: helperFailure,
			createRunResult: () => {
				throw new Error('result');
			},
		});
		expect(
			runPipeline({ pipeline: invalidRollback, options: {} })
		).toMatchObject({
			kind: 'failed',
		});
		expect(extensionFailure).toHaveBeenCalledWith(
			expect.objectContaining({ error: expect.any(TypeError) })
		);
		expect(helperFailure).toHaveBeenCalledWith(
			expect.objectContaining({ error: expect.any(TypeError) })
		);

		const callable = Object.assign(() => undefined, {
			artifact: ['callable'],
		});
		const callableResult = createSerialPipeline({
			...baseOptions(),
			extensions: [{ key: 'callable', hook: () => callable }],
		});
		expect(
			runPipeline({ pipeline: callableResult, options: {} })
		).toMatchObject({
			kind: 'succeeded',
			result: ['callable'],
		});
	});

	it('contains rollback observers independently so reporter warnings still run', () => {
		const warn = jest.fn();
		const extensionFailure = jest.fn();
		const helper = createHelper({
			key: 'helper',
			kind: 'fragment',
			apply: () => ({
				rollback: {
					run: () => {
						throw new Error('helper rollback');
					},
				},
			}),
		});
		const pipeline = createSerialPipeline({
			...baseOptions(),
			createContext: () => ({ reporter: { warn } }),
			fragments: [helper],
			extensions: [
				{
					key: 'before-extension',
					lifecycle: 'finalize',
					hook: () => undefined,
				},
				{
					key: 'extension',
					lifecycle: 'finalize',
					hook: () => ({
						rollback: () => {
							throw new Error('extension rollback');
						},
					}),
				},
				{
					key: 'after-extension',
					lifecycle: 'finalize',
					hook: () => undefined,
				},
			],
			onHelperRollbackError: () => {
				throw new Error('observer');
			},
			onExtensionRollbackError: (failure) => {
				extensionFailure(failure);
				throw new Error('observer');
			},
			createRunResult: () => {
				throw new Error('run');
			},
		});

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'failed',
		});
		expect(warn.mock.calls.map(([message]) => message)).toEqual([
			'Pipeline extension rollback failed.',
			'Helper rollback failed',
		]);
		expect(warn.mock.calls[0]?.[1]).toMatchObject({
			extensions: ['before-extension', 'extension', 'after-extension'],
			errorMessage: 'extension rollback',
		});
		expect(extensionFailure).toHaveBeenCalledWith(
			expect.objectContaining({
				extensionKeys: [
					'before-extension',
					'extension',
					'after-extension',
				],
			})
		);
		expect(warn.mock.calls[1]?.[1]).toMatchObject({ helper });
	});
});
