import { inspectRecord } from '../graph/inspection.js';
import { GraphSchedulerError } from '../scheduler/errors.js';

export type OwnedEffectPhaseResult =
	| { readonly kind: 'success'; readonly value: unknown }
	| { readonly kind: 'declared'; readonly error: unknown }
	| { readonly kind: 'contract'; readonly error: GraphSchedulerError };

const contractFailure = (options: {
	readonly participant: string;
	readonly phase: string;
	readonly message: string;
	readonly cause?: unknown;
}): OwnedEffectPhaseResult => ({
	kind: 'contract',
	error: new GraphSchedulerError({
		code: 'invalid-effect-result',
		message: `Effect participant "${options.participant}" ${options.phase} phase ${options.message}`,
		...(options.cause === undefined ? {} : { cause: options.cause }),
	}),
});

export const ownEffectPhaseResult = (options: {
	readonly value: unknown;
	readonly participant: string;
	readonly phase: string;
}): OwnedEffectPhaseResult => {
	let fields: ReadonlyMap<string, unknown>;
	try {
		const inspected = inspectRecord(options.value);
		if (!inspected.ok) {
			return contractFailure({
				...options,
				message: `returned an invalid result: ${inspected.reason}`,
			});
		}
		fields = new Map(
			inspected.value.map(({ key, value }) => [key, value] as const)
		);
	} catch (cause) {
		return contractFailure({
			...options,
			message: 'result inspection failed.',
			cause,
		});
	}
	const kind = fields.get('kind');
	if (kind === 'success' && fields.has('value')) {
		return { kind, value: fields.get('value') };
	}
	if (kind === 'failure' && fields.has('error')) {
		return { kind: 'declared', error: fields.get('error') };
	}
	return contractFailure({
		...options,
		message: 'must return a complete success or failure variant.',
	});
};
