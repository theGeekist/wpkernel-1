import { executeHelpers } from '../executor';
import type {
	Helper,
	HelperKind,
	PipelineReporter,
	HelperApplyResult,
	HelperApplyOptions,
	HelperNext,
	MaybePromise,
} from '../types';
import type { RegisteredHelper } from '../dependency-graph';

type TestContext = Record<string, never>;
type TestInput = void;
type TestOutput = void;
type TestReporter = PipelineReporter;
type TestHelper = Helper<
	TestContext,
	TestInput,
	TestOutput,
	TestReporter,
	HelperKind
>;

type TestApplyOptions = HelperApplyOptions<
	TestContext,
	TestInput,
	TestOutput,
	TestReporter
>;

const runHelper = (
	helper: TestHelper,
	args: TestApplyOptions,
	next?: HelperNext<TestOutput>
): MaybePromise<HelperApplyResult<TestOutput> | void> =>
	helper.apply(args, next);

describe('executor', () => {
	it('runs async helpers sequentially', async () => {
		const order: string[] = [];
		const helpers: RegisteredHelper<TestHelper>[] = [
			{
				id: '1',
				index: 0,
				helper: {
					key: 'h1',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: async () => {
						await Promise.resolve();
						order.push('h1');
					},
				},
			},
			{
				id: '2',
				index: 1,
				helper: {
					key: 'h2',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: async () => {
						await Promise.resolve();
						order.push('h2');
					},
				},
			},
		];

		await executeHelpers<
			TestContext,
			TestInput,
			TestOutput,
			TestReporter,
			HelperKind,
			TestHelper,
			HelperApplyOptions<TestContext, TestInput, TestOutput, TestReporter>
		>(
			helpers,
			() => ({
				context: {},
				input: undefined,
				output: undefined,
				reporter: {} as TestReporter,
			}),
			(helper, args, next) => runHelper(helper, args, next),
			() => {}
		);

		expect(order).toEqual(['h1', 'h2']);
	});

	it('supports explicit next() calls in async helpers', async () => {
		const order: string[] = [];
		const helpers: RegisteredHelper<TestHelper>[] = [
			{
				id: '1',
				index: 0,
				helper: {
					key: 'h1',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: async (_args, next) => {
						order.push('h1-start');
						if (next) {
							await next();
						}
						order.push('h1-end');
					},
				},
			},
			{
				id: '2',
				index: 1,
				helper: {
					key: 'h2',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: async () => {
						order.push('h2');
					},
				},
			},
		];

		await executeHelpers<
			TestContext,
			TestInput,
			TestOutput,
			TestReporter,
			HelperKind,
			TestHelper,
			HelperApplyOptions<TestContext, TestInput, TestOutput, TestReporter>
		>(
			helpers,
			() => ({
				context: {},
				input: undefined,
				output: undefined,
				reporter: {} as TestReporter,
			}),
			(helper, args, next) => runHelper(helper, args, next),
			() => {}
		);

		expect(order).toEqual(['h1-start', 'h2', 'h1-end']);
	});

	it('supports explicit next() calls in sync helpers', async () => {
		const order: string[] = [];
		const helpers: RegisteredHelper<TestHelper>[] = [
			{
				id: '1',
				index: 0,
				helper: {
					key: 'h1',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: (_args, next) => {
						order.push('h1-start');
						if (next) {
							void next();
						}
						order.push('h1-end');
					},
				},
			},
			{
				id: '2',
				index: 1,
				helper: {
					key: 'h2',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: () => {
						order.push('h2');
					},
				},
			},
		];

		await executeHelpers<
			TestContext,
			TestInput,
			TestOutput,
			TestReporter,
			HelperKind,
			TestHelper,
			HelperApplyOptions<TestContext, TestInput, TestOutput, TestReporter>
		>(
			helpers,
			() => ({
				context: {},
				input: undefined,
				output: undefined,
				reporter: {} as TestReporter,
			}),
			(helper, args, next) => runHelper(helper, args, next),
			() => {}
		);

		expect(order).toEqual(['h1-start', 'h2', 'h1-end']);
	});

	it('threads returned output through automatic continuation', () => {
		type Output = string[];
		type OutputHelper = Helper<
			TestContext,
			TestInput,
			Output,
			TestReporter
		>;
		const seen: Output[] = [];
		const helpers: RegisteredHelper<OutputHelper>[] = [
			{
				id: '1',
				index: 0,
				helper: {
					key: 'first',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: ({ output }) => ({
						output: [...output, 'first'],
					}),
				},
			},
			{
				id: '2',
				index: 1,
				helper: {
					key: 'second',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: ({ output }) => {
						seen.push(output);
						return { output: [...output, 'second'] };
					},
				},
			},
		];

		const result = executeHelpers<
			TestContext,
			TestInput,
			Output,
			TestReporter,
			HelperKind,
			OutputHelper,
			HelperApplyOptions<TestContext, TestInput, Output, TestReporter>
		>(
			helpers,
			() => ({
				context: {},
				input: undefined,
				output: [] as Output,
				reporter: {},
			}),
			(helper, args, next) => helper.apply(args, next),
			() => undefined
		);

		expect(result).toEqual({
			visited: new Set(['1', '2']),
			hasOutput: true,
			output: ['first', 'second'],
		});
		expect(seen).toEqual([['first']]);
	});

	it('supports explicit downstream input and post-next replacement', async () => {
		type Output = string[];
		type OutputHelper = Helper<
			TestContext,
			TestInput,
			Output,
			TestReporter
		>;
		const helpers: RegisteredHelper<OutputHelper>[] = [
			{
				id: '1',
				index: 0,
				helper: {
					key: 'wrapper',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: async ({ output }, next) => {
						const downstream = await next?.([...output, 'before']);
						return {
							output: [...(downstream ?? output), 'after'],
						};
					},
				},
			},
			{
				id: '2',
				index: 1,
				helper: {
					key: 'inner',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: ({ output }) => ({
						output: [...output, 'inner'],
					}),
				},
			},
		];

		const result = await executeHelpers<
			TestContext,
			TestInput,
			Output,
			TestReporter,
			HelperKind,
			OutputHelper,
			HelperApplyOptions<TestContext, TestInput, Output, TestReporter>
		>(
			helpers,
			() => ({
				context: {},
				input: undefined,
				output: [] as Output,
				reporter: {},
			}),
			(helper, args, next) => helper.apply(args, next),
			() => undefined
		);

		expect(result.output).toEqual(['before', 'inner', 'after']);
	});

	it('executes downstream helpers once when next is called repeatedly', () => {
		type Output = number;
		type OutputHelper = Helper<
			TestContext,
			TestInput,
			Output,
			TestReporter
		>;
		const downstream = jest.fn(({ output }: { output: number }) => ({
			output: output + 1,
		}));
		const helpers: RegisteredHelper<OutputHelper>[] = [
			{
				id: '1',
				index: 0,
				helper: {
					key: 'wrapper',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: (_args, next) => {
						const first = next?.(2);
						const second = next?.(99);
						expect(second).toBe(first);
					},
				},
			},
			{
				id: '2',
				index: 1,
				helper: {
					key: 'inner',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: downstream,
				},
			},
		];

		const result = executeHelpers<
			TestContext,
			TestInput,
			Output,
			TestReporter,
			HelperKind,
			OutputHelper,
			HelperApplyOptions<TestContext, TestInput, Output, TestReporter>
		>(
			helpers,
			() => ({
				context: {},
				input: undefined,
				output: 0,
				reporter: {},
			}),
			(helper, args, next) => helper.apply(args, next),
			() => undefined
		);

		expect(result).toMatchObject({ output: 3 });
		expect(downstream).toHaveBeenCalledTimes(1);
	});

	it('allows an around helper to recover with an explicit output', async () => {
		type Output = string;
		type OutputHelper = Helper<
			TestContext,
			TestInput,
			Output,
			TestReporter
		>;
		const helpers: RegisteredHelper<OutputHelper>[] = [
			{
				id: '1',
				index: 0,
				helper: {
					key: 'boundary',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: async ({ output }, next) => {
						try {
							return { output: await next?.(output) };
						} catch {
							return { output: 'recovered' };
						}
					},
				},
			},
			{
				id: '2',
				index: 1,
				helper: {
					key: 'failure',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: () => {
						throw new Error('downstream failure');
					},
				},
			},
		];

		const result = await executeHelpers<
			TestContext,
			TestInput,
			Output,
			TestReporter,
			HelperKind,
			OutputHelper,
			HelperApplyOptions<TestContext, TestInput, Output, TestReporter>
		>(
			helpers,
			() => ({
				context: {},
				input: undefined,
				output: 'initial',
				reporter: {},
			}),
			(helper, args, next) => helper.apply(args, next),
			() => undefined
		);

		expect(result.output).toBe('recovered');
	});

	it('treats an explicitly returned undefined as authoritative', () => {
		type Output = string | undefined;
		type OutputHelper = Helper<
			TestContext,
			TestInput,
			Output,
			TestReporter
		>;
		const seen = jest.fn();
		const helpers: RegisteredHelper<OutputHelper>[] = [
			{
				id: '1',
				index: 0,
				helper: {
					key: 'clear',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: () => ({ output: undefined }),
				},
			},
			{
				id: '2',
				index: 1,
				helper: {
					key: 'observe',
					kind: 'fragment',
					mode: 'extend',
					priority: 0,
					dependsOn: [],
					apply: ({ output }) => {
						seen(output);
					},
				},
			},
		];

		const result = executeHelpers<
			TestContext,
			TestInput,
			Output,
			TestReporter,
			HelperKind,
			OutputHelper,
			HelperApplyOptions<TestContext, TestInput, Output, TestReporter>
		>(
			helpers,
			() => ({
				context: {},
				input: undefined,
				output: 'initial',
				reporter: {},
			}),
			(helper, args, next) => helper.apply(args, next),
			() => undefined
		);

		expect(result).toMatchObject({ hasOutput: true, output: undefined });
		expect(seen).toHaveBeenCalledWith(undefined);
	});
});
