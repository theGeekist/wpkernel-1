export type OwnPropertyRead =
	| { readonly kind: 'absent' }
	| { readonly kind: 'accessor' }
	| { readonly kind: 'data'; readonly value: unknown };

type PropertyReadFailure = (path: string, message: string) => Error;

/**
 * Inspect an option property without invoking an accessor supplied by a caller.
 *
 * Authoring inputs are declarative records. Reading an accessor while validating
 * one would make validation observable and allow code to run before rejection.
 *
 * @param value - Record whose own property descriptor should be inspected.
 * @param key   - Property name to inspect.
 * @returns A descriptor-safe classification of the own property.
 */
export function readOwnProperty(value: object, key: string): OwnPropertyRead {
	const descriptor = Object.getOwnPropertyDescriptor(value, key);
	if (descriptor === undefined) {
		return { kind: 'absent' };
	}
	if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
		return { kind: 'accessor' };
	}
	return { kind: 'data', value: descriptor.value };
}

/**
 * Read a JSON-style array without invoking caller-controlled array methods or
 * accessors. Dense, enumerable data entries are required deliberately: the
 * authoring layer must not silently skip sparse entries as Array#map would.
 *
 * @param value - Candidate array supplied to the authoring layer.
 * @param path  - Diagnostic path for the candidate array.
 * @param fail  - Error factory for deterministic validation failures.
 * @returns The array's data-property values in index order.
 */
export function readDenseArrayEntries(
	value: unknown,
	path: string,
	fail: PropertyReadFailure
): unknown[] {
	if (!Array.isArray(value)) {
		throw fail(path, 'Expected an array.');
	}

	const length = readArrayLength(value, path, fail);
	const descriptors = readArrayEntryDescriptors(value, length, path, fail);
	assertNoCustomArrayProperties(value, length, path, fail);

	return descriptors.map((descriptor) => descriptor.value);
}

function readArrayLength(
	value: unknown[],
	path: string,
	fail: PropertyReadFailure
): number {
	const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
	if (
		!lengthDescriptor ||
		!Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ||
		typeof lengthDescriptor.value !== 'number'
	) {
		throw fail(path, 'Array length must be an own data property.');
	}
	return lengthDescriptor.value;
}

function readArrayEntryDescriptors(
	value: unknown[],
	length: number,
	path: string,
	fail: PropertyReadFailure
): PropertyDescriptor[] {
	const descriptors: PropertyDescriptor[] = [];

	for (let index = 0; index < length; index += 1) {
		const key = String(index);
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (
			!descriptor ||
			!descriptor.enumerable ||
			!Object.prototype.hasOwnProperty.call(descriptor, 'value')
		) {
			throw fail(
				`${path}[${index}]`,
				'Sparse arrays and accessor entries are not supported.'
			);
		}
		descriptors.push(descriptor);
	}
	return descriptors;
}

function assertNoCustomArrayProperties(
	value: unknown[],
	length: number,
	path: string,
	fail: PropertyReadFailure
): void {
	const allowedKeys = new Set<string>(['length']);
	for (let index = 0; index < length; index += 1) {
		allowedKeys.add(String(index));
	}
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key === 'symbol' || !allowedKeys.has(key)) {
			throw fail(
				path,
				'Arrays with custom properties are not supported.'
			);
		}
	}
}
