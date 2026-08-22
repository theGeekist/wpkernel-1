import type { GraphValue } from './types.js';
import { inspectDenseArray, inspectRecord } from './inspection.js';
import { nullRecord } from './ordering.js';

/** Result of taking scheduler ownership of a graph value. */
export type CopyGraphValueResult =
	| { readonly ok: true; readonly value: GraphValue }
	| { readonly ok: false; readonly reason: string };

type MutableGraphContainer = GraphValue[] | Record<string, GraphValue>;

interface ChildValue {
	readonly key: string | number;
	readonly value: unknown;
}

interface Assignment {
	readonly container: MutableGraphContainer;
	readonly key: string | number;
}

interface CopyFrame {
	readonly children: readonly ChildValue[];
	readonly copy: MutableGraphContainer;
	readonly assignment?: Assignment;
	nextChild: number;
}

type FrameResult =
	| { readonly ok: true; readonly frame: CopyFrame }
	| { readonly ok: false; readonly reason: string };

const isScalar = (value: unknown): value is GraphValue =>
	value === null ||
	value === undefined ||
	typeof value === 'boolean' ||
	typeof value === 'number' ||
	typeof value === 'bigint' ||
	typeof value === 'string';

const arrayFrame = (
	value: readonly unknown[],
	assignment?: Assignment
): FrameResult => {
	const inspected = inspectDenseArray(value);
	if (!inspected.ok) {
		return {
			ok: false,
			reason: `Invalid graph array: ${inspected.reason}`,
		};
	}
	return {
		ok: true,
		frame: {
			children: inspected.value.map((item, key) => ({
				key,
				value: item,
			})),
			copy: [],
			assignment,
			nextChild: 0,
		},
	};
};

const recordFrame = (value: object, assignment?: Assignment): FrameResult => {
	const inspected = inspectRecord(value);
	if (!inspected.ok) {
		return {
			ok: false,
			reason: `Invalid graph record: ${inspected.reason}`,
		};
	}
	return {
		ok: true,
		frame: {
			children: inspected.value.map(({ key, value: item }) => ({
				key,
				value: item,
			})),
			copy: nullRecord<GraphValue>(),
			assignment,
			nextChild: 0,
		},
	};
};

const containerFrame = (value: object, assignment?: Assignment): FrameResult =>
	Array.isArray(value)
		? arrayFrame(value, assignment)
		: recordFrame(value, assignment);

const assignValue = (assignment: Assignment, value: GraphValue): void => {
	if (Array.isArray(assignment.container)) {
		assignment.container[assignment.key as number] = value;
		return;
	}
	assignment.container[assignment.key as string] = value;
};

const invalidTree = (): CopyGraphValueResult => ({
	ok: false,
	reason: 'Graph values must be acyclic scalar, array or plain-record trees.',
});

const copyNextChild = (options: {
	readonly frame: CopyFrame;
	readonly frames: CopyFrame[];
	readonly seen: Set<object>;
}): CopyGraphValueResult | undefined => {
	const child = options.frame.children[options.frame.nextChild]!;
	options.frame.nextChild += 1;
	const assignment = { container: options.frame.copy, key: child.key };
	if (isScalar(child.value)) {
		assignValue(assignment, child.value);
		return undefined;
	}
	if (typeof child.value !== 'object' || options.seen.has(child.value)) {
		return invalidTree();
	}
	options.seen.add(child.value);
	const nested = containerFrame(child.value, assignment);
	if (!nested.ok) {
		return nested;
	}
	options.frames.push(nested.frame);
	return undefined;
};

const copyContainer = (root: object): CopyGraphValueResult => {
	const seen = new Set<object>([root]);
	const rootFrame = containerFrame(root);
	if (!rootFrame.ok) {
		return rootFrame;
	}
	const frames: CopyFrame[] = [rootFrame.frame];
	let copiedRoot: GraphValue = null;
	while (frames.length > 0) {
		const frame = frames.at(-1)!;
		if (frame.nextChild < frame.children.length) {
			const failure = copyNextChild({ frame, frames, seen });
			if (failure) {
				return failure;
			}
			continue;
		}
		frames.pop();
		const frozen = Object.freeze(frame.copy) as GraphValue;
		if (frame.assignment) {
			assignValue(frame.assignment, frozen);
		} else {
			copiedRoot = frozen;
		}
	}
	return { ok: true, value: copiedRoot };
};

/**
 * Deep-copies and freezes a valid graph value without retaining caller aliases.
 *
 * @param options       - Value supplied at a graph ownership boundary.
 * @param options.value - Untrusted candidate graph value.
 */
export const copyGraphValue = (options: {
	readonly value: unknown;
}): CopyGraphValueResult => {
	try {
		if (isScalar(options.value)) {
			return { ok: true, value: options.value };
		}
		if (typeof options.value !== 'object') {
			return invalidTree();
		}
		return copyContainer(options.value);
	} catch {
		return {
			ok: false,
			reason: 'Graph values must be inspectable plain data.',
		};
	}
};
