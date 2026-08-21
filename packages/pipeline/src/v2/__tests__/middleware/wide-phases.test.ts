import {
	compileTestGraph,
	failure,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

const width = 20_000;

describe('v2 wide synchronous middleware traversal', () => {
	it('keeps twenty thousand before phases synchronous and ordered', () => {
		let cursor = 0;
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});
		const middleware = Array.from({ length: width }, (_, index) => ({
			node: 'node',
			before: () => {
				if (index !== cursor) {
					throw new Error('before order');
				}
				cursor += 1;
				return { state: index, effects: [] };
			},
		}));

		const result = runTestGraph({ graph, middleware });

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({ kind: 'succeeded' });
		expect(cursor).toBe(width);
	});

	it('keeps twenty thousand reverse after phases synchronous and ordered', () => {
		let cursor = width - 1;
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => success('done') }],
		});
		const middleware = Array.from({ length: width }, (_, index) => ({
			node: 'node',
			after: () => {
				if (index !== cursor) {
					throw new Error('after order');
				}
				cursor -= 1;
				return [];
			},
		}));

		const result = runTestGraph({ graph, middleware });

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({ kind: 'succeeded' });
		expect(cursor).toBe(-1);
	});

	it('keeps twenty thousand reverse error phases algebraic', () => {
		let cursor = width - 1;
		const original = new Error('node');
		const graph = compileTestGraph({
			nodes: [{ key: 'node', executor: () => failure(original) }],
		});
		const middleware = Array.from({ length: width }, (_, index) => ({
			node: 'node',
			error: () => {
				if (index !== cursor) {
					throw new Error('error order');
				}
				cursor -= 1;
			},
		}));

		const result = runTestGraph({ graph, middleware });

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { error: original },
		});
		expect(cursor).toBe(-1);
	});

	it('keeps twenty thousand reverse cancel phases algebraic', () => {
		let cursor = width - 1;
		const controller = new AbortController();
		const graph = compileTestGraph({
			nodes: [
				{
					key: 'node',
					executor: () => {
						controller.abort('stop');
						return success('done');
					},
				},
			],
		});
		const middleware = Array.from({ length: width }, (_, index) => ({
			node: 'node',
			cancel: () => {
				if (index !== cursor) {
					throw new Error('cancel order');
				}
				cursor -= 1;
			},
		}));

		const result = runTestGraph({
			graph,
			signal: controller.signal,
			middleware,
		});

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({ kind: 'cancelled' });
		expect(cursor).toBe(-1);
	});

	it('hands off one hundred and fifty thousand effects without spread calls', () => {
		const effectCount = 150_000;
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
		const effects = Array.from({ length: effectCount }, (_, payload) => ({
			participant: 'write',
			payload,
		}));

		const result = runTestGraph({
			graph,
			middleware: [
				{
					node: 'node',
					before: () => ({ state: undefined, effects }),
				},
			],
		});

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({ kind: 'succeeded' });
		if (result instanceof Promise) {
			throw new Error('Expected synchronous effect handoff.');
		}
		expect(result.pendingEffects).toHaveLength(effectCount);
		expect(result.pendingEffects.at(-1)).toMatchObject({
			effectOrdinal: effectCount - 1,
			request: { payload: effectCount - 1 },
		});
	});
});
