import {
	createHelperId,
	type RegisteredHelper,
} from '../core/dependency-graph.js';
import { createDefaultError } from '../core/error-factory.js';
import type {
	PipelineDiagnostic,
	PipelineReporter,
	PipelineRunState,
} from '../core/types.js';
import {
	bindSerialProgramme,
	type ErasedExtension,
	type ErasedHelper,
	type SerialProgrammeAuthority,
} from './serial-authority.js';
import type {
	CreateSerialPipelineOptions,
	SerialPipeline,
} from './serial-types.js';

type CreateError = (code: string, message: string) => Error;

function captureHelper(
	value: unknown,
	index: number,
	kind: string,
	createError: CreateError
): ErasedHelper {
	if (!value || typeof value !== 'object') {
		throw createError(
			'ValidationError',
			`Serial ${kind} helper ${index + 1} is invalid.`
		);
	}
	const source = value as ErasedHelper;
	const key = source.key;
	const helperKind = source.kind;
	const mode = source.mode;
	const priority = source.priority;
	const dependsOn = source.dependsOn;
	const origin = source.origin;
	const apply = source.apply;
	if (helperKind !== kind || typeof apply !== 'function') {
		throw createError(
			'ValidationError',
			`Serial helper "${String(key)}" must be a callable ${kind} helper.`
		);
	}
	return Object.freeze({
		attribution: source,
		key,
		kind: helperKind,
		mode,
		priority,
		dependsOn: Object.freeze([...(dependsOn ?? [])]),
		...(origin === undefined ? {} : { origin }),
		apply,
	}) satisfies ErasedHelper;
}

function rejectDuplicateOverride(
	captured: readonly RegisteredHelper<ErasedHelper>[],
	helper: ErasedHelper,
	createError: CreateError
): void {
	if (
		helper.mode === 'override' &&
		captured.some(
			(entry) =>
				entry.helper.key === helper.key &&
				entry.helper.mode === 'override'
		)
	) {
		throw createError(
			'ValidationError',
			`Multiple overrides registered for helper "${helper.key}".`
		);
	}
}

function removeOverriddenHelpers(
	captured: RegisteredHelper<ErasedHelper>[],
	helper: ErasedHelper
): void {
	if (helper.mode !== 'override') {
		return;
	}
	for (let cursor = captured.length - 1; cursor >= 0; cursor -= 1) {
		if (captured[cursor]!.helper.key === helper.key) {
			captured.splice(cursor, 1);
		}
	}
}

const captureHelpers = (
	values: readonly unknown[],
	kind: string,
	createError: CreateError
): readonly RegisteredHelper<ErasedHelper>[] => {
	const captured: RegisteredHelper<ErasedHelper>[] = [];
	for (const [index, value] of values.entries()) {
		const ownedHelper = captureHelper(value, index, kind, createError);
		rejectDuplicateOverride(captured, ownedHelper, createError);
		removeOverriddenHelpers(captured, ownedHelper);
		const registrationIndex =
			captured.reduce(
				(maximum, entry) => Math.max(maximum, entry.index),
				-1
			) + 1;
		captured.push(
			Object.freeze({
				helper: ownedHelper,
				id: createHelperId(ownedHelper, registrationIndex),
				index: registrationIndex,
			})
		);
	}
	return Object.freeze(captured);
};

type SerialLifecycle =
	| 'after-fragments'
	| 'before-builders'
	| 'after-builders'
	| 'finalize';

function isSerialLifecycle(value: unknown): value is SerialLifecycle {
	return (
		value === 'after-fragments' ||
		value === 'before-builders' ||
		value === 'after-builders' ||
		value === 'finalize'
	);
}

function captureExtension(
	value: unknown,
	index: number,
	createError: CreateError
): ErasedExtension {
	if (!value || typeof value !== 'object') {
		throw createError(
			'ValidationError',
			`Serial extension ${index + 1} is invalid.`
		);
	}
	const extension = value as {
		readonly key?: unknown;
		readonly lifecycle?: unknown;
		readonly hook?: unknown;
	};
	const key = extension.key;
	const hook = extension.hook;
	const lifecycle = extension.lifecycle ?? 'after-fragments';
	if (typeof key !== 'string' || typeof hook !== 'function') {
		throw createError(
			'ValidationError',
			`Serial extension ${index + 1} requires a key and hook.`
		);
	}
	if (!isSerialLifecycle(lifecycle)) {
		throw createError(
			'ValidationError',
			`Serial extension "${key}" has invalid lifecycle "${String(lifecycle)}".`
		);
	}
	return Object.freeze({ key, lifecycle, hook }) as ErasedExtension;
}

const captureExtensions = (
	values: readonly unknown[],
	createError: CreateError
): readonly ErasedExtension[] =>
	Object.freeze(
		values.map((value, index) =>
			captureExtension(value, index, createError)
		)
	);

function definedAuthority<T extends object>(values: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(values).filter(([, value]) => value !== undefined)
	) as Partial<T>;
}

const createSerialToken = (authority: SerialProgrammeAuthority): object => {
	const token = Object.assign(
		Object.create(null) as Record<string, unknown>,
		{
			kind: 'serial-pipeline' as const,
		}
	);
	Object.freeze(token);
	bindSerialProgramme(token, authority);
	return token;
};

/**
 * Captures one immutable, static v1 serial programme.
 *
 * Helpers and extensions are copied and frozen at construction. Later mutation
 * of the supplied arrays cannot alter a run. Helper kinds must be distinct and
 * every captured helper must match its declared fragment or builder lane.
 *
 * @param options - Complete static authoring contract for the serial programme.
 * @returns An opaque frozen token accepted by `runPipeline`.
 * @throws The configured validation error for conflicting helper kinds,
 * multiple overrides of one key, invalid helper lanes or callability, and
 * invalid extension descriptors or lifecycle names.
 *
 * @example
 * ```ts
 * const pipeline = createSerialPipeline({
 *   ...programme,
 *   fragments: [normalise],
 *   builders: [emit],
 * });
 * ```
 * @public
 */
export function createSerialPipeline<
	TRunOptions,
	TBuildOptions,
	TContext extends { reporter: PipelineReporter },
	TDraft = unknown,
	TArtifact = unknown,
	TRunResult = PipelineRunState<TArtifact, PipelineDiagnostic>,
	TFragmentInput = unknown,
	TFragmentOutput = unknown,
	TBuilderInput = unknown,
	TBuilderOutput = unknown,
>(
	options: CreateSerialPipelineOptions<
		TRunOptions,
		TBuildOptions,
		TContext,
		TDraft,
		TArtifact,
		TRunResult,
		TFragmentInput,
		TFragmentOutput,
		TBuilderInput,
		TBuilderOutput
	>
): SerialPipeline<TRunOptions, TRunResult> {
	const fragmentKind = String(options.fragmentKind ?? 'fragment');
	const builderKind = String(options.builderKind ?? 'builder');
	const createError = options.createError ?? createDefaultError;
	const adoptFragmentOutput = options.adoptFragmentOutput;
	const adoptBuilderOutput = options.adoptBuilderOutput;
	const createRunResult = options.createRunResult;
	const onDiagnostic = options.onDiagnostic;
	const onExtensionRollbackError = options.onExtensionRollbackError;
	const onHelperRollbackError = options.onHelperRollbackError;
	const fragmentProvidedKeys = options.fragmentProvidedKeys;
	const builderProvidedKeys = options.builderProvidedKeys;
	const createMissingDependencyDiagnostic =
		options.createMissingDependencyDiagnostic;
	const createUnusedHelperDiagnostic = options.createUnusedHelperDiagnostic;
	if (fragmentKind === builderKind) {
		throw createError(
			'ValidationError',
			'Fragment and builder helper kinds must be distinct.'
		);
	}
	const authority: SerialProgrammeAuthority = Object.freeze({
		fragmentKind,
		builderKind,
		fragments: captureHelpers(options.fragments, fragmentKind, createError),
		builders: captureHelpers(options.builders, builderKind, createError),
		extensions: captureExtensions(options.extensions ?? [], createError),
		createError,
		createBuildOptions: options.createBuildOptions as (
			value: unknown
		) => unknown,
		createContext: options.createContext as (value: unknown) => {
			reporter: PipelineReporter;
		},
		createFragmentState: options.createFragmentState as (
			value: unknown
		) => unknown,
		createFragmentArgs:
			options.createFragmentArgs as SerialProgrammeAuthority['createFragmentArgs'],
		finalizeFragmentState: options.finalizeFragmentState as (
			value: unknown
		) => unknown,
		createBuilderArgs:
			options.createBuilderArgs as SerialProgrammeAuthority['createBuilderArgs'],
		fragmentProvidedKeys: Object.freeze([...(fragmentProvidedKeys ?? [])]),
		builderProvidedKeys: Object.freeze([...(builderProvidedKeys ?? [])]),
		...definedAuthority({
			adoptFragmentOutput: adoptFragmentOutput as
				| ((value: unknown) => unknown)
				| undefined,
			adoptBuilderOutput: adoptBuilderOutput as
				| ((value: unknown) => unknown)
				| undefined,
			createRunResult: createRunResult as
				| ((value: unknown) => unknown)
				| undefined,
			onDiagnostic: onDiagnostic as
				| ((value: unknown) => void)
				| undefined,
			onExtensionRollbackError: onExtensionRollbackError as
				| ((value: unknown) => void)
				| undefined,
			onHelperRollbackError: onHelperRollbackError as
				| ((value: unknown) => void)
				| undefined,
			createMissingDependencyDiagnostic:
				createMissingDependencyDiagnostic as
					| ((value: unknown) => PipelineDiagnostic)
					| undefined,
			createUnusedHelperDiagnostic: createUnusedHelperDiagnostic as
				| ((value: unknown) => PipelineDiagnostic)
				| undefined,
		}),
	});
	return createSerialToken(authority) as SerialPipeline<
		TRunOptions,
		TRunResult
	>;
}
