import { compileNodeMiddleware } from '../../middleware/index.js';
import {
	compileTestGraph,
	failure,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

describe('v2 middleware adversarial phase boundaries', () => {
	it('exports middleware compilation through its module boundary', () => {
		expect(compileNodeMiddleware).toEqual(expect.any(Function));
	});

	it.each([
		['non-record', 42],
		[
			'hostile',
			new Proxy(
				{},
				{
					ownKeys() {
						throw new Error('before keys');
					},
				}
			),
		],
		['incomplete', { state: undefined }],
		['invalid effects', { state: undefined, effects: {} }],
	])('contains a %s before result', (_label, beforeResult) => {
		const executor = jest.fn(() => success('never'));
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor }],
		});

		const result = runTestGraph({
			graph,
			middleware: [{ node: 'node', before: () => beforeResult }],
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'contract' },
		});
		expect(executor).not.toHaveBeenCalled();
	});

	it('cancel-unwinds a before phase that aborts while settling', () => {
		const controller = new AbortController();
		const executor = jest.fn(() => success('never'));
		const cancel = jest.fn();
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor }],
		});

		const result = runTestGraph({
			graph,
			signal: controller.signal,
			middleware: [
				{
					node: 'node',
					before: () => {
						controller.abort('before-settled');
						return { state: 'entered', effects: [] };
					},
					cancel,
				},
			],
		});

		expect(result).toMatchObject({ kind: 'cancelled' });
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(executor).not.toHaveBeenCalled();
	});

	it('cancel-unwinds a phase without before when its signal changes', () => {
		let abortedReads = 0;
		const signal = {
			get aborted() {
				abortedReads += 1;
				return abortedReads > 1;
			},
			reason: 'changed',
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		} as unknown as AbortSignal;
		const executor = jest.fn(() => success('never'));
		const cancel = jest.fn();
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor }],
		});

		const result = runTestGraph({
			graph,
			signal,
			middleware: [{ node: 'node', cancel }],
		});

		expect(result).toMatchObject({ kind: 'cancelled', reason: 'changed' });
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(executor).not.toHaveBeenCalled();
	});

	it('retains an invalid after result as a contract failure', () => {
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});

		const result = runTestGraph({
			graph,
			middleware: [{ node: 'node', after: () => ({}) }],
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'contract' },
		});
	});

	it('drops after effects when the phase aborts while settling', () => {
		const controller = new AbortController();
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
						controller.abort('after-settled');
						return [{ participant: 'write', payload: 'discarded' }];
					},
				},
			],
		});

		expect(result).toMatchObject({
			kind: 'cancelled',
			effectJournal: [],
		});
	});

	it('promotes an after failure above an abort before remaining after work', () => {
		const controller = new AbortController();
		const earlierAfter = jest.fn(() => []);
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});

		const result = runTestGraph({
			graph,
			signal: controller.signal,
			middleware: [
				{ node: 'node', after: earlierAfter },
				{
					node: 'node',
					after: () => {
						controller.abort('after');
						return {};
					},
				},
			],
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'contract' },
		});
		expect(earlierAfter).not.toHaveBeenCalled();
	});

	it('retains a non-void error cleanup as a secondary failure', () => {
		const original = new Error('node');
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => failure(original) }],
		});

		const result = runTestGraph({
			graph,
			middleware: [
				{
					node: 'node',
					before: () => ({ state: 'entered', effects: [] }),
					error: () => 'invalid',
				},
			],
		});

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'declared', error: original },
			failures: [
				{ kind: 'declared', error: original },
				{ kind: 'contract' },
			],
		});
	});
});
