import { abandon } from '../../suspension/index.js';
import {
	compileTestGraph,
	controlled,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

const synchronousGraph = () =>
	compileTestGraph({
		maxConcurrency: 2,
		nodes: ['a', 'b'].map((key) => ({
			key,
			executor: () => success(key),
		})),
	});

describe('v2 concurrent run diagnostics', () => {
	it('records canonical nodes with explicit admission and settlement order', () => {
		const result = runTestGraph({ graph: synchronousGraph() });

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'succeeded',
			diagnostics: {
				nodes: [
					{
						node: 'a',
						nodeOrdinal: 0,
						state: 'succeeded',
						admissionSequence: 0,
						settlementSequence: 0,
					},
					{
						node: 'b',
						nodeOrdinal: 1,
						state: 'succeeded',
						admissionSequence: 1,
						settlementSequence: 1,
					},
				],
			},
		});
		if (result instanceof Promise) {
			throw new Error('Expected synchronous diagnostics.');
		}
		expect(result.diagnostics.events).toMatchObject([
			{
				kind: 'node-transition',
				node: 'a',
				state: 'active',
				sequence: 0,
			},
			{
				kind: 'node-transition',
				node: 'b',
				state: 'active',
				sequence: 1,
			},
			{
				kind: 'node-transition',
				node: 'a',
				state: 'succeeded',
				sequence: 2,
			},
			{
				kind: 'node-transition',
				node: 'b',
				state: 'succeeded',
				sequence: 3,
			},
			{ kind: 'run-terminal', outcomeKind: 'succeeded', sequence: 4 },
		]);
		expect(Object.isFrozen(result.diagnostics.nodes)).toBe(true);
		expect(Object.isFrozen(result.diagnostics.events)).toBe(true);
	});

	it('keeps canonical record order while reporting timing-dependent settlement', async () => {
		const gates = {
			a: controlled<ReturnType<typeof success<string>>>(),
			b: controlled<ReturnType<typeof success<string>>>(),
		};
		const graph = compileTestGraph({
			maxConcurrency: 2,
			nodes: ['a', 'b'].map((key) => ({
				key,
				executor: () => gates[key as 'a' | 'b'].promise,
			})),
		});
		const pending = runTestGraph({ graph });
		gates.b.resolve(success('b'));
		await Promise.resolve();
		gates.a.resolve(success('a'));

		const result = await pending;

		expect(result.diagnostics.nodes).toMatchObject([
			{ node: 'a', settlementSequence: 1 },
			{ node: 'b', settlementSequence: 0 },
		]);
		expect(
			result.diagnostics.events
				.filter(
					(event) =>
						event.kind === 'node-transition' &&
						event.state === 'succeeded'
				)
				.map((event) =>
					event.kind === 'node-transition' ? event.node : 'never'
				)
		).toEqual(['b', 'a']);
	});

	it('projects ready and dependency-blocked frontier nodes without authority', () => {
		const graph = compileTestGraph({
			maxConcurrency: 1,
			edges: [{ from: 'later', to: 'child' }],
			nodes: [
				{
					key: 'pause',
					priority: 20,
					executor: () => ({
						...success('pause'),
						pause: { reason: 'review' },
					}),
				},
				{
					key: 'later',
					priority: 10,
					executor: () => success('later'),
				},
				{ key: 'child', executor: () => success('child') },
			],
		});

		const result = runTestGraph({ graph });

		expect(result).toMatchObject({
			kind: 'suspended',
			diagnostics: {
				nodes: [
					{ node: 'pause', state: 'succeeded' },
					{ node: 'later', state: 'pending', readiness: 'ready' },
					{
						node: 'child',
						state: 'pending',
						readiness: 'blocked',
						blockedBy: ['later'],
					},
				],
			},
		});
	});

	it('isolates run traces and keeps earlier snapshots immutable', () => {
		const first = runTestGraph({ graph: synchronousGraph() });
		const second = runTestGraph({ graph: synchronousGraph() });
		if (first instanceof Promise || second instanceof Promise) {
			throw new Error('Expected synchronous trace isolation.');
		}
		expect(first.diagnostics).not.toBe(second.diagnostics);
		expect(first.diagnostics.events).not.toBe(second.diagnostics.events);
		expect(first.diagnostics.events).toEqual(second.diagnostics.events);

		const suspendedGraph = compileTestGraph({
			nodes: [
				{
					key: 'pause',
					executor: () => ({
						...success('pause'),
						pause: { reason: 'stop' },
					}),
				},
			],
		});
		const suspended = runTestGraph({ graph: suspendedGraph });
		if (suspended instanceof Promise || suspended.kind !== 'suspended') {
			throw new Error('Expected synchronous suspension.');
		}
		const snapshotEvents = suspended.suspension.snapshot.events;
		expect(snapshotEvents.at(-1)).toMatchObject({
			kind: 'run-terminal',
			outcomeKind: 'suspended',
		});

		const abandoned = abandon({ suspension: suspended.suspension });

		expect(abandoned).toMatchObject({ kind: 'abandoned' });
		if (abandoned instanceof Promise) {
			throw new Error('Expected synchronous abandonment.');
		}
		const abandonedOutcome = abandoned as Awaited<typeof abandoned>;
		expect(
			abandonedOutcome.diagnostics.events.flatMap((event) =>
				event.kind === 'run-terminal' ? [event.outcomeKind] : []
			)
		).toEqual(['suspended', 'abandoned']);
		expect(suspended.suspension.snapshot.events).toBe(snapshotEvents);
		expect(snapshotEvents).toHaveLength(3);
	});
});
