/**
 * Invokes consumer-owned authority without binding an interpreter object as `this`.
 * @param          participant
 * @param {...any} args
 */
export function invokePublic<TArgs extends readonly unknown[], TResult>(
	participant: (...args: TArgs) => TResult,
	...args: TArgs
): TResult {
	return Reflect.apply(participant, undefined, args) as TResult;
}
