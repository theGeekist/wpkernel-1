import { abandon, resume } from '../../suspension/index.js';
import {
	compileTestGraph,
	controlled,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

const phaseSuccess = <T>(value: T) => ({
	kind: 'success' as const,
	value,
});

const requireSuspension = (value: ReturnType<typeof runTestGraph>) => {
	if (value instanceof Promise || value.kind !== 'suspended') {
		throw new Error('Expected a synchronous suspension.');
	}
	return value.suspension;
};

describe('v2 process-local Suspension lifecycle', () => {
	it('pauses and resumes synchronously without replay or preparation loss', () => {
		const calls: string[] = [];
		const prepare = jest.fn(({ payload }: { readonly payload: string }) => {
			calls.push(`prepare:${payload}`);
			return phaseSuccess(`prepared:${payload}`);
		});
		const commit = jest.fn(
			({ prepared }: { readonly prepared: string }) => {
				calls.push(`commit:${prepared}`);
				return phaseSuccess('receipt');
			}
		);
		const graph = compileTestGraph({
			effectKeys: ['write'],
			edges: [{ from: 'pause', to: 'continue' }],
			outputs: { result: 'continue' },
			maxConcurrency: 1,
			nodes: [
				{
					key: 'pause',
					effectKeys: ['write'],
					executor: () => {
						calls.push('pause');
						return {
							...success('paused-output'),
							pause: { reason: 'review' },
							effects: [{ participant: 'write', payload: 'one' }],
						};
					},
				},
				{
					key: 'continue',
					executor: ({ input }) => {
						calls.push(`continue:${input.dependencies.pause}`);
						return success('complete');
					},
				},
			],
		});
		const suspended = runTestGraph({
			graph,
			participants: {
				write: {
					prepare,
					commit,
					compensate: jest.fn(() => phaseSuccess(undefined)),
				},
			},
		});

		expect(suspended).not.toBeInstanceOf(Promise);
		expect(suspended).toMatchObject({
			kind: 'suspended',
			effectJournal: [
				{ commit: 'not-attempted', compensation: 'not-attempted' },
			],
		});
		const suspension = requireSuspension(suspended);
		expect(Object.isFrozen(suspension)).toBe(true);
		expect(Object.isFrozen(suspension.snapshot)).toBe(true);
		expect(Object.isFrozen(suspension.snapshot.nodes)).toBe(true);

		const completed = resume({ suspension });

		expect(completed).not.toBeInstanceOf(Promise);
		expect(completed).toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'complete' },
			effectJournal: [{ commit: 'succeeded' }],
			diagnostics: {
				nodes: [
					{
						node: 'pause',
						admissionSequence: 0,
						settlementSequence: 0,
					},
					{
						node: 'continue',
						admissionSequence: 1,
						settlementSequence: 1,
					},
				],
			},
		});
		if (completed instanceof Promise) {
			throw new Error('Expected synchronous resume.');
		}
		const completedOutcome = completed as Awaited<typeof completed>;
		expect(
			completedOutcome.diagnostics.events.flatMap((event) =>
				event.kind === 'run-terminal' ? [event.outcomeKind] : []
			)
		).toEqual(['suspended', 'succeeded']);
		expect(calls).toEqual([
			'pause',
			'prepare:one',
			'continue:paused-output',
			'commit:prepared:one',
		]);
		expect(prepare).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('reuses captured middleware, observer and participant registrations', () => {
		const calls: string[] = [];
		const originalObserver = jest.fn();
		const laterObserver = jest.fn();
		const observers = [originalObserver];
		const originalBefore = jest.fn(() => ({ state: 'old', effects: [] }));
		const replacementBefore = jest.fn(() => ({
			state: 'new',
			effects: [],
		}));
		const middleware = [{ node: 'continue', before: originalBefore }];
		const originalCommit = jest.fn(() => {
			calls.push('original-commit');
			return phaseSuccess('receipt');
		});
		const replacementCommit = jest.fn(() => phaseSuccess('replacement'));
		const participants = {
			write: {
				prepare: () => phaseSuccess('prepared'),
				commit: originalCommit,
				compensate: () => phaseSuccess(undefined),
			},
		};
		const graph = compileTestGraph({
			effectKeys: ['write'],
			edges: [{ from: 'pause', to: 'continue' }],
			maxConcurrency: 1,
			nodes: [
				{
					key: 'pause',
					effectKeys: ['write'],
					executor: () => ({
						...success('pause'),
						pause: { reason: 'review' },
						effects: [{ participant: 'write', payload: 'payload' }],
					}),
				},
				{ key: 'continue', executor: () => success('complete') },
			],
		});
		const suspension = requireSuspension(
			runTestGraph({
				graph,
				middleware,
				observers,
				participants,
			})
		);
		middleware[0]!.before = replacementBefore;
		observers.push(laterObserver);
		participants.write.commit = replacementCommit;

		const completed = resume({ suspension });

		expect(completed).toMatchObject({ kind: 'succeeded' });
		expect(originalBefore).toHaveBeenCalledTimes(1);
		expect(replacementBefore).not.toHaveBeenCalled();
		expect(originalCommit).toHaveBeenCalledTimes(1);
		expect(replacementCommit).not.toHaveBeenCalled();
		expect(originalObserver).toHaveBeenCalled();
		expect(laterObserver).not.toHaveBeenCalled();
		expect(calls).toEqual(['original-commit']);
	});

	it('reuses the captured signal unless a replacement becomes sole', () => {
		const firstController = new AbortController();
		const firstLater = jest.fn(() => success('never'));
		const firstGraph = compileTestGraph({
			maxConcurrency: 1,
			nodes: [
				{
					key: 'pause',
					priority: 10,
					executor: () => ({
						...success('pause'),
						pause: { reason: 'wait' },
					}),
				},
				{ key: 'later', executor: firstLater },
			],
		});
		const first = requireSuspension(
			runTestGraph({ graph: firstGraph, signal: firstController.signal })
		);
		firstController.abort('captured');

		const cancelled = resume({ suspension: first });

		expect(cancelled).toMatchObject({
			kind: 'cancelled',
			reason: 'captured',
		});
		expect(firstLater).not.toHaveBeenCalled();

		const secondController = new AbortController();
		const replacementController = new AbortController();
		const seenSignals: AbortSignal[] = [];
		const secondGraph = compileTestGraph({
			maxConcurrency: 1,
			nodes: [
				{
					key: 'pause',
					priority: 10,
					executor: () => ({
						...success('pause'),
						pause: { reason: 'wait' },
					}),
				},
				{
					key: 'later',
					executor: ({ signal }) => {
						seenSignals.push(signal);
						return success('continued');
					},
				},
			],
		});
		const second = requireSuspension(
			runTestGraph({
				graph: secondGraph,
				signal: secondController.signal,
			})
		);
		secondController.abort('ignored');

		const completed = resume({
			suspension: second,
			signal: replacementController.signal,
		});

		expect(completed).toMatchObject({ kind: 'succeeded' });
		expect(seenSignals).toEqual([replacementController.signal]);
	});

	it('abandons synchronously in reverse journal order and retains every failure', () => {
		const calls: string[] = [];
		const cleanupTwo = { code: 'two' } as const;
		const cleanupOne = new Error('one');
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'pause',
					effectKeys: ['write'],
					executor: () => ({
						...success('paused'),
						pause: { reason: 'stop' },
						effects: ['one', 'two'].map((payload) => ({
							participant: 'write',
							payload,
						})),
					}),
				},
			],
		});
		const suspension = requireSuspension(
			runTestGraph({
				graph,
				participants: {
					write: {
						prepare: ({ payload }: { readonly payload: string }) =>
							phaseSuccess(payload),
						commit: () => phaseSuccess(undefined),
						compensate: (options: {
							readonly prepared: string;
						}) => {
							expect(options).not.toHaveProperty('signal');
							calls.push(options.prepared);
							if (options.prepared === 'one') {
								throw cleanupOne;
							}
							return { kind: 'failure', error: cleanupTwo };
						},
					},
				},
			})
		);

		const abandoned = abandon({ suspension });

		expect(abandoned).not.toBeInstanceOf(Promise);
		expect(abandoned).toMatchObject({
			kind: 'abandoned',
			cleanupFailures: [
				{ kind: 'declared', error: cleanupTwo },
				{ kind: 'thrown', error: cleanupOne },
			],
			effectJournal: [
				{ effectOrdinal: 0, compensation: 'failed' },
				{ effectOrdinal: 1, compensation: 'failed' },
			],
		});
		expect(calls).toEqual(['two', 'one']);
		expect(() => resume({ suspension })).toThrow('already been consumed');
	});

	it('drains admitted asynchronous siblings and resumes only pending work', async () => {
		const first = controlled<
			ReturnType<typeof success<string>> & {
				readonly pause: { readonly reason: string };
			}
		>();
		const sibling = controlled<ReturnType<typeof success<string>>>();
		const continuation = controlled<ReturnType<typeof success<string>>>();
		const calls: string[] = [];
		const graph = compileTestGraph({
			maxConcurrency: 2,
			nodes: [
				{
					key: 'a',
					executor: () => {
						calls.push('a');
						return first.promise;
					},
				},
				{
					key: 'b',
					executor: () => {
						calls.push('b');
						return sibling.promise;
					},
				},
				{
					key: 'c',
					executor: () => {
						calls.push('c');
						return continuation.promise;
					},
				},
			],
		});
		const pending = runTestGraph({ graph });
		first.resolve({ ...success('a'), pause: { reason: 'review' } });
		sibling.resolve(success('b'));
		const suspended = await pending;
		if (suspended.kind !== 'suspended') {
			throw new Error('Expected suspension after drained siblings.');
		}

		const resumed = resume({ suspension: suspended.suspension });
		expect(resumed).toBeInstanceOf(Promise);
		expect(() => abandon({ suspension: suspended.suspension })).toThrow(
			'already been consumed'
		);
		continuation.resolve(success('c'));

		await expect(resumed).resolves.toMatchObject({ kind: 'succeeded' });
		expect(calls).toEqual(['a', 'b', 'c']);
	});

	it('promotes asynchronous suspended and abandoned observer delivery', async () => {
		const suspendedDelivery = controlled<void>();
		const abandonedDelivery = controlled<void>();
		const graph = compileTestGraph({
			nodes: [
				{
					key: 'pause',
					executor: () => ({
						...success('pause'),
						pause: { reason: 'review' },
					}),
				},
			],
		});
		const pending = runTestGraph({
			graph,
			observers: [
				(event) => {
					if (event.kind !== 'run-terminal') {
						return undefined;
					}
					return event.outcomeKind === 'suspended'
						? suspendedDelivery.promise
						: abandonedDelivery.promise;
				},
			],
		});

		expect(pending).toBeInstanceOf(Promise);
		suspendedDelivery.resolve();
		const suspended = await pending;
		if (suspended.kind !== 'suspended') {
			throw new Error('Expected asynchronously delivered suspension.');
		}

		const abandoning = abandon({ suspension: suspended.suspension });
		expect(abandoning).toBeInstanceOf(Promise);
		abandonedDelivery.resolve();
		await expect(abandoning).resolves.toMatchObject({ kind: 'abandoned' });
	});

	it('resumes synchronously after suspended observer delivery quiesces', async () => {
		const delivery = controlled<void>();
		const graph = compileTestGraph({
			edges: [{ from: 'pause', to: 'continue' }],
			nodes: [
				{
					key: 'pause',
					executor: () => ({
						...success('pause'),
						pause: { reason: 'review' },
					}),
				},
				{ key: 'continue', executor: () => success('complete') },
			],
		});
		const pending = runTestGraph({
			graph,
			observers: [
				(event) =>
					event.kind === 'run-terminal' &&
					event.outcomeKind === 'suspended'
						? delivery.promise
						: undefined,
			],
		});

		delivery.resolve();
		const suspended = await pending;
		if (suspended.kind !== 'suspended') {
			throw new Error('Expected delivered suspension.');
		}
		const resumed = resume({ suspension: suspended.suspension });

		expect(resumed).not.toBeInstanceOf(Promise);
		expect(resumed).toMatchObject({ kind: 'succeeded' });
	});

	it('abandons synchronously after suspended observer delivery quiesces', async () => {
		const delivery = controlled<void>();
		const graph = compileTestGraph({
			nodes: [
				{
					key: 'pause',
					executor: () => ({
						...success('pause'),
						pause: { reason: 'review' },
					}),
				},
			],
		});
		const pending = runTestGraph({
			graph,
			observers: [
				(event) =>
					event.kind === 'run-terminal' &&
					event.outcomeKind === 'suspended'
						? delivery.promise
						: undefined,
			],
		});

		delivery.resolve();
		const suspended = await pending;
		if (suspended.kind !== 'suspended') {
			throw new Error('Expected delivered suspension.');
		}
		const abandoned = abandon({ suspension: suspended.suspension });

		expect(abandoned).not.toBeInstanceOf(Promise);
		expect(abandoned).toMatchObject({ kind: 'abandoned' });
	});
});
