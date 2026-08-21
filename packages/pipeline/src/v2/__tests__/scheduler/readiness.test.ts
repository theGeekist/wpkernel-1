import {
	compileTestGraph,
	controlled,
	flushMicrotasks,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

describe('v2 graph scheduler readiness', () => {
	it('executes an entirely synchronous fan-out and fan-in synchronously', () => {
		const calls: string[] = [];
		const input = { source: { mutable: ['before'] } };
		const graph = compileTestGraph({
			inputKeys: ['source'],
			maxConcurrency: 2,
			edges: [
				{ from: 'left', to: 'join' },
				{ from: 'right', to: 'join' },
			],
			outputs: { result: 'join' },
			nodes: [
				{
					key: 'left',
					externalInputs: ['source'],
					priority: 10,
					executor: ({ input: invocationInput }) => {
						calls.push('left');
						expect(Object.isFrozen(invocationInput)).toBe(true);
						expect(Object.isFrozen(invocationInput.external)).toBe(
							true
						);
						expect(
							Object.isFrozen(invocationInput.external.source)
						).toBe(true);
						return success({ side: 'left' });
					},
				},
				{
					key: 'right',
					executor: () => {
						calls.push('right');
						return success({ side: 'right' });
					},
				},
				{
					key: 'join',
					executor: ({ input: invocationInput }) => {
						calls.push('join');
						expect(invocationInput.dependencies).toEqual({
							left: { side: 'left' },
							right: { side: 'right' },
						});
						expect(
							Object.isFrozen(invocationInput.dependencies.left)
						).toBe(true);
						return success({ joined: true });
					},
				},
			],
		});

		const result = runTestGraph({ graph, inputs: input });

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'succeeded',
			outputs: { result: { joined: true } },
		});
		expect(calls).toEqual(['left', 'right', 'join']);
		expect(Object.isFrozen(result)).toBe(true);
	});

	it('admits a newly ready dependant without waiting for an unrelated branch', async () => {
		const fast = controlled<ReturnType<typeof success<string>>>();
		const slow = controlled<ReturnType<typeof success<string>>>();
		const calls: string[] = [];
		const graph = compileTestGraph({
			maxConcurrency: 2,
			edges: [{ from: 'fast', to: 'child' }],
			outputs: { child: 'child', slow: 'slow' },
			nodes: [
				{
					key: 'fast',
					executor: () => {
						calls.push('fast');
						return fast.promise;
					},
				},
				{
					key: 'slow',
					executor: () => {
						calls.push('slow');
						return slow.promise;
					},
				},
				{
					key: 'child',
					executor: ({ input }) => {
						calls.push('child');
						expect(input.dependencies.fast).toBe('fast');
						return success('child');
					},
				},
			],
		});

		const result = runTestGraph({ graph });
		expect(result).toBeInstanceOf(Promise);
		expect(calls).toEqual(['fast', 'slow']);

		fast.resolve(success('fast'));
		await flushMicrotasks();
		expect(calls).toEqual(['fast', 'slow', 'child']);

		slow.resolve(success('slow'));
		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
	});

	it('uses canonical ready order while respecting a concurrency bound', async () => {
		const gates = [
			controlled<ReturnType<typeof success<number>>>(),
			controlled<ReturnType<typeof success<number>>>(),
			controlled<ReturnType<typeof success<number>>>(),
			controlled<ReturnType<typeof success<number>>>(),
		];
		const calls: string[] = [];
		let active = 0;
		let peak = 0;
		const graph = compileTestGraph({
			maxConcurrency: 2,
			outputs: { result: 'd' },
			nodes: ['a', 'b', 'c', 'd'].map((key, index) => ({
				key,
				executor: () => {
					calls.push(key);
					active += 1;
					peak = Math.max(peak, active);
					return gates[index]!.promise.then((value) => {
						active -= 1;
						return value;
					});
				},
			})),
		});

		const result = runTestGraph({ graph });
		expect(calls).toEqual(['a', 'b']);

		gates[1]!.resolve(success(2));
		await flushMicrotasks();
		expect(calls).toEqual(['a', 'b', 'c']);
		gates[0]!.resolve(success(1));
		await flushMicrotasks();
		expect(calls).toEqual(['a', 'b', 'c', 'd']);
		gates[2]!.resolve(success(3));
		gates[3]!.resolve(success(4));

		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
		expect(peak).toBe(2);
	});

	it('does not admit a join until every predecessor succeeds', async () => {
		const left = controlled<ReturnType<typeof success<string>>>();
		const right = controlled<ReturnType<typeof success<string>>>();
		const join = jest.fn(() => success('joined'));
		const graph = compileTestGraph({
			maxConcurrency: 'unbounded',
			edges: [
				{ from: 'left', to: 'join' },
				{ from: 'right', to: 'join' },
			],
			outputs: { result: 'join' },
			nodes: [
				{ key: 'left', executor: () => left.promise },
				{ key: 'right', executor: () => right.promise },
				{ key: 'join', executor: join },
			],
		});
		const result = runTestGraph({ graph });

		left.resolve(success('left'));
		await flushMicrotasks();
		expect(join).not.toHaveBeenCalled();
		right.resolve(success('right'));

		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
		expect(join).toHaveBeenCalledTimes(1);
	});
});
