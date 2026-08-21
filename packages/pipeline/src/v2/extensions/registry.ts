import { compileGraphWithContributions } from '../graph/contributions.js';
import { inspectRecord } from '../graph/inspection.js';
import type {
	Edge,
	EffectRegistry,
	ErasedGraphDeclaration,
	GraphDeclaration,
	GraphContribution,
	GraphValue,
	NodeRegistry,
	OutputProjection,
} from '../graph/types.js';
import { observeParticipant } from '../scheduler/maybe-promise.js';
import {
	ownGraphContribution,
	ownGraphExtensionDeclaration,
} from './ownership.js';
import type {
	CompileGraphExtensionsResult,
	GraphExtensionFailure,
	GraphExtensionRegistry,
} from './types.js';

type ContributionSettlement =
	| { readonly kind: 'succeeded'; readonly contribution: GraphContribution }
	| { readonly kind: 'failed'; readonly failure: GraphExtensionFailure };

interface RegistrationCell {
	settlement: ContributionSettlement | Promise<ContributionSettlement>;
}

interface RegistrationTail {
	readonly cell: RegistrationCell;
	readonly previous?: RegistrationTail;
	readonly length: number;
}

interface RegistryAuthority {
	nextRegistrationOrder: number;
	activeSynchronousContribution: boolean;
}

interface RegistryGeneration {
	readonly declaration: ErasedGraphDeclaration;
	readonly registrationTail?: RegistrationTail;
	readonly authority: RegistryAuthority;
	compilation?:
		| CompileGraphExtensionsResult
		| Promise<CompileGraphExtensionsResult>;
}

interface ErasedUseOptions {
	readonly extension: unknown;
	readonly configuration: unknown;
}

const failed = (
	registrationOrder: number,
	error: unknown
): ContributionSettlement => ({
	kind: 'failed',
	failure: Object.freeze({ registrationOrder, error }),
});

const contributionCallback = (
	value: unknown
): ((options: unknown) => unknown) => {
	const inspected = inspectRecord(value);
	if (!inspected.ok) {
		throw new TypeError(
			'Graph extension must be an inspectable plain record.'
		);
	}
	const contribute = inspected.value.find(
		({ key }) => key === 'contribute'
	)?.value;
	if (typeof contribute !== 'function') {
		throw new TypeError('Graph extension contribute must be callable.');
	}
	return contribute as (options: unknown) => unknown;
};

const invokeContribution = (options: {
	readonly registrationOrder: number;
	readonly registration: ErasedUseOptions;
}): ContributionSettlement | Promise<ContributionSettlement> => {
	let returned: unknown;
	try {
		const contribute = contributionCallback(options.registration.extension);
		returned = Reflect.apply(contribute, undefined, [
			Object.freeze({
				configuration: options.registration.configuration,
			}),
		]);
	} catch (error) {
		return failed(options.registrationOrder, error);
	}
	const observed = observeParticipant<unknown>(returned);
	if (observed.kind === 'failed') {
		return failed(options.registrationOrder, observed.error);
	}
	const succeeded = (value: unknown): ContributionSettlement => ({
		kind: 'succeeded',
		contribution: ownGraphContribution({
			value,
			registrationOrder: options.registrationOrder,
		}),
	});
	return observed.kind === 'synchronous'
		? succeeded(observed.value)
		: observed.promise.then(succeeded, (error: unknown) =>
				failed(options.registrationOrder, error)
			);
};

const createRegistrationCell = (
	settlement: ContributionSettlement | Promise<ContributionSettlement>
): RegistrationCell => {
	const cell: RegistrationCell = { settlement };
	if (settlement instanceof Promise) {
		cell.settlement = settlement.then((value) => {
			cell.settlement = value;
			return value;
		});
	}
	return cell;
};

const compileSettled = (options: {
	readonly declaration: ErasedGraphDeclaration;
	readonly settlements: readonly ContributionSettlement[];
}): CompileGraphExtensionsResult => {
	const failures = Object.freeze(
		options.settlements.flatMap((settlement) =>
			settlement.kind === 'failed' ? [settlement.failure] : []
		)
	);
	if (failures.length > 0) {
		return Object.freeze({
			ok: false,
			kind: 'extension-failed',
			primaryFailure: failures[0]!,
			failures,
		});
	}
	const compiled = compileGraphWithContributions({
		declaration: options.declaration,
		contributions: options.settlements.map(
			(settlement) =>
				(
					settlement as Extract<
						ContributionSettlement,
						{ readonly kind: 'succeeded' }
					>
				).contribution
		),
	});
	return compiled.ok
		? compiled
		: Object.freeze({
				ok: false,
				kind: 'graph-invalid',
				diagnostics: compiled.diagnostics,
			});
};

const orderedSettlements = (
	tail: RegistrationTail | undefined
): readonly (ContributionSettlement | Promise<ContributionSettlement>)[] => {
	if (!tail) {
		return Object.freeze([]);
	}
	const settlements = new Array<
		ContributionSettlement | Promise<ContributionSettlement>
	>(tail.length);
	let cursor: RegistrationTail | undefined = tail;
	let index = tail.length - 1;
	while (cursor) {
		settlements[index] = cursor.cell.settlement;
		index -= 1;
		cursor = cursor.previous;
	}
	return settlements;
};

const compileGeneration = (
	generation: RegistryGeneration
): CompileGraphExtensionsResult | Promise<CompileGraphExtensionsResult> => {
	if (generation.compilation) {
		return generation.compilation;
	}
	const declaration = ownGraphExtensionDeclaration(generation.declaration);
	const settlements = orderedSettlements(generation.registrationTail);
	if (!settlements.some((settlement) => settlement instanceof Promise)) {
		const compiled = compileSettled({
			declaration,
			settlements: settlements as readonly ContributionSettlement[],
		});
		generation.compilation = compiled;
		return compiled;
	}
	const pending = Promise.all(settlements).then((drained) => {
		const compiled = compileSettled({ declaration, settlements: drained });
		generation.compilation = compiled;
		return compiled;
	});
	generation.compilation = pending;
	return pending;
};

const useExtension = (
	generation: RegistryGeneration,
	registration: ErasedUseOptions
): RegistryGeneration => {
	if (generation.authority.activeSynchronousContribution) {
		throw new TypeError(
			'Graph extensions cannot register extensions re-entrantly.'
		);
	}
	const registrationOrder = generation.authority.nextRegistrationOrder;
	generation.authority.nextRegistrationOrder += 1;
	generation.authority.activeSynchronousContribution = true;
	let settlement: ContributionSettlement | Promise<ContributionSettlement>;
	try {
		settlement = invokeContribution({ registrationOrder, registration });
	} finally {
		generation.authority.activeSynchronousContribution = false;
	}
	const previous = generation.registrationTail;
	return {
		declaration: generation.declaration,
		registrationTail: Object.freeze({
			cell: createRegistrationCell(settlement),
			...(previous ? { previous } : {}),
			length: (previous?.length ?? 0) + 1,
		}),
		authority: generation.authority,
	};
};

const registryFacade = (
	generation: RegistryGeneration
): GraphExtensionRegistry =>
	Object.freeze({
		use(registration: ErasedUseOptions) {
			return registryFacade(useExtension(generation, registration));
		},
		compile() {
			return compileGeneration(generation);
		},
	}) as GraphExtensionRegistry;

/**
 * Creates an ordered extension queue around one immutable base declaration.
 *
 * @param options             - Registry construction options.
 * @param options.declaration - Immutable base graph declaration.
 */
export const createGraphExtensionRegistry = <
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
>(options: {
	readonly declaration: GraphDeclaration<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
}): GraphExtensionRegistry<
	TInputs,
	TNodes,
	TEdges,
	TEffects,
	TProjection,
	TCapabilities
> => {
	return registryFacade({
		declaration: options.declaration as unknown as ErasedGraphDeclaration,
		authority: {
			nextRegistrationOrder: 1,
			activeSynchronousContribution: false,
		},
	}) as GraphExtensionRegistry<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
};
