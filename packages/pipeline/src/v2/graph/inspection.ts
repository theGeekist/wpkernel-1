export type InspectionResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly reason: string };

export interface InspectedProperty {
	readonly key: string;
	readonly value: unknown;
}

const inspectedDataProperties = (
	value: object,
	options: { readonly array: boolean }
): InspectionResult<readonly InspectedProperty[]> => {
	const keys = Reflect.ownKeys(value);
	const properties: InspectedProperty[] = [];
	for (const key of keys) {
		if (typeof key === 'symbol') {
			return {
				ok: false,
				reason: 'Symbol properties are not permitted.',
			};
		}
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !('value' in descriptor)) {
			return { ok: false, reason: 'Accessors are not permitted.' };
		}
		if (options.array && key === 'length') {
			continue;
		}
		if (!descriptor.enumerable) {
			return {
				ok: false,
				reason: 'Non-enumerable data properties are not permitted.',
			};
		}
		properties.push({ key, value: descriptor.value });
	}
	return { ok: true, value: properties };
};

export const inspectRecord = (
	value: unknown
): InspectionResult<readonly InspectedProperty[]> => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return { ok: false, reason: 'Expected a record.' };
	}
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) {
		return { ok: false, reason: 'Expected a plain record.' };
	}
	return inspectedDataProperties(value, { array: false });
};

const isArrayIndex = (key: string, length: number): boolean => {
	const index = Number(key);
	return (
		Number.isInteger(index) &&
		index >= 0 &&
		index < length &&
		String(index) === key
	);
};

export const inspectDenseArray = (
	value: unknown
): InspectionResult<readonly unknown[]> => {
	if (!Array.isArray(value)) {
		return { ok: false, reason: 'Expected an array.' };
	}
	if (Object.getPrototypeOf(value) !== Array.prototype) {
		return {
			ok: false,
			reason: 'Arrays must have exactly Array.prototype.',
		};
	}
	const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
	const length = (lengthDescriptor as PropertyDescriptor & { value: number })
		.value;
	const inspected = inspectedDataProperties(value, { array: true });
	if (!inspected.ok) {
		return inspected;
	}
	if (
		inspected.value.length !== length ||
		inspected.value.some(({ key }) => !isArrayIndex(key, length))
	) {
		return {
			ok: false,
			reason: 'Arrays must be dense and contain only index properties.',
		};
	}
	const byIndex = new Map(
		inspected.value.map(({ key, value: item }) => [Number(key), item])
	);
	return {
		ok: true,
		value: Object.freeze(
			Array.from({ length }, (_unused, index) => byIndex.get(index))
		),
	};
};
