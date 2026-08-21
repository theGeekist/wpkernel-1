import type { ErasedScheduleOutcome } from '../../scheduler/state.js';
import type { EffectRegistry } from '../../graph/types.js';
import {
	compileTestGraph,
	controlled,
	failure,
	flushMicrotasks,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

const pause = (reason: string) => ({
	kind: 'success' as const,
	output: reason,
	effects: [],
	pause: { reason },
});

const expectAsync = (
	value:
		| ErasedScheduleOutcome<EffectRegistry>
		| Promise<ErasedScheduleOutcome<EffectRegistry>>
): Promise<ErasedScheduleOutcome<EffectRegistry>> => {
	if (!(value instanceof Promise)) {
		throw new Error('Expected asynchronous scheduling.');
	}
	return value;
};

describe('v2 scheduler pause handoff and races', () => {
	it('stops admission on a clean pause and retains one immutable handoff', () => {
		const later = jest.fn(() => success('later'));
		const graph = compileTestGraph({
			maxConcurrency: 1,
			nodes: [
				{
					key: 'pause',
					priority: 10,
					executor: () => pause('review'),
				},
				{ key: 'later', executor: later },
			],
		});

		const result = runTestGraph({ graph });

		expect(result).toMatchObject({
			kind: 'pause-requested',
			primaryPause: {
				node: 'pause',
				request: { reason: 'review' },
			},
			pendingPauses: [{ node: 'pause' }],
			nodes: [
				{ node: 'pause', kind: 'succeeded' },
				{ node: 'later', kind: 'blocked' },
			],
		});
		expect(later).not.toHaveBeenCalled();
		if (result instanceof Promise) {
			throw new Error('Expected synchronous pause.');
		}
		expect(Object.isFrozen(result.pendingPauses)).toBe(true);
		expect(Object.isFrozen(result.pendingPauses[0]!.request)).toBe(true);
	});

	it('classifies every concurrent additional pause canonically as failure', async () => {
		const first = controlled<ReturnType<typeof pause>>();
		const second = controlled<ReturnType<typeof pause>>();
		const later = jest.fn(() => success('never'));
		const graph = compileTestGraph({
			maxConcurrency: 2,
			nodes: [
				{ key: 'a', executor: () => first.promise },
				{ key: 'b', executor: () => second.promise },
				{ key: 'c', executor: later },
			],
		});

		const result = expectAsync(runTestGraph({ graph }));
		second.resolve(pause('settled-first'));
		await flushMicrotasks();
		expect(later).not.toHaveBeenCalled();
		first.resolve(pause('canonical-first'));

		await expect(result).resolves.toMatchObject({
			kind: 'failed',
			primaryFailure: { node: 'b', kind: 'contract' },
			pendingPauses: [
				{ node: 'a', request: { reason: 'canonical-first' } },
			],
			nodes: [
				{ node: 'a', kind: 'succeeded' },
				{ node: 'b', kind: 'failed' },
				{ node: 'c', kind: 'blocked' },
			],
		});
	});

	it('orders failure above cancellation and cancellation above pause', () => {
		const pauseController = new AbortController();
		const cancelledGraph = compileTestGraph({
			nodes: [
				{
					key: 'a',
					executor: () => {
						pauseController.abort('cancel');
						return pause('pause');
					},
				},
			],
		});

		expect(
			runTestGraph({
				graph: cancelledGraph,
				signal: pauseController.signal,
			})
		).toMatchObject({
			kind: 'cancelled',
			pendingPauses: [{ node: 'a' }],
		});

		const failureController = new AbortController();
		const original = new Error('failure');
		const failedGraph = compileTestGraph({
			maxConcurrency: 2,
			nodes: [
				{ key: 'a', executor: () => pause('pause') },
				{
					key: 'b',
					executor: () => {
						failureController.abort('cancel');
						return failure(original);
					},
				},
			],
		});

		expect(
			runTestGraph({
				graph: failedGraph,
				signal: failureController.signal,
			})
		).toMatchObject({
			kind: 'failed',
			primaryFailure: { error: original },
		});
	});

	it('rejects an invalid pause request as a node contract failure', () => {
		const graph = compileTestGraph({
			nodes: [
				{
					key: 'a',
					executor: () => ({
						...success('a'),
						pause: { reason: 42 },
					}),
				},
			],
		});

		expect(runTestGraph({ graph })).toMatchObject({
			kind: 'failed',
			primaryFailure: { node: 'a', kind: 'contract' },
		});
	});

	it('keeps failure and pause selection stable through repeated reverse races', async () => {
		for (let iteration = 0; iteration < 40; iteration += 1) {
			const first = controlled<ReturnType<typeof failure>>();
			const second = controlled<ReturnType<typeof failure>>();
			const firstError = new Error(`first-${iteration}`);
			const secondError = new Error(`second-${iteration}`);
			const graph = compileTestGraph({
				maxConcurrency: 2,
				nodes: [
					{ key: 'a', executor: () => first.promise },
					{ key: 'b', executor: () => second.promise },
				],
			});
			const result = expectAsync(runTestGraph({ graph }));
			if (iteration % 2 === 0) {
				second.resolve(failure(secondError));
				first.resolve(failure(firstError));
			} else {
				first.resolve(failure(firstError));
				second.resolve(failure(secondError));
			}
			const outcome = await result;
			expect(outcome).toMatchObject({
				kind: 'failed',
				primaryFailure: { node: 'a', error: firstError },
			});
		}
	});
});
