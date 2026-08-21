import {
	addReadyNode,
	createReadyQueue,
	readyNodeCount,
	takeReadyNodes,
} from '../../scheduler/ready-queue.js';
import {
	compileTestGraph,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

describe('v2 scheduler ordinal ready queue', () => {
	it('bounds ordinal comparisons logarithmically while preserving order', () => {
		const count = 4_096;
		let ordinalReads = 0;
		const ordinals = new Proxy(
			Object.fromEntries(
				Array.from({ length: count }, (_unused, ordinal) => [
					`node-${ordinal}`,
					ordinal,
				])
			),
			{
				get(target, key, receiver) {
					if (typeof key === 'string') {
						ordinalReads += 1;
					}
					return Reflect.get(target, key, receiver);
				},
			}
		);
		const queue = createReadyQueue(ordinals);
		for (let ordinal = count - 1; ordinal >= 0; ordinal -= 1) {
			addReadyNode(queue, `node-${ordinal}`);
		}

		const selected = takeReadyNodes(queue, count + 1);

		expect(selected).toEqual(
			Array.from(
				{ length: count },
				(_unused, ordinal) => `node-${ordinal}`
			)
		);
		expect(readyNodeCount(queue)).toBe(0);
		expect(ordinalReads).toBeLessThan(count * 64);
	});

	it('executes a wide synchronous fan-out canonically at capacity one', () => {
		const childCount = 4_096;
		const keys = Array.from(
			{ length: childCount },
			(_unused, index) => `child-${String(index).padStart(5, '0')}`
		);
		const calls: string[] = [];
		const graph = compileTestGraph({
			maxConcurrency: 1,
			edges: keys.map((to) => ({ from: 'source', to })),
			nodes: [
				{
					key: 'source',
					executor: () => {
						calls.push('source');
						return success('source');
					},
				},
				...keys.map((key) => ({
					key,
					executor: () => {
						calls.push(key);
						return success(key);
					},
				})),
			],
		});

		const result = runTestGraph({ graph });

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({ kind: 'succeeded' });
		expect(calls).toEqual(['source', ...keys]);
	});
});
