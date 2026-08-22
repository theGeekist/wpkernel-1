import {
	observeParticipant,
	type ObservedParticipant,
} from '../v2/scheduler/maybe-promise.js';

export const settleObserved = <T, TResult>(
	observed: ObservedParticipant<T>,
	onValue: (value: T) => TResult | Promise<TResult>,
	onFailure: (error: unknown) => TResult | Promise<TResult>
): TResult | Promise<TResult> => {
	if (observed.kind === 'synchronous') {
		return onValue(observed.value);
	}
	if (observed.kind === 'failed') {
		return onFailure(observed.error);
	}
	return observed.promise.then(onValue, onFailure);
};

export const chainObserved = <T, TResult>(
	value: T | PromiseLike<T>,
	onValue: (value: T) => TResult | Promise<TResult>
): TResult | Promise<TResult> =>
	settleObserved(observeParticipant<T>(value), onValue, (error) => {
		throw error;
	});

export const invokeObserved = <T>(
	participant: (...args: never[]) => unknown,
	args: readonly unknown[]
): ObservedParticipant<T> => {
	try {
		return observeParticipant<T>(
			Reflect.apply(participant, undefined, args)
		);
	} catch (error) {
		return { kind: 'failed', error };
	}
};
