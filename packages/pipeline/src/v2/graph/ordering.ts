/**
 * Compares strings by raw UTF-16 code units, with shorter prefixes first.
 *
 * @param left  - First key.
 * @param right - Second key.
 */
export const rawKeyCompare = (left: string, right: string): number => {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		const difference = left.charCodeAt(index) - right.charCodeAt(index);
		if (difference !== 0) {
			return difference;
		}
	}
	return left.length - right.length;
};

export const sortedKeys = (keys: Iterable<string>): readonly string[] =>
	[...keys].sort(rawKeyCompare);

export const nullRecord = <T>(): Record<string, T> =>
	Object.create(null) as Record<string, T>;

export const frozenSortedRecord = <T>(
	entries: Iterable<readonly [string, T]>
): Readonly<Record<string, T>> => {
	const record = nullRecord<T>();
	for (const [key, value] of [...entries].sort(([left], [right]) =>
		rawKeyCompare(left, right)
	)) {
		record[key] = value;
	}
	return Object.freeze(record);
};
