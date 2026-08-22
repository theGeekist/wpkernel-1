import { createHelper, createSerialPipeline, runPipeline } from '../../v1.js';

type HelperLane = 'fragment' | 'builder';
interface RollbackDescriptor {
	readonly key?: string;
	readonly label?: string;
	readonly run: () => void;
}

const createOptions = (
	lane: HelperLane,
	helpers: readonly unknown[],
	overrides: Record<string, unknown> = {}
) => ({
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
	finalizeFragmentState: ({ draft }: never) => draft,
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
	fragments: (lane === 'fragment' ? helpers : []) as never,
	builders: (lane === 'builder' ? helpers : []) as never,
	...overrides,
});

const createDescriptor = (
	trace: string[],
	readRun: () => () => void
): RollbackDescriptor =>
	Object.defineProperties(
		{},
		{
			key: {
				enumerable: true,
				get: () => {
					trace.push('key');
					return 'cleanup';
				},
			},
			label: {
				enumerable: true,
				get: () => {
					trace.push('label');
					return 'Cleanup';
				},
			},
			run: {
				enumerable: true,
				get: () => {
					trace.push('run');
					return readRun();
				},
			},
		}
	) as RollbackDescriptor;

describe('serial helper rollback phase snapshots', () => {
	for (const lane of ['fragment', 'builder'] as const) {
		it(`snapshots ${lane} rollback fields at successful phase admission`, () => {
			const trace: string[] = [];
			const original = jest.fn(
				() => void trace.push('original rollback')
			);
			const replacement = jest.fn(
				() => void trace.push('replacement rollback')
			);
			let currentRun = original;
			const descriptor = createDescriptor(trace, () => currentRun);
			const helpers = [
				createHelper({
					key: 'owner',
					kind: lane,
					apply: () => {
						trace.push('owner');
						return { rollback: descriptor };
					},
				}),
				createHelper({
					key: 'mutator',
					kind: lane,
					dependsOn: ['owner'],
					apply: () => {
						trace.push('mutator');
						currentRun = replacement;
					},
				}),
			];
			const pipeline = createSerialPipeline(
				createOptions(lane, helpers, {
					createRunResult: () => {
						trace.push('later failure');
						throw new Error('later failure');
					},
				}) as never
			);

			expect(runPipeline({ pipeline, options: {} })).toMatchObject({
				kind: 'failed',
			});
			expect(trace).toEqual([
				'owner',
				'mutator',
				'key',
				'label',
				'run',
				'later failure',
				'replacement rollback',
			]);
			expect(original).not.toHaveBeenCalled();
			expect(replacement).toHaveBeenCalledTimes(1);
		});

		it(`snapshots admitted ${lane} rollback fields before phase-failure compensation`, () => {
			const trace: string[] = [];
			const original = jest.fn(
				() => void trace.push('original rollback')
			);
			const replacement = jest.fn(
				() => void trace.push('replacement rollback')
			);
			let currentRun = original;
			const descriptor = createDescriptor(trace, () => currentRun);
			const helpers = [
				createHelper({
					key: 'owner',
					kind: lane,
					apply: () => {
						trace.push('owner');
						return { rollback: descriptor };
					},
				}),
				createHelper({
					key: 'failure',
					kind: lane,
					dependsOn: ['owner'],
					apply: () => {
						trace.push('failure');
						currentRun = replacement;
						throw new Error('phase failure');
					},
				}),
			];
			const pipeline = createSerialPipeline(
				createOptions(lane, helpers) as never
			);

			expect(runPipeline({ pipeline, options: {} })).toMatchObject({
				kind: 'failed',
			});
			expect(trace).toEqual([
				'owner',
				'failure',
				'key',
				'label',
				'run',
				'replacement rollback',
			]);
			expect(original).not.toHaveBeenCalled();
			expect(replacement).toHaveBeenCalledTimes(1);
		});
	}

	it('adopts output before snapshotting rollback aliases on adopter failure', () => {
		const adoptionFailure = new Error('adoption failed');
		const first = jest.fn();
		const second = jest.fn();
		let currentRun = first;
		const descriptor = {
			get run() {
				return currentRun;
			},
		};
		const pipeline = createSerialPipeline(
			createOptions(
				'fragment',
				[
					createHelper({
						key: 'owner',
						kind: 'fragment',
						apply: () => ({ output: [], rollback: descriptor }),
					}),
				],
				{
					adoptFragmentOutput: () => {
						currentRun = second;
						throw adoptionFailure;
					},
				}
			) as never
		);

		const outcome = runPipeline({ pipeline, options: {} });
		expect(outcome).toMatchObject({
			kind: 'failed',
			error: adoptionFailure,
		});
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('retries one failed atomic phase snapshot without duplicate admission', () => {
		const firstFailure = new Error('first snapshot');
		const trace: string[] = [];
		const firstRollback = jest.fn(() => void trace.push('first rollback'));
		const secondRollback = jest.fn(
			() => void trace.push('second rollback')
		);
		let secondKeyReads = 0;
		const firstDescriptor = createDescriptor(trace, () => firstRollback);
		const secondDescriptor = Object.defineProperties(
			{},
			{
				key: {
					get: () => {
						trace.push('second key');
						secondKeyReads += 1;
						if (secondKeyReads === 1) {
							throw firstFailure;
						}
						return 'second';
					},
				},
				label: { get: () => (trace.push('second label'), 'Second') },
				run: { get: () => (trace.push('second run'), secondRollback) },
			}
		) as RollbackDescriptor;
		const pipeline = createSerialPipeline(
			createOptions('fragment', [
				createHelper({
					key: 'first',
					kind: 'fragment',
					apply: () => ({ rollback: firstDescriptor }),
				}),
				createHelper({
					key: 'second',
					kind: 'fragment',
					dependsOn: ['first'],
					apply: () => ({ rollback: secondDescriptor }),
				}),
			]) as never
		);

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'failed',
			error: firstFailure,
		});
		expect(secondKeyReads).toBe(2);
		expect(secondRollback).toHaveBeenCalledTimes(1);
		expect(firstRollback).toHaveBeenCalledTimes(1);
		expect(trace.slice(-2)).toEqual(['second rollback', 'first rollback']);
	});

	it('admits no partial current-phase entries when the snapshot retry fails', () => {
		const firstFailure = new Error('first snapshot');
		const retryFailure = new Error('retry snapshot');
		const priorRollback = jest.fn();
		const currentRollback = jest.fn();
		let keyReads = 0;
		const persistent = Object.defineProperties(
			{},
			{
				key: {
					get: () => {
						keyReads += 1;
						throw keyReads === 1 ? firstFailure : retryFailure;
					},
				},
				label: { get: () => 'Persistent' },
				run: { get: () => currentRollback },
			}
		) as RollbackDescriptor;
		const pipeline = createSerialPipeline({
			...createOptions('fragment', [
				createHelper({
					key: 'prior',
					kind: 'fragment',
					apply: () => ({ rollback: { run: priorRollback } }),
				}),
			]),
			builders: [
				createHelper({
					key: 'current-one',
					kind: 'builder',
					apply: () => ({ rollback: { run: currentRollback } }),
				}),
				createHelper({
					key: 'current-two',
					kind: 'builder',
					dependsOn: ['current-one'],
					apply: () => ({ rollback: persistent }),
				}),
			],
		} as never);

		expect(runPipeline({ pipeline, options: {} })).toMatchObject({
			kind: 'failed',
			error: retryFailure,
		});
		expect(keyReads).toBe(2);
		expect(currentRollback).not.toHaveBeenCalled();
		expect(priorRollback).toHaveBeenCalledTimes(1);
	});
});
