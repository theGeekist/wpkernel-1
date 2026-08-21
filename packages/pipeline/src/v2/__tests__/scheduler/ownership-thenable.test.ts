import { ownGraphInputs } from '../../scheduler/ownership.js';
import {
	compileTestGraph,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';
import type { TestNode } from '../../scheduler/scheduler.test-support.js';

describe('v2 scheduler ownership and exact thenable settlement', () => {
	it('reads participant then once and invokes a callable then asynchronously', async () => {
		let reads = 0;
		let calls = 0;
		const thenable = Object.defineProperty({}, 'then', {
			configurable: true,
			get() {
				reads += 1;
				return (resolve: (value: unknown) => void) => {
					calls += 1;
					resolve(success('done'));
				};
			},
		});
		const graph = compileTestGraph({
			outputs: { result: 'a' },
			nodes: [{ key: 'a', executor: () => thenable }],
		});

		const result = runTestGraph({ graph });

		expect(result).toBeInstanceOf(Promise);
		expect(reads).toBe(1);
		expect(calls).toBe(0);
		await expect(result).resolves.toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'done' },
		});
		expect(reads).toBe(1);
		expect(calls).toBe(1);
	});

	it('invokes a captured then through trusted function application', async () => {
		let calls = 0;
		const then = Object.defineProperty(
			(resolve: (value: unknown) => void) => {
				calls += 1;
				resolve(success('trusted'));
			},
			'call',
			{
				get() {
					throw new Error('poisoned call');
				},
			}
		);
		const graph = compileTestGraph({
			outputs: { result: 'a' },
			nodes: [{ key: 'a', executor: () => ({ then }) }],
		});

		await expect(runTestGraph({ graph })).resolves.toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'trusted' },
		});
		expect(calls).toBe(1);
	});

	it('recursively adopts nested thenable settlement', async () => {
		let outerCalls = 0;
		let innerCalls = 0;
		const inner = {
			then(resolve: (value: unknown) => void) {
				innerCalls += 1;
				resolve(success('nested'));
			},
		};
		const outer = {
			then(resolve: (value: unknown) => void) {
				outerCalls += 1;
				resolve(inner);
			},
		};
		const graph = compileTestGraph({
			outputs: { result: 'a' },
			nodes: [{ key: 'a', executor: () => outer }],
		});

		await expect(runTestGraph({ graph })).resolves.toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'nested' },
		});
		expect(outerCalls).toBe(1);
		expect(innerCalls).toBe(1);
	});

	it('keeps a non-callable then synchronous', () => {
		const graph = compileTestGraph({
			outputs: { result: 'a' },
			nodes: [
				{
					key: 'a',
					executor: () => ({ ...success('done'), then: 42 }),
				},
			],
		});

		const result = runTestGraph({ graph });

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({ kind: 'succeeded' });
	});

	it('retains a throwing then getter as a synchronous original failure', () => {
		const original = new Error('getter');
		const hostile = Object.defineProperty({}, 'then', {
			get() {
				throw original;
			},
		});
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor: () => hostile }],
		});

		const result = runTestGraph({ graph });

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'thrown', error: original },
		});
	});

	it('contains a throwing then call in the asynchronous failed outcome', async () => {
		const original = new Error('call');
		const thenable = {
			then() {
				throw original;
			},
		};
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor: () => thenable }],
		});

		const result = runTestGraph({ graph });

		await expect(result).resolves.toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'thrown', error: original },
		});
	});

	it('uses the first thenable settlement', async () => {
		const later = new Error('later');
		const thenable = {
			then(
				resolve: (value: unknown) => void,
				reject: (error: unknown) => void
			) {
				resolve(success('first'));
				reject(later);
				resolve(success('third'));
			},
		};
		const graph = compileTestGraph({
			outputs: { result: 'a' },
			nodes: [{ key: 'a', executor: () => thenable }],
		});

		await expect(runTestGraph({ graph })).resolves.toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'first' },
		});
	});

	it('copies graph input before execution and node output before sharing', () => {
		const originalInput = { item: { values: ['before'] } };
		const returned = { values: ['owned'] };
		const graph = compileTestGraph({
			inputKeys: ['item'],
			outputs: { result: 'a' },
			nodes: [
				{
					key: 'a',
					externalInputs: ['item'],
					executor: ({ input }) => {
						originalInput.item.values[0] = 'mutated';
						expect(input.external.item).toEqual({
							values: ['before'],
						});
						return success(returned);
					},
				},
			],
		});

		const result = runTestGraph({ graph, inputs: originalInput });
		returned.values[0] = 'after';

		expect(result).toMatchObject({
			kind: 'succeeded',
			outputs: { result: { values: ['owned'] } },
		});
		if (result instanceof Promise || result.kind !== 'succeeded') {
			throw new Error('Expected synchronous success.');
		}
		expect(Object.isFrozen(result.outputs.result)).toBe(true);
	});

	it('shares only immutable scheduler-owned graph input between siblings', () => {
		const values: unknown[] = [];
		const sibling = (key: string): TestNode => ({
			key,
			externalInputs: ['shared'],
			executor: ({ input }) => {
				values.push(input.external.shared);
				return success(key);
			},
		});
		const graph = compileTestGraph({
			inputKeys: ['shared'],
			nodes: [sibling('a'), sibling('b')],
		});

		runTestGraph({ graph, inputs: { shared: { nested: ['x'] } } });

		expect(values[0]).toBe(values[1]);
		expect(Object.isFrozen(values[0])).toBe(true);
		expect(Object.isFrozen((values[0] as { nested: unknown }).nested)).toBe(
			true
		);
	});

	it('does not evaluate hostile graph-value accessors', () => {
		let reads = 0;
		const output = Object.defineProperty({}, 'value', {
			enumerable: true,
			get() {
				reads += 1;
				return 'secret';
			},
		});
		const graph = compileTestGraph({
			nodes: [{ key: 'a', executor: () => success(output as never) }],
		});

		const result = runTestGraph({ graph });

		expect(result).toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'contract' },
		});
		expect(reads).toBe(0);
	});

	it('rejects invalid or inexact admitted input synchronously', () => {
		const graph = compileTestGraph({
			inputKeys: ['required'],
			nodes: [{ key: 'a', executor: () => success('a') }],
		});
		const accessor = Object.defineProperty({}, 'required', {
			enumerable: true,
			get: () => 'no',
		});

		expect(() =>
			runTestGraph({ graph, inputs: accessor as never })
		).toThrow(
			expect.objectContaining({
				name: 'GraphSchedulerError',
				code: 'invalid-input',
			})
		);
		expect(() =>
			runTestGraph({ graph, inputs: { required: 'yes', extra: 'no' } })
		).toThrow('exactly cover');
	});

	it('validates a wide exact input record without repeated membership scans', () => {
		const count = 16_384;
		const inputKeys = Array.from(
			{ length: count },
			(_, index) => `input-${index}`
		);
		const inputs = Object.fromEntries(
			inputKeys.map((key, index) => [key, index])
		);

		const owned = ownGraphInputs({ value: inputs, inputKeys });

		expect(Object.keys(owned)).toHaveLength(count);
		expect(owned[inputKeys[0]!]).toBe(0);
		expect(owned[inputKeys[count - 1]!]).toBe(count - 1);
	});

	it('retains copied effect requests as deterministic pending handoff', () => {
		const payload = { mutable: ['before'] };
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'a',
					effectKeys: ['write'],
					executor: () => ({
						kind: 'success' as const,
						output: 'done',
						effects: [{ participant: 'write', payload }],
					}),
				},
			],
		});

		const result = runTestGraph({ graph });
		payload.mutable[0] = 'after';

		expect(result).toMatchObject({
			kind: 'succeeded',
			pendingEffects: [
				{
					node: 'a',
					nodeOrdinal: 0,
					effectOrdinal: 0,
					request: {
						participant: 'write',
						payload: { mutable: ['before'] },
					},
				},
			],
		});
		if (result instanceof Promise) {
			throw new Error('Expected synchronous result.');
		}
		expect(Object.isFrozen(result.pendingEffects[0]!.request.payload)).toBe(
			true
		);
	});

	it('fails a node that requests an undeclared effect participant', () => {
		const graph = compileTestGraph({
			effectKeys: ['write'],
			nodes: [
				{
					key: 'a',
					executor: () => ({
						kind: 'success' as const,
						output: 'done',
						effects: [{ participant: 'write', payload: 'x' }],
					}),
				},
			],
		});

		expect(
			runTestGraph({
				graph,
				participants: {
					write: {
						prepare: () => ({ kind: 'success', value: undefined }),
						commit: () => ({ kind: 'success', value: undefined }),
						compensate: () => ({
							kind: 'success',
							value: undefined,
						}),
					},
				},
			})
		).toMatchObject({
			kind: 'failed',
			primaryFailure: { kind: 'contract' },
		});
	});
});
