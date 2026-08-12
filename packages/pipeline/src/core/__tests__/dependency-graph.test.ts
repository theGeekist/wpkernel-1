import { createDependencyGraph, compareHelpers } from '../dependency-graph';
import type { Helper, PipelineReporter } from '../types';
import type { RegisteredHelper } from '../dependency-graph';

type TestHelper = Helper<any, any, any, PipelineReporter>;

const helperEntry = (
	key: string,
	index: number,
	dependsOn: string[] = [],
	priority = 0
): RegisteredHelper<TestHelper> => ({
	id: `fragment:${key}#${index}`,
	index,
	helper: {
		key,
		kind: 'fragment',
		dependsOn,
		priority,
		apply: () => undefined,
	} as unknown as TestHelper,
});

describe('dependency-graph', () => {
	describe('createDependencyGraph', () => {
		it('handles missing dependencies with callbacks and error throw', () => {
			const helper = {
				key: 'dependant',
				kind: 'fragment',
				dependsOn: ['missing', 'missing2'],
				priority: 0,
				apply: () => {},
			} as unknown as TestHelper;

			const entry = {
				helper,
				id: 'fragment:dependant#0',
				index: 0,
			} as RegisteredHelper<TestHelper>;

			const onMissingDependency = jest.fn();
			const createError = (_code: string, message: string) =>
				new Error(message);

			expect(() =>
				createDependencyGraph(
					[entry],
					{ onMissingDependency },
					createError
				)
			).toThrow(
				'Helpers depend on unknown helpers: "dependant" → ["missing", "missing2"].'
			);

			expect(onMissingDependency).toHaveBeenCalledTimes(2);
			expect(onMissingDependency).toHaveBeenCalledWith(
				expect.objectContaining({
					dependant: entry,
					dependencyKey: 'missing',
				})
			);
		});

		it('handles multiple helpers with missing dependencies', () => {
			const helper1 = {
				key: 'h1',
				kind: 'fragment',
				dependsOn: ['m1'],
				priority: 0,
				apply: () => {},
			} as unknown as TestHelper;
			const helper2 = {
				key: 'h2',
				kind: 'fragment',
				dependsOn: ['m2'],
				priority: 0,
				apply: () => {},
			} as unknown as TestHelper;

			const entry1 = {
				helper: helper1,
				id: 'fragment:h1#0',
				index: 0,
			} as RegisteredHelper<TestHelper>;
			const entry2 = {
				helper: helper2,
				id: 'fragment:h2#1',
				index: 1,
			} as RegisteredHelper<TestHelper>;

			const createError = (_code: string, message: string) =>
				new Error(message);

			expect(() =>
				createDependencyGraph([entry1, entry2], undefined, createError)
			).toThrow(
				'Helpers depend on unknown helpers: "h1" → ["m1"], "h2" → ["m2"].'
			);
		});

		it('handles unresolved helpers (circular) with callbacks and error throw', () => {
			const helperA = {
				key: 'A',
				kind: 'fragment',
				dependsOn: ['B'],
				priority: 10,
				apply: () => {},
			} as unknown as TestHelper;

			const helperB = {
				key: 'B',
				kind: 'fragment',
				dependsOn: ['A'],
				priority: 10,
				apply: () => {},
			} as unknown as TestHelper;

			const entryA = {
				helper: helperA,
				id: 'fragment:A#0',
				index: 0,
			} as RegisteredHelper<TestHelper>;
			const entryB = {
				helper: helperB,
				id: 'fragment:B#1',
				index: 1,
			} as RegisteredHelper<TestHelper>;

			const onUnresolvedHelpers = jest.fn();
			const createError = (_code: string, message: string) =>
				new Error(message);

			expect(() =>
				createDependencyGraph(
					[entryA, entryB],
					{ onUnresolvedHelpers },
					createError
				)
			).toThrow('Detected unresolved pipeline helpers: A, B.');

			expect(onUnresolvedHelpers).toHaveBeenCalledWith(
				expect.objectContaining({
					unresolved: expect.arrayContaining([entryA, entryB]),
				})
			);
		});

		it('deduplicates repeated dependency keys', () => {
			const dependency = {
				key: 'dependency',
				kind: 'fragment',
				dependsOn: [],
				priority: 0,
				apply: () => {},
			} as unknown as TestHelper;
			const dependant = {
				key: 'dependant',
				kind: 'fragment',
				dependsOn: ['dependency', 'dependency'],
				priority: 0,
				apply: () => {},
			} as unknown as TestHelper;
			const dependencyEntry = {
				helper: dependency,
				id: 'fragment:dependency#0',
				index: 0,
			} satisfies RegisteredHelper<TestHelper>;
			const dependantEntry = {
				helper: dependant,
				id: 'fragment:dependant#1',
				index: 1,
			} satisfies RegisteredHelper<TestHelper>;

			const graph = createDependencyGraph(
				[dependantEntry, dependencyEntry],
				undefined,
				(_code, message) => new Error(message)
			);

			expect(graph.order).toEqual([dependencyEntry, dependantEntry]);
		});

		it('waits for every helper registered under a dependency key', () => {
			const firstEntry = helperEntry('dependency', 0);
			const dependantEntry = helperEntry(
				'dependant',
				1,
				['dependency'],
				100
			);
			const secondEntry = helperEntry('dependency', 2);

			const graph = createDependencyGraph(
				[dependantEntry, secondEntry, firstEntry],
				undefined,
				(_code, message) => new Error(message)
			);

			expect(graph.order).toEqual([
				firstEntry,
				secondEntry,
				dependantEntry,
			]);
		});
	});

	describe('compareHelpers', () => {
		it('sorts by priority (higher first)', () => {
			const a = { helper: { priority: 10, key: 'a' }, index: 0 } as any;
			const b = { helper: { priority: 20, key: 'b' }, index: 1 } as any;
			expect(compareHelpers(a, b)).toBeGreaterThan(0); // b > a, so positive
			expect(compareHelpers(b, a)).toBeLessThan(0); // a < b, so negative
		});

		it('sorts by key (alphabetical) when priority is equal', () => {
			const a = { helper: { priority: 10, key: 'a' }, index: 0 } as any;
			const b = { helper: { priority: 10, key: 'b' }, index: 1 } as any;
			expect(compareHelpers(a, b)).toBeLessThan(0); // 'a' < 'b'
			expect(compareHelpers(b, a)).toBeGreaterThan(0);
		});

		it('sorts by index (lower first) when priority and key are equal', () => {
			const a = { helper: { priority: 10, key: 'a' }, index: 0 } as any;
			const b = { helper: { priority: 10, key: 'a' }, index: 1 } as any;
			expect(compareHelpers(a, b)).toBeLessThan(0); // 0 < 1
			expect(compareHelpers(b, a)).toBeGreaterThan(0);
		});
	});
});
