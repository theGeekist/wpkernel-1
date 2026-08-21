import {
	compileTestGraph,
	controlled,
	failure,
	flushMicrotasks,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

const phaseSuccess = <T>(value: T) => ({
	kind: 'success' as const,
	value,
});

describe('v2 effect cancellation and abandonment boundary', () => {
	it('admits no participant phase when the signal is already aborted', () => {
		const controller = new AbortController();
		controller.abort('before');
		const prepare = jest.fn(() => phaseSuccess('prepared'));
		const commit = jest.fn(() => phaseSuccess('receipt'));
		const compensate = jest.fn(() => phaseSuccess(undefined));
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => ({
						...success('done'),
						effects: [{ participant: 'write', payload: 'x' }],
					}),
				},
			],
		});

		const result = runTestGraph({
			graph,
			signal: controller.signal,
			participants: { write: { prepare, commit, compensate } },
		});

		expect(result).toMatchObject({
			kind: 'cancelled',
			reason: 'before',
			effectJournal: [],
		});
		expect(prepare).not.toHaveBeenCalled();
		expect(commit).not.toHaveBeenCalled();
		expect(compensate).not.toHaveBeenCalled();
	});

	it('drains an active prepare then cancel-unwinds and compensates without a signal', () => {
		const controller = new AbortController();
		const calls: string[] = [];
		const cancel = jest.fn();
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => ({
						...success('done'),
						effects: [
							{ participant: 'write', payload: 'active' },
							{ participant: 'write', payload: 'later' },
						],
					}),
				},
			],
		});

		const result = runTestGraph({
			graph,
			signal: controller.signal,
			middleware: [
				{
					node: 'node',
					before: () => ({ state: 'entered', effects: [] }),
					cancel,
				},
			],
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: string }) => {
						calls.push(`prepare:${payload}`);
						controller.abort('prepare');
						return phaseSuccess(payload);
					},
					commit: () => {
						calls.push('commit');
						return phaseSuccess(undefined);
					},
					compensate: (
						options: Readonly<Record<string, unknown>>
					) => {
						calls.push('compensate');
						expect(Object.keys(options)).toEqual(['prepared']);
						expect(Object.isFrozen(options)).toBe(true);
						return phaseSuccess(undefined);
					},
				},
			},
		});

		expect(result).toMatchObject({
			kind: 'cancelled',
			reason: 'prepare',
			effectJournal: [{ effectOrdinal: 0, compensation: 'succeeded' }],
		});
		expect(calls).toEqual(['prepare:active', 'compensate']);
		expect(cancel).toHaveBeenCalledTimes(1);
	});

	it('drops after requests admitted concurrently with abort and compensates earlier work', () => {
		const controller = new AbortController();
		const calls: string[] = [];
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => ({
						...success('done'),
						effects: [{ participant: 'write', payload: 'node' }],
					}),
				},
			],
		});
		const result = runTestGraph({
			graph,
			signal: controller.signal,
			middleware: [
				{
					node: 'node',
					after: () => {
						controller.abort('after');
						return [{ participant: 'write', payload: 'after' }];
					},
				},
			],
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: string }) => {
						calls.push(`prepare:${payload}`);
						return phaseSuccess(payload);
					},
					commit: () => phaseSuccess(undefined),
					compensate: ({
						prepared,
					}: {
						readonly prepared: string;
					}) => {
						calls.push(`compensate:${prepared}`);
						return phaseSuccess(undefined);
					},
				},
			},
		});

		expect(result).toMatchObject({
			kind: 'cancelled',
			effectJournal: [{ request: { payload: 'node' } }],
		});
		expect(calls).toEqual(['prepare:node', 'compensate:node']);
	});

	it('lets a synchronous observer abort between graph success and commit', () => {
		const controller = new AbortController();
		const calls: string[] = [];
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => ({
						...success('done'),
						effects: [{ participant: 'write', payload: 'x' }],
					}),
				},
			],
		});
		const result = runTestGraph({
			graph,
			signal: controller.signal,
			observers: [
				(event) => {
					if (
						event.kind === 'node-transition' &&
						event.state === 'succeeded'
					) {
						controller.abort('observer');
					}
				},
			],
			participants: {
				write: {
					prepare: () => phaseSuccess('prepared'),
					commit: () => {
						calls.push('commit');
						return phaseSuccess(undefined);
					},
					compensate: () => {
						calls.push('compensate');
						return phaseSuccess(undefined);
					},
				},
			},
		});

		expect(result).toMatchObject({ kind: 'cancelled', reason: 'observer' });
		expect(calls).toEqual(['compensate']);
	});

	it('drains an active commit, admits no later commit and compensates all entries', () => {
		const controller = new AbortController();
		const calls: string[] = [];
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => ({
						...success('done'),
						effects: ['one', 'two'].map((payload) => ({
							participant: 'write',
							payload,
						})),
					}),
				},
			],
		});
		const result = runTestGraph({
			graph,
			signal: controller.signal,
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: string }) =>
						phaseSuccess(payload),
					commit: ({ prepared }: { readonly prepared: string }) => {
						calls.push(`commit:${prepared}`);
						controller.abort('commit');
						return phaseSuccess(`receipt:${prepared}`);
					},
					compensate: ({
						prepared,
					}: {
						readonly prepared: string;
					}) => {
						calls.push(`compensate:${prepared}`);
						return phaseSuccess(undefined);
					},
				},
			},
		});

		expect(result).toMatchObject({ kind: 'cancelled', reason: 'commit' });
		expect(calls).toEqual([
			'commit:one',
			'compensate:two',
			'compensate:one',
		]);
	});

	it('compensates concurrent preparations by logical order, not settlement order', async () => {
		const gates = {
			a: controlled<ReturnType<typeof phaseSuccess<string>>>(),
			b: controlled<ReturnType<typeof phaseSuccess<string>>>(),
		};
		const calls: string[] = [];
		const original = new Error('graph');
		const graph = compileTestGraph({
			maxConcurrency: 3,
			effectKeys: ['write'],
			nodes: [
				...['a', 'b'].map((key) => ({
					key,
					effectKeys: ['write'],
					executor: () => ({
						...success(key),
						effects: [{ participant: 'write', payload: key }],
					}),
				})),
				{ key: 'c', executor: () => failure(original) },
			],
		});
		const result = runTestGraph({
			graph,
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: 'a' | 'b' }) =>
						gates[payload].promise,
					commit: () => phaseSuccess(undefined),
					compensate: ({
						prepared,
					}: {
						readonly prepared: string;
					}) => {
						calls.push(prepared);
						return phaseSuccess(undefined);
					},
				},
			},
		});

		gates.b.resolve(phaseSuccess('b'));
		await flushMicrotasks();
		gates.a.resolve(phaseSuccess('a'));
		await expect(result).resolves.toMatchObject({
			kind: 'failed',
			primaryFailure: { error: original },
		});
		expect(calls).toEqual(['b', 'a']);
	});

	it('continues non-cancellable compensation after a new abort', () => {
		const controller = new AbortController();
		const calls: string[] = [];
		const original = new Error('graph');
		const graph = compileTestGraph({
			maxConcurrency: 3,
			effectKeys: ['write'],
			nodes: [
				...['a', 'b'].map((key) => ({
					key,
					effectKeys: ['write'],
					executor: () => ({
						...success(key),
						effects: [{ participant: 'write', payload: key }],
					}),
				})),
				{ key: 'c', executor: () => failure(original) },
			],
		});
		const result = runTestGraph({
			graph,
			signal: controller.signal,
			participants: {
				write: {
					prepare: ({ payload }: { readonly payload: string }) =>
						phaseSuccess(payload),
					commit: () => phaseSuccess(undefined),
					compensate: ({
						prepared,
					}: {
						readonly prepared: string;
					}) => {
						calls.push(prepared);
						if (prepared === 'b') {
							controller.abort('during cleanup');
						}
						return phaseSuccess(undefined);
					},
				},
			},
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { error: original },
		});
		expect(calls).toEqual(['b', 'a']);
	});

	it('keeps an earlier after failure primary when abort occurs during later preparation', () => {
		const controller = new AbortController();
		const afterError = new Error('after');
		const calls: string[] = [];
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => success('done'),
				},
			],
		});
		const result = runTestGraph({
			graph,
			signal: controller.signal,
			middleware: [
				{
					node: 'node',
					after: () => {
						calls.push('after-one');
						return [{ participant: 'write', payload: 'prepared' }];
					},
				},
				{
					node: 'node',
					after: () => {
						calls.push('after-two');
						throw afterError;
					},
				},
			],
			participants: {
				write: {
					prepare: () => {
						calls.push('prepare');
						controller.abort('prepare');
						return phaseSuccess('prepared');
					},
					commit: () => phaseSuccess(undefined),
					compensate: () => {
						calls.push('compensate');
						return phaseSuccess(undefined);
					},
				},
			},
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'thrown', error: afterError },
			effectJournal: [{ compensation: 'succeeded' }],
		});
		expect(calls).toEqual([
			'after-two',
			'after-one',
			'prepare',
			'compensate',
		]);
	});

	it('retains prepared state without cleanup at a Suspension boundary', () => {
		const compensate = jest.fn(() => phaseSuccess(undefined));
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'node',
					effectKeys: ['write'],
					executor: () => ({
						...success('done'),
						pause: { reason: 'later' },
						effects: [{ participant: 'write', payload: 'x' }],
					}),
				},
			],
		});
		const result = runTestGraph({
			graph,
			participants: {
				write: {
					prepare: () => phaseSuccess('prepared'),
					commit: () => phaseSuccess(undefined),
					compensate,
				},
			},
		});

		expect(result).toMatchObject({
			kind: 'suspended',
			effectJournal: [{ compensation: 'not-attempted' }],
		});
		expect(compensate).not.toHaveBeenCalled();
	});
});
