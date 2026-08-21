import {
	compileTestGraph,
	controlled,
	failure,
	flushMicrotasks,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

describe('v2 graph scheduler failure and cancellation', () => {
	it('invokes the complete selected set after a synchronous sibling failure', () => {
		const original = new Error('first');
		const calls: string[] = [];
		const graph = compileTestGraph({
			maxConcurrency: 2,
			nodes: [
				{
					key: 'a',
					executor: () => {
						calls.push('a');
						return failure(original);
					},
				},
				{
					key: 'b',
					executor: () => {
						calls.push('b');
						return success('b');
					},
				},
				{
					key: 'c',
					executor: () => {
						calls.push('c');
						return success('c');
					},
				},
			],
		});

		const result = runTestGraph({ graph });

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { node: 'a', kind: 'declared', error: original },
		});
		expect(calls).toEqual(['a', 'b']);
		expect(result).not.toBeInstanceOf(Promise);
	});

	it('drains admitted siblings and selects primary failure canonically', async () => {
		const first = controlled<ReturnType<typeof failure>>();
		const second = controlled<ReturnType<typeof failure>>();
		const firstError = new Error('canonical first');
		const secondError = new Error('settled first');
		const third = jest.fn(() => success('never'));
		const graph = compileTestGraph({
			maxConcurrency: 2,
			nodes: [
				{ key: 'a', executor: () => first.promise },
				{ key: 'b', executor: () => second.promise },
				{ key: 'c', executor: third },
			],
		});

		const result = runTestGraph({ graph });
		second.resolve(failure(secondError));
		await flushMicrotasks();
		expect(third).not.toHaveBeenCalled();
		first.resolve(failure(firstError));

		await expect(result).resolves.toMatchObject({
			kind: 'failed',
			primaryFailure: { node: 'a', error: firstError },
			failures: [
				{ node: 'a', error: firstError },
				{ node: 'b', error: secondError },
			],
		});
	});

	it('retains original thrown and rejected errors without rejecting the run', async () => {
		const thrown = new Error('thrown');
		const rejected = new Error('rejected');
		const graph = compileTestGraph({
			maxConcurrency: 2,
			nodes: [
				{
					key: 'a',
					executor: () => {
						throw thrown;
					},
				},
				{ key: 'b', executor: () => Promise.reject(rejected) },
			],
		});

		const result = runTestGraph({ graph });

		await expect(result).resolves.toMatchObject({
			kind: 'failed',
			primaryFailure: { node: 'a', kind: 'thrown', error: thrown },
			failures: [
				{ node: 'a', error: thrown },
				{ node: 'b', error: rejected },
			],
		});
	});

	it('admits nothing when the sole signal is already aborted', () => {
		const controller = new AbortController();
		controller.abort('before');
		const executor = jest.fn(() => success('no'));
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor }],
		});

		const result = runTestGraph({ graph, signal: controller.signal });

		expect(result).toMatchObject({
			kind: 'cancelled',
			reason: 'before',
			nodes: [{ node: 'a', kind: 'blocked' }],
		});
		expect(executor).not.toHaveBeenCalled();
		expect(result).not.toBeInstanceOf(Promise);
	});

	it('passes one signal, completes a selected set and stops later admission', () => {
		const controller = new AbortController();
		const signals: AbortSignal[] = [];
		const calls: string[] = [];
		const graph = compileTestGraph({
			maxConcurrency: 2,
			nodes: [
				{
					key: 'a',
					executor: ({ signal }) => {
						calls.push('a');
						signals.push(signal);
						controller.abort('during');
						return { kind: 'cancelled' as const, reason: 'a' };
					},
				},
				{
					key: 'b',
					executor: ({ signal }) => {
						calls.push('b');
						signals.push(signal);
						return { kind: 'cancelled' as const, reason: 'b' };
					},
				},
				{
					key: 'c',
					executor: () => {
						calls.push('c');
						return success('c');
					},
				},
			],
		});

		const result = runTestGraph({ graph, signal: controller.signal });

		expect(result).toMatchObject({ kind: 'cancelled', reason: 'during' });
		expect(calls).toEqual(['a', 'b']);
		expect(signals).toEqual([controller.signal, controller.signal]);
	});

	it('waits for admitted work to drain after abort', async () => {
		const controller = new AbortController();
		const gate = controlled<ReturnType<typeof success<string>>>();
		const later = jest.fn(() => success('later'));
		const graph = compileTestGraph({
			maxConcurrency: 1,
			nodes: [
				{ key: 'active', executor: () => gate.promise },
				{ key: 'later', executor: later },
			],
		});
		const result = runTestGraph({ graph, signal: controller.signal });
		let settled = false;
		void Promise.resolve(result).then(() => {
			settled = true;
		});

		controller.abort('stop');
		await flushMicrotasks();
		expect(settled).toBe(false);
		expect(later).not.toHaveBeenCalled();
		gate.resolve(success('done'));

		await expect(result).resolves.toMatchObject({
			kind: 'cancelled',
			reason: 'stop',
		});
	});

	it('treats cancellation without an aborted signal as a contract failure', () => {
		const graph = compileTestGraph({
			nodes: [
				{ key: 'a', executor: () => ({ kind: 'cancelled' as const }) },
			],
		});

		const result = runTestGraph({ graph });

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { node: 'a', kind: 'contract' },
		});
	});

	it('keeps a graph failure authoritative over cancellation', async () => {
		const controller = new AbortController();
		const gate = controlled<ReturnType<typeof failure>>();
		const original = new Error('graph failure');
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor: () => gate.promise }],
		});
		const result = runTestGraph({ graph, signal: controller.signal });

		controller.abort('cancel');
		gate.resolve(failure(original));

		await expect(result).resolves.toMatchObject({
			kind: 'failed',
			primaryFailure: { error: original },
		});
	});
});
