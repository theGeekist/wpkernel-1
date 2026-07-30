import type {
	HelperDescriptor,
	PipelineDiagnostic,
	PipelineReporter,
} from '../types';

/**
 * Agnostic configuration for the diagnostic manager.
 */
export interface DiagnosticManagerOptions<
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
> {
	/**
	 * Callback for observing diagnostics as they are added.
	 */
	readonly onDiagnostic?: (options: {
		readonly reporter: TReporter;
		readonly diagnostic: TDiagnostic;
	}) => void;

	readonly createConflictDiagnostic?: (options: {
		readonly helper: HelperDescriptor;
		readonly existing: HelperDescriptor;
		readonly message: string;
	}) => TDiagnostic;
	readonly createMissingDependencyDiagnostic?: (options: {
		readonly helper: HelperDescriptor;
		readonly dependency: string;
		readonly message: string;
	}) => TDiagnostic;
	readonly createUnusedHelperDiagnostic?: (options: {
		readonly helper: HelperDescriptor;
		readonly message: string;
	}) => TDiagnostic;
}

/**
 * Generic diagnostic manager that tracks conflicts, missing dependencies, and other issues
 * without knowledge of specific helper kinds (fragments/builders).
 */
export interface AgnosticDiagnosticManager<
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
> {
	record: (diagnostic: TDiagnostic) => void;
	setReporter: (reporter: TReporter) => void;
	readDiagnostics: () => readonly TDiagnostic[];
	getDiagnostics: () => readonly TDiagnostic[];
	createRun?: (
		reporter: TReporter,
		initialDiagnostics?: readonly TDiagnostic[]
	) => AgnosticDiagnosticManager<TReporter, TDiagnostic>;

	// Helper-centric utilities
	flagConflict: (
		helper: HelperDescriptor,
		existing: HelperDescriptor,
		kind: string,
		message: string
	) => void;
	flagMissingDependency: (
		helper: HelperDescriptor,
		dependency: string,
		kind: string
	) => void;
	flagUnusedHelper: (
		helper: HelperDescriptor,
		kind: string,
		reason: string,
		dependsOn: readonly string[]
	) => void;

	prepareRun: () => void;
	endRun: () => void;
}

/**
 * Creates a truly agnostic diagnostic manager.
 * @param options
 */
export function createAgnosticDiagnosticManager<
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
>(
	options: DiagnosticManagerOptions<TReporter, TDiagnostic> = {}
): AgnosticDiagnosticManager<TReporter, TDiagnostic> {
	const staticDiagnostics: TDiagnostic[] = [];

	// Track logged diagnostics per reporter instance to avoid duplicate alerting
	const loggedDiagnosticsByReporter = new WeakMap<
		TReporter,
		Set<TDiagnostic>
	>();

	const createManager = (
		runDiagnostics?: TDiagnostic[]
	): AgnosticDiagnosticManager<TReporter, TDiagnostic> => {
		let currentReporter: TReporter | undefined;

		const logDiagnostic = (diagnostic: TDiagnostic): void => {
			if (!currentReporter || !options.onDiagnostic) {
				return;
			}

			let logged = loggedDiagnosticsByReporter.get(currentReporter);
			if (!logged) {
				logged = new Set();
				loggedDiagnosticsByReporter.set(currentReporter, logged);
			}

			if (logged.has(diagnostic)) {
				return;
			}

			options.onDiagnostic({
				reporter: currentReporter,
				diagnostic,
			});
			logged.add(diagnostic);
		};

		const record = (diagnostic: TDiagnostic): void => {
			(runDiagnostics ?? staticDiagnostics).push(diagnostic);
			logDiagnostic(diagnostic);
		};

		const describeHelper = (kind: string, helper: HelperDescriptor) =>
			`${kind} helper "${helper.key}"`;

		const manager: AgnosticDiagnosticManager<TReporter, TDiagnostic> = {
			record,

			createRun(reporter, initialDiagnostics = staticDiagnostics) {
				const runManager = createManager([...initialDiagnostics]);
				runManager.setReporter(reporter);
				return runManager;
			},

			setReporter(reporter: TReporter) {
				currentReporter = reporter;
				(runDiagnostics ?? staticDiagnostics).forEach(logDiagnostic);
			},

			readDiagnostics: () => runDiagnostics ?? staticDiagnostics,
			getDiagnostics: () => runDiagnostics ?? staticDiagnostics,

			// Retained as no-ops for compatibility with internal runner adapters.
			prepareRun() {},
			endRun() {},

			flagConflict(helper, existing, kind, message) {
				const diagnostic =
					options.createConflictDiagnostic?.({
						helper,
						existing,
						message,
					}) ??
					({
						type: 'conflict',
						key: helper.key,
						mode: helper.mode,
						helpers: [
							existing.origin ?? existing.key,
							helper.origin ?? helper.key,
						],
						message,
						kind,
					} as unknown as TDiagnostic);

				record(diagnostic);
			},

			flagMissingDependency(helper, dependency, kind) {
				const description = describeHelper(kind, helper);
				const message = `${description} depends on unknown helper "${dependency}".`;

				const diagnostic =
					options.createMissingDependencyDiagnostic?.({
						helper,
						dependency,
						message,
					}) ??
					({
						type: 'missing-dependency',
						key: helper.key,
						dependency,
						message,
						kind,
						helper: helper.origin ?? helper.key,
						dependsOn: helper.dependsOn,
					} as unknown as TDiagnostic);

				record(diagnostic);
			},

			flagUnusedHelper(helper, kind, reason, dependsOn) {
				const description = describeHelper(kind, helper);
				const message = `${description} ${reason}.`;

				const diagnostic =
					options.createUnusedHelperDiagnostic?.({
						helper,
						message,
					}) ??
					({
						type: 'unused-helper',
						key: helper.key,
						message,
						kind,
						helper: helper.origin ?? helper.key,
						dependsOn,
					} as unknown as TDiagnostic);

				record(diagnostic);
			},
		};

		return manager;
	};

	return createManager();
}
