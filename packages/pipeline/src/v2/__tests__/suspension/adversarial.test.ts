import fc from 'fast-check';
import { settleGraphEffects } from '../../effects/outcome.js';
import {
	abandon,
	createSuspensionError,
	resume,
} from '../../suspension/index.js';
import {
	compileTestGraph,
	runTestGraph,
	success,
} from '../../scheduler/scheduler.test-support.js';

const phaseSuccess = <T>(value: T) => ({
	kind: 'success' as const,
	value,
});

const rejectedSuspension = (operation: () => unknown) => {
	try {
		operation();
	} catch (error) {
		return error;
	}
	throw new Error('Expected suspension rejection.');
};

const suspendedRun = (options: {
	readonly compensate?: () => unknown;
	readonly continuation?: () => unknown;
}) => {
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
					effects: [{ participant: 'write', payload: 'effect' }],
				}),
			},
			{
				key: 'continue',
				executor: options.continuation ?? (() => success('continue')),
			},
		],
	});
	const result = runTestGraph({
		graph,
		participants: {
			write: {
				prepare: () => phaseSuccess('prepared'),
				commit: () => phaseSuccess('receipt'),
				compensate:
					options.compensate ?? (() => phaseSuccess(undefined)),
			},
		},
	});
	if (result instanceof Promise || result.kind !== 'suspended') {
		throw new Error('Expected a synchronous suspension fixture.');
	}
	return result.suspension;
};

describe('v2 Suspension adversarial authority', () => {
	it('creates frozen tagged native errors without a custom constructor', () => {
		const cause = { reason: 'test' };
		const error = createSuspensionError({
			code: 'invalid-suspension',
			message: 'invalid',
			cause,
		});

		expect(Object.getPrototypeOf(error)).toBe(Error.prototype);
		expect(Object.isFrozen(error)).toBe(true);
		expect(error).toMatchObject({
			name: 'SuspensionError',
			code: 'invalid-suspension',
			message: 'invalid',
			cause,
		});
	});

	it('rejects direct effect settlement of an uncaptured clean pause', () => {
		expect(() =>
			settleGraphEffects({
				runtime: {} as never,
				graph: { kind: 'pause-requested' } as never,
				signal: new AbortController().signal,
			})
		).toThrow('must be captured as a Suspension');
	});

	it('exposes no constructor, prototype token or state-bearing callable', () => {
		const suspension = suspendedRun({});

		expect(Object.getPrototypeOf(suspension)).toBeNull();
		expect(Object.getOwnPropertySymbols(suspension)).toEqual([]);
		expect(Reflect.ownKeys(suspension)).toEqual(['pause', 'snapshot']);
		expect(Reflect.get(suspension, 'constructor')).toBeUndefined();
		expect(
			Reflect.ownKeys(suspension).map(
				(key) => typeof Reflect.get(suspension, key)
			)
		).toEqual(['object', 'object']);

		const reflectedForgery = Object.freeze(
			Object.assign(Object.create(null) as object, {
				pause: suspension.pause,
				snapshot: suspension.snapshot,
			})
		);
		expect(
			rejectedSuspension(() =>
				resume({ suspension: reflectedForgery as never })
			)
		).toMatchObject({
			name: 'SuspensionError',
			code: 'invalid-suspension',
		});
		expect(abandon({ suspension })).toMatchObject({ kind: 'abandoned' });
	});

	it('rejects spread, deserialised, prototype and proxy forgeries', () => {
		const suspension = suspendedRun({});
		const candidates = [
			{ ...suspension },
			JSON.parse(JSON.stringify(suspension)),
			Object.create(Object.getPrototypeOf(suspension)),
			new Proxy(suspension, {}),
		];

		for (const candidate of candidates) {
			expect(
				rejectedSuspension(() =>
					resume({ suspension: candidate as never })
				)
			).toMatchObject({
				name: 'SuspensionError',
				code: 'invalid-suspension',
			});
			expect(
				rejectedSuspension(() =>
					abandon({ suspension: candidate as never })
				)
			).toMatchObject({
				name: 'SuspensionError',
				code: 'invalid-suspension',
			});
		}

		expect(abandon({ suspension })).toMatchObject({ kind: 'abandoned' });
	});

	it('rejects primitive, null and callable suspension tokens', () => {
		for (const candidate of ['token', null, () => undefined]) {
			for (const operation of [resume, abandon]) {
				expect(
					rejectedSuspension(() =>
						operation({ suspension: candidate as never })
					)
				).toMatchObject({
					name: 'SuspensionError',
					code: 'invalid-suspension',
				});
			}
		}
	});

	it('retains only the consumed operation needed for repeated-use errors', () => {
		const suspension = suspendedRun({});

		expect(abandon({ suspension })).toMatchObject({ kind: 'abandoned' });
		expect(rejectedSuspension(() => resume({ suspension }))).toMatchObject({
			name: 'SuspensionError',
			code: 'already-consumed',
			message: 'Suspension has already been consumed by abandon.',
		});
	});

	it('adopts a hostile continuation thenable exactly once', async () => {
		let reads = 0;
		let calls = 0;
		const thenable = Object.defineProperty({}, 'then', {
			get() {
				reads += 1;
				return (resolve: (value: unknown) => void) => {
					calls += 1;
					resolve(success('continued'));
				};
			},
		});
		const suspension = suspendedRun({ continuation: () => thenable });

		const result = resume({ suspension });

		expect(result).toBeInstanceOf(Promise);
		expect(reads).toBe(1);
		await expect(result).resolves.toMatchObject({ kind: 'succeeded' });
		expect({ reads, calls }).toEqual({ reads: 1, calls: 1 });
	});

	it('adopts a hostile abandonment thenable and uses first settlement', async () => {
		let reads = 0;
		let calls = 0;
		const later = new Error('later');
		const thenable = Object.defineProperty({}, 'then', {
			get() {
				reads += 1;
				return (
					resolve: (value: unknown) => void,
					reject: (error: unknown) => void
				) => {
					calls += 1;
					resolve(phaseSuccess(undefined));
					reject(later);
				};
			},
		});
		const suspension = suspendedRun({ compensate: () => thenable });

		const result = abandon({ suspension });

		expect(result).toBeInstanceOf(Promise);
		expect(reads).toBe(1);
		await expect(result).resolves.toMatchObject({
			kind: 'abandoned',
			cleanupFailures: [],
		});
		expect({ reads, calls }).toEqual({ reads: 1, calls: 1 });
	});

	it('retains a throwing then getter as synchronous cleanup failure', () => {
		const original = new Error('getter');
		const hostile = Object.defineProperty({}, 'then', {
			get() {
				throw original;
			},
		});
		const suspension = suspendedRun({ compensate: () => hostile });

		const result = abandon({ suspension });

		expect(result).not.toBeInstanceOf(Promise);
		expect(result).toMatchObject({
			kind: 'abandoned',
			cleanupFailures: [{ kind: 'thrown', error: original }],
		});
	});

	it('preserves single-use state invariants for arbitrary repeated operations', () => {
		fc.assert(
			fc.property(
				fc.array(fc.constantFrom('resume', 'abandon'), {
					minLength: 1,
					maxLength: 20,
				}),
				(operations) => {
					let continuationCalls = 0;
					let cleanupCalls = 0;
					const suspension = suspendedRun({
						continuation: () => {
							continuationCalls += 1;
							return success('continued');
						},
						compensate: () => {
							cleanupCalls += 1;
							return phaseSuccess(undefined);
						},
					});
					for (const [index, operation] of operations.entries()) {
						const consume = () =>
							operation === 'resume'
								? resume({ suspension })
								: abandon({ suspension });
						if (index === 0) {
							consume();
						} else {
							expect(consume).toThrow('already been consumed');
						}
					}
					expect(continuationCalls).toBe(
						operations[0] === 'resume' ? 1 : 0
					);
					expect(cleanupCalls).toBe(
						operations[0] === 'abandon' ? 1 : 0
					);
				}
			),
			{ seed: 20260826, numRuns: 100 }
		);
	});
});
