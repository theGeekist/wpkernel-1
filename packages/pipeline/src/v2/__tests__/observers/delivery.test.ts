import {
	createObserverRuntime,
	publishNodeEvent,
	publishTerminalEvent,
} from '../../observers/dispatcher.js';
import type { RunEvent } from '../../observers/types.js';
import {
	compileTestGraph,
	controlled,
	flushMicrotasks,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

describe('v2 read-only run observers', () => {
	it('exports explicit observer runtime operations through its module boundary', () => {
		expect(createObserverRuntime).toEqual(expect.any(Function));
		expect(publishNodeEvent).toEqual(expect.any(Function));
		expect(publishTerminalEvent).toEqual(expect.any(Function));

		const runtime = createObserverRuntime({});
		expect(runtime).toEqual({
			observers: [],
			failures: [],
			events: [],
			nextSequence: 0,
		});
		expect(Object.values(runtime)).not.toContainEqual(expect.any(Function));
	});

	it('delivers frozen events in FIFO registration order and contains failures', () => {
		const original = new Error('observer');
		const calls: string[] = [];
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});
		const result = runTestGraph({
			graph,
			observers: [
				(event) => {
					expect(Object.isFrozen(event)).toBe(true);
					calls.push(`one:${event.kind}:${event.sequence}`);
					if (
						event.kind === 'node-transition' &&
						event.state === 'succeeded'
					) {
						throw original;
					}
				},
				(event) => {
					calls.push(`two:${event.kind}:${event.sequence}`);
				},
			],
		});

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'succeeded',
			observerFailures: [
				{ observerIndex: 0, eventSequence: 1, error: original },
			],
		});
		expect(calls).toEqual([
			'one:node-transition:0',
			'two:node-transition:0',
			'one:node-transition:1',
			'two:node-transition:1',
			'one:run-terminal:2',
			'two:run-terminal:2',
		]);
	});

	it('never gates admission but delays terminal settlement through its queue', async () => {
		const gate = controlled<void>();
		const calls: string[] = [];
		const events: string[] = [];
		const graph = compileTestGraph({
			maxConcurrency: 1,
			nodes: ['a', 'b'].map((key) => ({
				key,
				executor: () => {
					calls.push(key);
					return success(key);
				},
			})),
		});
		const result = runTestGraph({
			graph,
			observers: [
				(event) => {
					events.push(`${event.kind}:${event.sequence}`);
					return event.sequence === 0 ? gate.promise : undefined;
				},
			],
		});
		let settled = false;
		void Promise.resolve(result).then(() => {
			settled = true;
		});

		expect(calls).toEqual(['a', 'b']);
		expect(events).toEqual(['node-transition:0']);
		expect(settled).toBe(false);
		gate.resolve(undefined);

		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
		expect(events).toEqual([
			'node-transition:0',
			'node-transition:1',
			'node-transition:2',
			'node-transition:3',
			'run-terminal:4',
		]);
	});

	it('retains a newer tail while prior observer delivery is still pending', async () => {
		const first = controlled<void>();
		const second = controlled<void>();
		const delivered: number[] = [];
		const runtime = createObserverRuntime({
			observers: [
				(event) => {
					delivered.push(event.sequence);
					if (event.sequence === 0) {
						return first.promise;
					}
					return event.sequence === 1 ? second.promise : undefined;
				},
			],
		});
		publishNodeEvent(runtime, {
			node: 'node',
			nodeOrdinal: 0,
			state: 'active',
		});
		const prior = publishTerminalEvent(runtime, 'suspended');

		first.resolve();
		await flushMicrotasks();
		expect(delivered).toEqual([0, 1]);
		const next = publishTerminalEvent(runtime, 'abandoned');
		expect(next).toBeInstanceOf(Promise);
		expect(delivered).toEqual([0, 1]);

		second.resolve();
		await Promise.all([prior, next]);
		expect(delivered).toEqual([0, 1, 2]);
	});

	it('contains rejected observer thenables and continues later observers', async () => {
		const original = new Error('rejected');
		const later: RunEvent[] = [];
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});

		const result = runTestGraph({
			graph,
			observers: [
				(event) =>
					event.sequence === 0 ? Promise.reject(original) : undefined,
				(event) => {
					later.push(event);
				},
			],
		});

		await expect(result).resolves.toMatchObject({
			kind: 'succeeded',
			observerFailures: [
				{ observerIndex: 0, eventSequence: 0, error: original },
			],
		});
		expect(later.map(({ sequence }) => sequence)).toEqual([0, 1, 2]);
	});

	it('contains throwing observer then getters without promotion', () => {
		const original = new Error('then getter');
		const later = jest.fn();
		const thenable = Object.defineProperty({}, 'then', {
			get() {
				throw original;
			},
		});
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});

		const result = runTestGraph({
			graph,
			observers: [() => thenable as PromiseLike<void>, later],
		});

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'succeeded',
			observerFailures: [
				{ observerIndex: 0, eventSequence: 0, error: original },
				{ observerIndex: 0, eventSequence: 1, error: original },
				{ observerIndex: 0, eventSequence: 2, error: original },
			],
		});
		expect(later).toHaveBeenCalledTimes(3);
	});

	it('chains asynchronous terminal delivery after asynchronous work', async () => {
		const execution = controlled<ReturnType<typeof success<string>>>();
		const terminalDelivery = controlled<void>();
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => execution.promise }],
		});
		const result = runTestGraph({
			graph,
			observers: [
				(event) =>
					event.kind === 'run-terminal'
						? terminalDelivery.promise
						: undefined,
			],
		});
		let settled = false;
		void Promise.resolve(result).then(() => {
			settled = true;
		});

		execution.resolve(success('done'));
		await flushMicrotasks();
		expect(settled).toBe(false);
		terminalDelivery.resolve(undefined);

		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
	});

	it('captures registrations once at run admission', async () => {
		const gate = controlled<ReturnType<typeof success<string>>>();
		const first = jest.fn();
		const addedLater = jest.fn();
		const observers = [first];
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => gate.promise }],
		});
		const result = runTestGraph({ graph, observers });

		observers.push(addedLater);
		gate.resolve(success('done'));
		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });

		expect(first).toHaveBeenCalledTimes(3);
		expect(addedLater).not.toHaveBeenCalled();
	});

	it('reads an observer thenable once', async () => {
		let reads = 0;
		let calls = 0;
		const thenable = Object.defineProperty({}, 'then', {
			get() {
				reads += 1;
				return (resolve: () => void) => {
					calls += 1;
					resolve();
				};
			},
		});
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});
		const result = runTestGraph({
			graph,
			observers: [() => thenable as PromiseLike<void>],
		});

		expect(reads).toBe(1);
		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
		expect(reads).toBe(3);
		expect(calls).toBe(3);
	});

	it('rejects hostile observer registration arrays synchronously', () => {
		const observers = new Proxy([], {
			ownKeys() {
				throw new Error('hostile');
			},
		});
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});

		expect(() =>
			runTestGraph({ graph, observers: observers as never })
		).toThrow('dense array');
		expect(() => runTestGraph({ graph, observers: [42] as never })).toThrow(
			'dense array'
		);
		expect(() => runTestGraph({ graph, observers: {} as never })).toThrow(
			'dense array'
		);
	});

	it('delivers twenty thousand synchronous observers without promotion', () => {
		const width = 20_000;
		let calls = 0;
		const observers = Array.from({ length: width }, () => () => {
			calls += 1;
		});
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});

		const result = runTestGraph({ graph, observers });

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({ kind: 'succeeded' });
		expect(calls).toBe(width * 3);
	});

	it('publishes pause-conflict failure before the terminal event', async () => {
		const pause = (output: string) => ({
			...success(output),
			pause: { reason: output },
		});
		const first = controlled<ReturnType<typeof pause>>();
		const second = controlled<ReturnType<typeof pause>>();
		const events: RunEvent[] = [];
		const graph = compileTestGraph({
			maxConcurrency: 2,
			nodes: [
				{ key: 'a', executor: () => first.promise },
				{ key: 'b', executor: () => second.promise },
			],
		});
		const result = runTestGraph({
			graph,
			observers: [
				function (this: unknown, event) {
					expect(this).toBeUndefined();
					events.push(event);
				},
			],
		});

		second.resolve(pause('second'));
		first.resolve(pause('first'));

		await expect(result).resolves.toMatchObject({
			kind: 'failed',
			nodes: [
				{ node: 'a', kind: 'succeeded' },
				{ node: 'b', kind: 'failed' },
			],
		});
		expect(
			events
				.filter(
					(
						event
					): event is Extract<
						RunEvent,
						{ readonly kind: 'node-transition' }
					> => event.kind === 'node-transition' && event.node === 'b'
				)
				.map(({ state }) => state)
		).toEqual(['active', 'succeeded', 'failed']);
		expect(events.at(-1)).toMatchObject({
			kind: 'run-terminal',
			outcomeKind: 'failed',
		});
	});
});
