export type OwnPropertyRead =
	| { readonly kind: 'absent' }
	| { readonly kind: 'accessor' }
	| { readonly kind: 'data'; readonly value: unknown };

/**
 * Inspect an option property without invoking an accessor supplied by a caller.
 *
 * Authoring inputs are declarative records. Reading an accessor while validating
 * one would make validation observable and allow code to run before rejection.
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
 */
export function readDenseArrayEntries(
	value: unknown,
	path: string,
	fail: (path: string, message: string) => Error
): unknown[] {
	if (!Array.isArray(value)) {
		throw fail(path, 'Expected an array.');
	}

	const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
	if (
		!lengthDescriptor ||
		!Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ||
		typeof lengthDescriptor.value !== 'number'
	) {
		throw fail(path, 'Array length must be an own data property.');
	}

	const length = lengthDescriptor.value;
	const descriptors: PropertyDescriptor[] = [];
	const allowedKeys = new Set<string>(['length']);

	for (let index = 0; index < length; index += 1) {
		const key = String(index);
		allowedKeys.add(key);
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

	for (const key of Reflect.ownKeys(value)) {
		if (typeof key === 'symbol' || !allowedKeys.has(key)) {
			throw fail(
				path,
				'Arrays with custom properties are not supported.'
			);
		}
	}

	return descriptors.map((descriptor) => descriptor.value);
}
