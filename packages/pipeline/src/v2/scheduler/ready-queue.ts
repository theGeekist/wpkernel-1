/** Mutable run-local min-heap ordered by compiled canonical node ordinal. */
export interface OrdinalReadyQueue {
	readonly heap: string[];
	readonly ordinals: Readonly<Record<string, number>>;
}

const comesBefore = (
	queue: OrdinalReadyQueue,
	left: string,
	right: string
): boolean => queue.ordinals[left]! < queue.ordinals[right]!;

const swap = (heap: string[], left: number, right: number): void => {
	const value = heap[left]!;
	heap[left] = heap[right]!;
	heap[right] = value;
};

const siftUp = (queue: OrdinalReadyQueue, start: number): void => {
	let child = start;
	while (child > 0) {
		const parent = Math.floor((child - 1) / 2);
		if (!comesBefore(queue, queue.heap[child]!, queue.heap[parent]!)) {
			return;
		}
		swap(queue.heap, child, parent);
		child = parent;
	}
};

const siftDown = (queue: OrdinalReadyQueue): void => {
	let parent = 0;
	while (true) {
		const left = parent * 2 + 1;
		if (left >= queue.heap.length) {
			return;
		}
		const right = left + 1;
		const child =
			right < queue.heap.length &&
			comesBefore(queue, queue.heap[right]!, queue.heap[left]!)
				? right
				: left;
		if (!comesBefore(queue, queue.heap[child]!, queue.heap[parent]!)) {
			return;
		}
		swap(queue.heap, parent, child);
		parent = child;
	}
};

/**
 * Creates an empty queue bound to one compiled ordinal table.
 *
 * @param ordinals - Canonical node positions from the compiled graph.
 */
export const createReadyQueue = (
	ordinals: Readonly<Record<string, number>>
): OrdinalReadyQueue => ({ heap: [], ordinals });

/**
 * Inserts one newly ready node in logarithmic time.
 *
 * @param queue - Run-local ready queue.
 * @param node  - Newly ready node key.
 */
export const addReadyNode = (queue: OrdinalReadyQueue, node: string): void => {
	queue.heap.push(node);
	siftUp(queue, queue.heap.length - 1);
};

const removeFirst = (queue: OrdinalReadyQueue): string => {
	const first = queue.heap[0]!;
	const last = queue.heap.pop()!;
	if (queue.heap.length > 0) {
		queue.heap[0] = last;
		siftDown(queue);
	}
	return first;
};

/**
 * Removes the canonical ready prefix selected for one complete admission.
 *
 * @param queue   - Run-local ready queue.
 * @param maximum - Maximum nodes to select for this admission.
 */
export const takeReadyNodes = (
	queue: OrdinalReadyQueue,
	maximum: number
): readonly string[] => {
	const selected: string[] = [];
	const count = Math.min(maximum, queue.heap.length);
	for (let index = 0; index < count; index += 1) {
		selected.push(removeFirst(queue));
	}
	return selected;
};

export const readyNodeCount = (queue: OrdinalReadyQueue): number =>
	queue.heap.length;
