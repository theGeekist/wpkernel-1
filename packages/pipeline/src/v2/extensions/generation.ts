import { compileGraphWithContributions } from '../graph/contributions.js';
import { inspectDenseArray, inspectRecord } from '../graph/inspection.js';
import { sortedKeys } from '../graph/ordering.js';
import type {
	GraphValue,
	RegisteredGraphContribution,
} from '../graph/types.js';
import { copyGraphValue } from '../graph/values.js';
import { observeParticipant } from '../scheduler/maybe-promise.js';
import {
	ownGraphContribution,
	ownGraphExtensionDeclaration,
} from './ownership.js';
import type {
	ExtensionSettlement,
	ExtensionSettlementCell,
	GraphConfigurationSurface,
	GraphExtensionCompilation,
	GraphExtensionGeneration,
} from './types.js';

type CapturedRegistration =
	| {
			readonly kind: 'captured';
			readonly registrationOrder: number;
			readonly contribute: (...arguments_: readonly unknown[]) => unknown;
			readonly configuration: GraphValue;
	  }
	| { readonly kind: 'failed'; readonly settlement: ExtensionSettlement };

const failed = (
	registrationOrder: number,
	error: unknown
): ExtensionSettlement =>
	Object.freeze({
		kind: 'failed',
		failure: Object.freeze({ registrationOrder, error }),
	});

const fieldsOf = (
	value: unknown,
	message: string
): ReadonlyMap<string, unknown> => {
	const inspected = inspectRecord(value);
	if (!inspected.ok) {
		throw new TypeError(message);
	}
	return new Map(
		inspected.value.map(({ key, value: field }) => [key, field] as const)
	);
};

const captureRegistration = (options: {
	readonly value: unknown;
	readonly registrationOrder: number;
}): CapturedRegistration => {
	try {
		const registration = fieldsOf(
			options.value,
			'Graph extension registration must be an inspectable plain record.'
		);
		const extension = fieldsOf(
			registration.get('extension'),
			'Graph extension must be an inspectable plain record.'
		);
		const contribute = extension.get('contribute');
		if (typeof contribute !== 'function') {
			throw new TypeError('Graph extension contribute must be callable.');
		}
		const configuration = copyGraphValue({
			value: registration.get('configuration'),
		});
		if (!configuration.ok) {
			throw new TypeError(
				`Graph extension configuration is invalid: ${configuration.reason}`
			);
		}
		return Object.freeze({
			kind: 'captured',
			registrationOrder: options.registrationOrder,
			contribute,
			configuration: configuration.value,
		}) as CapturedRegistration;
	} catch (error) {
		return Object.freeze({
			kind: 'failed',
			settlement: failed(options.registrationOrder, error),
		});
	}
};

const invokeCapturedRegistration = (
	registration: Extract<CapturedRegistration, { readonly kind: 'captured' }>
): ExtensionSettlement | Promise<ExtensionSettlement> => {
	let returned: unknown;
	try {
		returned = Reflect.apply(registration.contribute, undefined, [
			Object.freeze({ configuration: registration.configuration }),
		]);
	} catch (error) {
		return failed(registration.registrationOrder, error);
	}
	const observed = observeParticipant<unknown>(returned);
	if (observed.kind === 'failed') {
		return failed(registration.registrationOrder, observed.error);
	}
	const succeeded = (value: unknown): ExtensionSettlement =>
		Object.freeze({
			kind: 'succeeded',
			contribution: ownGraphContribution({
				value,
				registrationOrder: registration.registrationOrder,
			}),
		});
	return observed.kind === 'synchronous'
		? succeeded(observed.value)
		: observed.promise.then(succeeded, (error: unknown) =>
				failed(registration.registrationOrder, error)
			);
};

const settlementCell = (
	settlement: ExtensionSettlement | Promise<ExtensionSettlement>
): ExtensionSettlementCell => {
	const cell: ExtensionSettlementCell = { settlement };
	if (settlement instanceof Promise) {
		cell.settlement = settlement.then((value) => {
			cell.settlement = value;
			return value;
		});
	}
	return cell;
};

/**
 * Captures one immutable declaration and extension-registration generation.
 *
 * @param options               - Values to own for the generation.
 * @param options.declaration   - Base graph declaration candidate.
 * @param options.registrations - Extension registration tuple candidate.
 */
export const createGraphExtensionGeneration = (options: {
	readonly declaration: unknown;
	readonly registrations?: unknown;
}): GraphExtensionGeneration => {
	const declaration = ownGraphExtensionDeclaration(options.declaration);
	let registrations: readonly unknown[] = [];
	if (options.registrations !== undefined) {
		try {
			const inspected = inspectDenseArray(options.registrations);
			if (!inspected.ok) {
				throw new TypeError(inspected.reason);
			}
			registrations = inspected.value;
		} catch (error) {
			return Object.freeze({
				declaration,
				settlements: Object.freeze([settlementCell(failed(1, error))]),
			});
		}
	}
	const captured: CapturedRegistration[] = [];
	for (const [index, value] of registrations.entries()) {
		captured.push(
			captureRegistration({ value, registrationOrder: index + 1 })
		);
	}
	Object.freeze(captured);
	const settlements: ExtensionSettlementCell[] = [];
	for (const registration of captured) {
		settlements.push(
			settlementCell(
				registration.kind === 'failed'
					? registration.settlement
					: invokeCapturedRegistration(registration)
			)
		);
	}
	return Object.freeze({
		declaration,
		settlements: Object.freeze(settlements),
	});
};

const recordKeys = (value: unknown): readonly string[] => {
	const inspected = inspectRecord(value);
	return inspected.ok ? inspected.value.map(({ key }) => key) : [];
};

const configurationSurface = (options: {
	readonly declaration: GraphExtensionGeneration['declaration'];
	readonly contributions: readonly RegisteredGraphContribution[];
}): GraphConfigurationSurface => {
	const declaration = fieldsOf(
		options.declaration,
		'Owned graph declaration must remain inspectable.'
	);
	const nodeKeys = new Set(recordKeys(declaration.get('nodes')));
	for (const contribution of options.contributions) {
		const fields = fieldsOf(
			contribution,
			'Owned graph contribution must remain inspectable.'
		);
		for (const key of recordKeys(fields.get('nodes'))) {
			nodeKeys.add(key);
		}
	}
	return Object.freeze({
		nodeKeys: Object.freeze(sortedKeys(nodeKeys)),
		effectKeys: Object.freeze(
			sortedKeys(recordKeys(declaration.get('effects')))
		),
	});
};

const compileSettled = (options: {
	readonly declaration: GraphExtensionGeneration['declaration'];
	readonly settlements: readonly ExtensionSettlement[];
}): GraphExtensionCompilation => {
	const extensionFailures = Object.freeze(
		options.settlements.flatMap((settlement) =>
			settlement.kind === 'failed' ? [settlement.failure] : []
		)
	);
	const contributions = options.settlements.flatMap((settlement) =>
		settlement.kind === 'succeeded' ? [settlement.contribution] : []
	);
	const surface = configurationSurface({
		declaration: options.declaration,
		contributions,
	});
	const compiled = compileGraphWithContributions({
		declaration: options.declaration,
		contributions,
	});
	return compiled.ok
		? Object.freeze({
				kind: 'compiled',
				extensionFailures,
				graphDiagnostics: Object.freeze([] as const),
				configurationSurface: surface,
				graph: compiled.graph,
			})
		: Object.freeze({
				kind: 'invalid',
				extensionFailures,
				graphDiagnostics: compiled.diagnostics,
				configurationSurface: surface,
			});
};

const compileDrained = (
	values: readonly [
		readonly ExtensionSettlement[],
		GraphExtensionGeneration['declaration'],
	]
): GraphExtensionCompilation =>
	compileSettled({ declaration: values[1], settlements: values[0] });

/**
 * Drains one captured generation and compiles every successful contribution.
 *
 * @param generation - Captured extension generation to compile.
 */
export const compileGraphExtensionGeneration = (
	generation: GraphExtensionGeneration
): GraphExtensionCompilation | Promise<GraphExtensionCompilation> => {
	const settlements = generation.settlements.map(
		({ settlement }) => settlement
	);
	if (!settlements.some((settlement) => settlement instanceof Promise)) {
		return compileSettled({
			declaration: generation.declaration,
			settlements: settlements as readonly ExtensionSettlement[],
		});
	}
	return Promise.all([Promise.all(settlements), generation.declaration]).then(
		compileDrained
	);
};
