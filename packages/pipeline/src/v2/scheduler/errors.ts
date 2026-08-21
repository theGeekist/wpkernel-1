/** A scheduler boundary or node-result contract failure. */
export class GraphSchedulerError extends Error {
	readonly code: 'invalid-input' | 'invalid-graph' | 'invalid-node-result';

	constructor(options: {
		readonly code: GraphSchedulerError['code'];
		readonly message: string;
		readonly cause?: unknown;
	}) {
		super(options.message, { cause: options.cause });
		this.name = 'GraphSchedulerError';
		this.code = options.code;
	}
}
