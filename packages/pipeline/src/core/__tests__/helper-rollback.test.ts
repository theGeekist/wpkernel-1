import { createHelper } from '../helper.js';
import { makePipeline } from '../makePipeline.js';
import { createPipelineRollback } from '../rollback.js';
import type {
	AgnosticPipeline,
	PipelineDiagnostic,
	PipelineReporter,
	PipelineRunState,
} from '../types.js';

type TestRunOptions = Record<string, never>;
type TestDiagnostic = PipelineDiagnostic;
type TestReporter = Required<PipelineReporter> & {
	readonly info: jest.Mock;
	readonly child: jest.Mock<TestReporter, []>;
};
type TestContext = { readonly reporter: TestReporter };
type TestUserState = unknown;
type TestRunResult = PipelineRunState<TestUserState, TestDiagnostic>;

type TestPipeline = AgnosticPipeline<
	TestRunOptions,
	TestRunResult,
	TestContext,
	TestReporter
>;

function createTestReporter(): TestReporter {
	const reporter = {
		warn: jest.fn(),
		info: jest.fn(),
		child: jest.fn(),
	} as unknown as TestReporter;

	reporter.child.mockReturnValue(reporter);

	return reporter;
}

function createTestPipeline(): {
	pipeline: TestPipeline;
	reporter: TestReporter;
} {
	const reporter = createTestReporter();

	const pipeline = makePipeline<
		TestRunOptions,
		TestContext,
		TestReporter,
		TestUserState,
		TestDiagnostic,
		TestRunResult
	>({
		helperKinds: ['builder'],
		createError(code, message) {
			return new Error(`[${code}] ${message}`);
		},
		createContext() {
			return { reporter } satisfies TestContext;
		},
		createState: () => ({}),
	});

	return { pipeline, reporter };
}

function runPipeline(
	pipeline: TestPipeline,
	options: TestRunOptions = {}
): Promise<TestRunResult | void> {
	return Promise.resolve().then(() => pipeline.run(options));
}

describe('Helper Rollback', () => {
	it('executes helper rollback when builder fails', async () => {
		const rollback = jest.fn();
		const { pipeline } = createTestPipeline();

		pipeline.use(
			createHelper({
				key: 'builder.with-rollback',
				kind: 'builder',
				priority: 1,
				apply() {
					return {
						rollback: createPipelineRollback(rollback),
					};
				},
			})
		);

		pipeline.use(
			createHelper({
				key: 'builder.failure',
				kind: 'builder',
				priority: 0,
				apply() {
					throw new Error('builder failed');
				},
			})
		);

		await expect(runPipeline(pipeline)).rejects.toThrow('builder failed');

		expect(rollback).toHaveBeenCalled();
	});

	it('forwards helper rollback failures to the configured observer', async () => {
		const rollbackError = new Error('rollback failed');
		const onHelperRollbackError = jest.fn();
		const reporter = createTestReporter();
		const pipeline = makePipeline<
			TestRunOptions,
			TestContext,
			TestReporter,
			TestUserState,
			TestDiagnostic,
			TestRunResult
		>({
			helperKinds: ['builder'],
			createContext: () => ({ reporter }),
			createState: () => ({}),
			onHelperRollbackError,
		});

		pipeline.use(
			createHelper({
				key: 'builder.with-failing-rollback',
				kind: 'builder',
				priority: 1,
				apply: () => ({
					rollback: createPipelineRollback(() => {
						throw rollbackError;
					}),
				}),
			})
		);
		pipeline.use(
			createHelper({
				key: 'builder.failure',
				kind: 'builder',
				priority: 0,
				apply: () => {
					throw new Error('builder failed');
				},
			})
		);

		await expect(runPipeline(pipeline)).rejects.toThrow('builder failed');
		expect(onHelperRollbackError).toHaveBeenCalledWith(
			expect.objectContaining({
				error: rollbackError,
				helper: expect.objectContaining({
					key: 'builder.with-failing-rollback',
				}),
			})
		);
	});

	it('attributes a shared rollback descriptor to each helper occurrence', async () => {
		const rollbackError = new Error('shared rollback failed');
		const sharedRollback = createPipelineRollback(() => {
			throw rollbackError;
		});
		const observedHelpers: unknown[] = [];
		const reporter = createTestReporter();
		const pipeline = makePipeline({
			helperKinds: ['builder'],
			createContext: () => ({ reporter }),
			createState: () => ({}),
			onHelperRollbackError: ({ helper }) => observedHelpers.push(helper),
		});
		const first = createHelper({
			key: 'builder.first',
			kind: 'builder',
			priority: 2,
			apply: () => ({ rollback: sharedRollback }),
		});
		const second = createHelper({
			key: 'builder.second',
			kind: 'builder',
			priority: 1,
			apply: () => ({ rollback: sharedRollback }),
		});

		pipeline.use(first);
		pipeline.use(second);
		pipeline.use(
			createHelper({
				key: 'builder.failure',
				kind: 'builder',
				priority: 0,
				apply: () => {
					throw new Error('builder failed');
				},
			})
		);

		await expect(
			Promise.resolve().then(() => pipeline.run({}))
		).rejects.toThrow('builder failed');
		expect(observedHelpers).toEqual([second, first]);
	});

	it('protects admitted rollback occurrences from public state and callback mutation', async () => {
		const originalRun = jest.fn();
		const replacementRun = jest.fn();
		const rollback = {
			key: 'acquired',
			label: 'release acquired resource',
			run: originalRun,
		};
		const reporter = createTestReporter();
		const pipeline = makePipeline({
			helperKinds: ['acquire', 'failure'],
			createContext: () => ({ reporter }),
			createState: () => ({}),
			createStages: (deps: any) => [
				deps.makeHelperStage('acquire', {
					onVisited: (
						_state: unknown,
						_visited: ReadonlySet<string>,
						_registered: readonly unknown[],
						rollbacks: readonly unknown[]
					) => {
						(rollbacks as unknown[]).length = 0;
						return { rollbackJournal: [] };
					},
				}),
				(state: unknown) => {
					rollback.run = replacementRun;
					return state;
				},
				deps.makeHelperStage('failure'),
			],
		});

		pipeline.use(
			createHelper({
				key: 'acquire.resource',
				kind: 'acquire',
				apply: () => ({ rollback }),
			})
		);
		pipeline.use(
			createHelper({
				key: 'failure.trigger',
				kind: 'failure',
				apply: () => {
					throw new Error('failed after acquisition');
				},
			})
		);

		await expect(
			Promise.resolve().then(() => pipeline.run({}))
		).rejects.toThrow('failed after acquisition');
		expect(originalRun).toHaveBeenCalledTimes(1);
		expect(replacementRun).not.toHaveBeenCalled();
	});

	it('rolls back successful helpers when a later helper stage fails', async () => {
		const rollback = jest.fn();
		const reporter = createTestReporter();
		const pipeline = makePipeline({
			helperKinds: ['fragment', 'builder'],
			createContext: () => ({ reporter }),
			createState: () => ({}),
		});

		pipeline.use(
			createHelper({
				key: 'fragment.with-rollback',
				kind: 'fragment',
				apply() {
					return {
						rollback: createPipelineRollback(rollback),
					};
				},
			})
		);
		pipeline.use(
			createHelper({
				key: 'builder.failure',
				kind: 'builder',
				apply() {
					throw new Error('builder failed');
				},
			})
		);

		await expect(
			Promise.resolve().then(() => pipeline.run({}))
		).rejects.toThrow('builder failed');
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('rolls back helpers when a later non-helper stage rejects', async () => {
		const rollback = jest.fn();
		const reporter = createTestReporter();
		const pipeline = makePipeline({
			helperKinds: ['fragment'],
			createContext: () => ({ reporter }),
			createState: () => ({}),
			createStages: (deps: any) => [
				deps.makeHelperStage('fragment'),
				async () => {
					throw new Error('later stage failed');
				},
				deps.finalizeResult,
			],
		});

		pipeline.use(
			createHelper({
				key: 'fragment.with-rollback',
				kind: 'fragment',
				apply() {
					return {
						rollback: createPipelineRollback(rollback),
					};
				},
			})
		);

		await expect(
			Promise.resolve().then(() => pipeline.run({}))
		).rejects.toThrow('later stage failed');
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it.each([
		['synchronous', (state: Record<string, unknown>) => state],
		[
			'asynchronous',
			(state: Record<string, unknown>) => Promise.resolve(state),
		],
	])(
		'preserves runner-owned rollback state across a %s public-state replacement',
		async (_label, returnReplacement) => {
			const rollback = jest.fn();
			const reporter = createTestReporter();
			const pipeline = makePipeline({
				helperKinds: ['fragment'],
				createContext: () => ({ reporter }),
				createState: () => ({ revision: 0 }),
				createStages: (deps: any) => [
					deps.makeHelperStage('fragment'),
					(state: any) =>
						returnReplacement({
							context: state.context,
							reporter: state.reporter,
							runOptions: state.runOptions,
							userState: { revision: 1 },
							steps: state.steps,
							diagnostics: state.diagnostics,
							executedLifecycles: state.executedLifecycles,
							helperExecution: state.helperExecution,
							stageIndex: state.stageIndex,
							resumeInput: state.resumeInput,
						}),
					() => {
						throw new Error('later stage failed');
					},
				],
			});

			pipeline.use(
				createHelper({
					key: 'fragment.with-rollback',
					kind: 'fragment',
					apply() {
						return {
							rollback: createPipelineRollback(rollback),
						};
					},
				})
			);

			await expect(
				Promise.resolve().then(() => pipeline.run({}))
			).rejects.toThrow('later stage failed');
			expect(rollback).toHaveBeenCalledTimes(1);
		}
	);

	it('rolls back helpers exactly once when a custom stage returns an error halt', async () => {
		const rollback = jest.fn();
		const error = new Error('custom stage halted');
		const reporter = createTestReporter();
		const pipeline = makePipeline({
			helperKinds: ['fragment'],
			createContext: () => ({ reporter }),
			createState: () => ({}),
			createStages: (deps: any) => [
				deps.makeHelperStage('fragment'),
				() => deps.halt(error),
			],
		});

		pipeline.use(
			createHelper({
				key: 'fragment.with-rollback',
				kind: 'fragment',
				apply() {
					return {
						rollback: createPipelineRollback(rollback),
					};
				},
			})
		);

		await expect(
			Promise.resolve().then(() => pipeline.run({}))
		).rejects.toThrow('custom stage halted');
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it.each([
		[
			'throws undefined',
			() => {
				throw undefined;
			},
		],
		['rejects without a value', () => Promise.reject()],
	])(
		'rolls back and preserves rejection when a custom stage %s',
		async (_label, failStage) => {
			const rollback = jest.fn();
			const reporter = createTestReporter();
			const pipeline = makePipeline({
				helperKinds: ['fragment'],
				createContext: () => ({ reporter }),
				createState: () => ({}),
				createStages: (deps: any) => [
					deps.makeHelperStage('fragment'),
					failStage,
				],
			});

			pipeline.use(
				createHelper({
					key: 'fragment.with-rollback',
					kind: 'fragment',
					apply() {
						return {
							rollback: createPipelineRollback(rollback),
						};
					},
				})
			);

			await expect(
				Promise.resolve().then(() => pipeline.run({}))
			).rejects.toBeUndefined();
			expect(rollback).toHaveBeenCalledTimes(1);
		}
	);

	it('rolls back helpers when result materialization fails', async () => {
		const rollback = jest.fn();
		const reporter = createTestReporter();
		const pipeline = makePipeline({
			helperKinds: ['fragment'],
			createContext: () => ({ reporter }),
			createState: () => ({}),
			createRunResult() {
				throw new Error('result failed');
			},
		});

		pipeline.use(
			createHelper({
				key: 'fragment.with-rollback',
				kind: 'fragment',
				apply() {
					return {
						rollback: createPipelineRollback(rollback),
					};
				},
			})
		);

		await expect(
			Promise.resolve().then(() => pipeline.run({}))
		).rejects.toThrow('result failed');
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('rolls back helpers and extensions when an explicit commit stage fails', async () => {
		const order: string[] = [];
		const reporter = createTestReporter();
		const pipeline = makePipeline({
			helperKinds: ['builder'],
			createContext: () => ({ reporter }),
			createState: () => ({}),
			extensions: {
				lifecycles: ['prepare'],
			},
			createStages: (deps: any) => [
				deps.makeLifecycleStage('prepare'),
				deps.makeHelperStage('builder'),
				deps.commitStage,
				deps.finalizeResult,
			],
		});

		pipeline.extensions.use({
			key: 'commit.failure',
			register: () => ({
				lifecycle: 'prepare',
				hook: () => ({
					commit: () => {
						throw new Error('commit failed');
					},
					rollback: () => {
						order.push('extension');
					},
				}),
			}),
		});
		pipeline.use(
			createHelper({
				key: 'builder.with-rollback',
				kind: 'builder',
				apply() {
					return {
						rollback: createPipelineRollback(() => {
							order.push('helper');
						}),
					};
				},
			})
		);

		await expect(
			Promise.resolve().then(() => pipeline.run({}))
		).rejects.toThrow('commit failed');
		expect(order).toEqual(['helper', 'extension']);
	});

	it('rolls back helpers in reverse order', async () => {
		const rollbackOrder: string[] = [];
		const { pipeline } = createTestPipeline();

		pipeline.use(
			createHelper({
				key: 'builder.first',
				kind: 'builder',
				priority: 2,
				apply() {
					return {
						rollback: createPipelineRollback(() => {
							rollbackOrder.push('first');
						}),
					};
				},
			})
		);

		pipeline.use(
			createHelper({
				key: 'builder.second',
				kind: 'builder',
				priority: 1,
				apply() {
					return {
						rollback: createPipelineRollback(() => {
							rollbackOrder.push('second');
						}),
					};
				},
			})
		);

		pipeline.use(
			createHelper({
				key: 'builder.failure',
				kind: 'builder',
				priority: 0,
				apply() {
					throw new Error('builder failed');
				},
			})
		);

		await expect(runPipeline(pipeline)).rejects.toThrow('builder failed');

		expect(rollbackOrder).toEqual(['second', 'first']);
	});

	it('orders rollbacks by visitation when a helper wraps downstream execution', async () => {
		const rollbackOrder: string[] = [];
		const reporter = createTestReporter();
		const pipeline = makePipeline({
			helperKinds: ['builder'],
			createContext: () => ({ reporter }),
			createState: () => ({ value: 0 }),
			createStages: (deps: any) => [
				deps.makeHelperStage('builder', {
					makeArgs: (state: any) => () => ({
						context: state.context,
						input: undefined,
						output: state.userState,
						reporter: state.reporter,
					}),
					writeOutput: () => {
						throw new Error('write failed');
					},
				}),
				deps.finalizeResult,
			],
		});

		pipeline.use(
			createHelper({
				key: 'outer',
				kind: 'builder',
				priority: 2,
				apply: async ({ output }, next) => {
					const downstream = next ? await next(output) : output;
					return {
						output: downstream,
						rollback: createPipelineRollback(() => {
							rollbackOrder.push('outer');
						}),
					};
				},
			})
		);
		pipeline.use(
			createHelper({
				key: 'inner',
				kind: 'builder',
				priority: 1,
				apply: ({ output }) => ({
					output,
					rollback: createPipelineRollback(() => {
						rollbackOrder.push('inner');
					}),
				}),
			})
		);

		await expect(Promise.resolve(pipeline.run({}))).rejects.toThrow(
			'write failed'
		);
		expect(rollbackOrder).toEqual(['inner', 'outer']);
	});

	it('registers downstream cleanup before rolling back a wrapper failure', async () => {
		let releaseDownstream: (() => void) | undefined;
		const downstreamGate = new Promise<void>((resolve) => {
			releaseDownstream = resolve;
		});
		const events: string[] = [];
		const failure = new Error('wrapper failed');
		const rollback = jest.fn(() => {
			events.push('downstream-rollback');
		});
		const { pipeline } = createTestPipeline();

		pipeline.use(
			createHelper({
				key: 'wrapper',
				kind: 'builder',
				priority: 2,
				apply: (_args, next) => {
					void next?.();
					throw failure;
				},
			})
		);
		pipeline.use(
			createHelper({
				key: 'downstream',
				kind: 'builder',
				priority: 1,
				apply: async () => {
					await downstreamGate;
					events.push('downstream-settled');
					return {
						rollback: createPipelineRollback(rollback),
					};
				},
			})
		);

		const outcome = runPipeline(pipeline);
		const settled = jest.fn();
		const rejection = outcome.catch((error) => {
			settled();
			throw error;
		});

		await Promise.resolve();
		await Promise.resolve();
		expect(settled).not.toHaveBeenCalled();
		expect(rollback).not.toHaveBeenCalled();

		releaseDownstream?.();
		await expect(rejection).rejects.toBe(failure);
		expect(events).toEqual(['downstream-settled', 'downstream-rollback']);
	});

	it('rolls back helpers respecting dependency order', async () => {
		const rollbackOrder: string[] = [];
		const { pipeline } = createTestPipeline();

		pipeline.use(
			createHelper({
				key: 'builder.dependency',
				kind: 'builder',
				priority: 0,
				apply() {
					return {
						rollback: createPipelineRollback(() => {
							rollbackOrder.push('dependency');
						}),
					};
				},
			})
		);

		pipeline.use(
			createHelper({
				key: 'builder.dependant',
				kind: 'builder',
				priority: 5,
				dependsOn: ['builder.dependency'],
				apply() {
					return {
						rollback: createPipelineRollback(() => {
							rollbackOrder.push('dependant');
						}),
					};
				},
			})
		);

		pipeline.use(
			createHelper({
				key: 'builder.failure-dep',
				kind: 'builder',
				priority: 10,
				dependsOn: ['builder.dependant'],
				apply() {
					throw new Error('builder failed');
				},
			})
		);

		await expect(runPipeline(pipeline)).rejects.toThrow('builder failed');

		expect(rollbackOrder).toEqual(['dependant', 'dependency']);
	});

	it('continues rolling back after helper rollback fails', async () => {
		const rollbackCalls: string[] = [];
		const { pipeline } = createTestPipeline();

		pipeline.use(
			createHelper({
				key: 'builder.first',
				kind: 'builder',
				priority: 2,
				apply() {
					return {
						rollback: createPipelineRollback(() => {
							rollbackCalls.push('first');
						}),
					};
				},
			})
		);

		pipeline.use(
			createHelper({
				key: 'builder.second',
				kind: 'builder',
				priority: 1,
				apply() {
					return {
						rollback: createPipelineRollback(() => {
							rollbackCalls.push('second');
							throw new Error('rollback error');
						}),
					};
				},
			})
		);

		pipeline.use(
			createHelper({
				key: 'builder.failure',
				kind: 'builder',
				priority: 0,
				apply() {
					throw new Error('builder failed');
				},
			})
		);

		await expect(runPipeline(pipeline)).rejects.toThrow('builder failed');

		expect(rollbackCalls).toEqual(['second', 'first']);
	});

	it('supports async rollbacks', async () => {
		const rollback = jest.fn(async () => {
			await Promise.resolve();
		});
		const { pipeline } = createTestPipeline();

		pipeline.use(
			createHelper({
				key: 'builder.async-rollback',
				kind: 'builder',
				priority: 1,
				apply() {
					return {
						rollback: createPipelineRollback(rollback),
					};
				},
			})
		);

		pipeline.use(
			createHelper({
				key: 'builder.failure',
				kind: 'builder',
				priority: 0,
				apply() {
					throw new Error('builder failed');
				},
			})
		);

		await expect(runPipeline(pipeline)).rejects.toThrow('builder failed');

		expect(rollback).toHaveBeenCalled();
	});

	it('helper can return undefined rollback', async () => {
		const { pipeline } = createTestPipeline();

		pipeline.use(
			createHelper({
				key: 'builder.no-rollback',
				kind: 'builder',
				priority: 1,
				apply() {
					return {};
				},
			})
		);

		pipeline.use(
			createHelper({
				key: 'builder.failure',
				kind: 'builder',
				priority: 0,
				apply() {
					throw new Error('builder failed');
				},
			})
		);

		await expect(runPipeline(pipeline)).rejects.toThrow('builder failed');

		// Should not throw
		expect(true).toBe(true);
	});
});
