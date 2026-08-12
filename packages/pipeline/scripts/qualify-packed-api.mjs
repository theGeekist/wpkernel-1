import { execFileSync } from 'node:child_process';
import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '..', '..');
const sourceManifest = JSON.parse(
	readFileSync(join(packageRoot, 'package.json'), 'utf8')
);
const qualificationRoot = mkdtempSync(
	join(tmpdir(), 'wpkernel-pipeline-qualification-')
);
const suppliedTarball = process.argv[2]
	? resolve(process.cwd(), process.argv[2])
	: undefined;

const source = String.raw`
import {
	createHelper,
	createPipeline,
	isPromiseLike,
	makePipeline,
	makeResumablePipeline,
	maybeThen,
	maybeTry,
	type AgnosticPipeline,
	type Helper,
	type MaybePromise,
	type MissingDependencyDiagnostic,
	type Pipeline,
	type PipelineRunState,
	type PipelineStage,
	type PipelineStageDependencies,
	type PipelineStageState,
	type StandardPipelineExtension,
} from '@wpkernel/pipeline';

const mappedUtility = maybeThen(2, (value) => value * 3);
const recoveredUtility = maybeTry(
	() => {
		throw new Error('expected');
	},
	() => 7
);
if (mappedUtility !== 6 || recoveredUtility !== 7) {
	throw new Error('Root async utility exports did not preserve sync semantics.');
}

type Kind = 'compiler';
type Options = { readonly source: string };
type State = { readonly nodes: readonly string[]; readonly revision: number };
type Reporter = { warn?: (message: string, context?: unknown) => void };
type Context = { readonly reporter: Reporter };
type Diagnostic = MissingDependencyDiagnostic<Kind>;
type Result = PipelineRunState<State, Diagnostic>;
type StageState = PipelineStageState<
	Options,
	State,
	Context,
	Reporter,
	Diagnostic
>;
type Dependencies = PipelineStageDependencies<
	Options,
	State,
	Context,
	Reporter,
	Diagnostic,
	Result,
	Kind
>;
type CompilerHelper = Helper<Context, Options, State, Reporter, Kind>;

const assertTypes = (deps: Dependencies): void => {
	// @ts-expect-error helper kind must belong to the declared union
	deps.makeHelperStage('invalid-kind');
	const invalidStage: PipelineStage<StageState, Result> =
		// @ts-expect-error stage output must preserve StageState
		(state) => ({ ...state, userState: 'invalid-state' });
	void invalidStage;
	// @ts-expect-error stage state must be derived from the branded input
	const reconstructedState: StageState = {
		context: { reporter: {} },
		reporter: {},
		runOptions: { source: 'fixture' },
		userState: { nodes: [], revision: 0 },
		steps: [],
		diagnostics: [],
		executedLifecycles: new Set(),
	};
	void reconstructedState;
};
void assertTypes;

const pipeline = makePipeline<
	Options,
	Context,
	Reporter,
	State,
	Diagnostic,
	Result,
	Kind
>({
	helperKinds: ['compiler'],
	createContext: () => ({ reporter: {} }),
	createState: () => ({ nodes: [], revision: 0 }),
	createStages: (deps) => {
		const inferred: Dependencies = deps;
		void inferred;
		return [
			deps.makeHelperStage<Options, State, Kind, CompilerHelper>(
				'compiler',
				{
					makeArgs: (state) => (entry) => {
						const helper: CompilerHelper = entry.helper;
						void helper;
						return {
							context: state.context,
							input: state.runOptions,
							output: state.userState,
							reporter: state.reporter,
						};
					},
					writeOutput: (state, output) => ({
						...state,
						userState: output,
					}),
				}
			),
			(state) => ({
				...state,
				userState: {
					nodes: [...state.userState.nodes, 'custom-stage'],
					revision: state.userState.revision + 1,
				},
			}),
			deps.finalizeResult,
		];
	},
	createRunResult: ({ artifact, diagnostics, state }) => {
		const typedState: StageState = state;
		void typedState;
		return { artifact, diagnostics, steps: state.steps };
	},
});

const typedAgnosticPipeline: AgnosticPipeline<
	Options,
	Result,
	Context,
	Reporter,
	Kind
> = pipeline;
void typedAgnosticPipeline;

const assertPipelineSurface = () => {
	// @ts-expect-error configured helper kinds constrain registration
	pipeline.use({ ...({} as CompilerHelper), kind: 'invalid-kind' });
	// @ts-expect-error providedKeys is construction input, not runtime state
	void pipeline.providedKeys;
};
void assertPipelineSurface;

export const resumable = makeResumablePipeline({
	helperKinds: ['compiler'] as const,
	createContext: () => ({ reporter: {} }),
	createState: () => ({ nodes: [], revision: 0 }),
});

pipeline.use(
	createHelper<Context, Options, State, Reporter, Kind>({
		key: 'compiler.first',
		kind: 'compiler',
		apply: ({ output }) => ({
			output: {
				nodes: [...output.nodes, 'first'],
				revision: output.revision + 1,
			},
		}),
	})
);

pipeline.use(
	createHelper<Context, Options, State, Reporter, Kind>({
		key: 'compiler.around',
		kind: 'compiler',
		dependsOn: ['compiler.first'],
		apply: ({ output }, next) => {
			const downstream: MaybePromise<State> = next!({
				nodes: [...output.nodes, 'before-next'],
				revision: output.revision + 1,
			});
			if (isPromiseLike(downstream)) {
				throw new Error('A synchronous helper chain became asynchronous.');
			}
			return {
				output: {
					nodes: [...downstream.nodes, 'after-next'],
					revision: downstream.revision + 1,
				},
			};
		},
	})
);

export const result = pipeline.run({ source: 'post:1' });
if (isPromiseLike(result)) {
	throw new Error('A synchronous pipeline returned a Promise.');
}
const expected = ['first', 'before-next', 'after-next', 'custom-stage'];
if (JSON.stringify(result.artifact.nodes) !== JSON.stringify(expected)) {
	throw new Error(
		'Immutable replacement output was not preserved: ' +
			JSON.stringify(result.artifact.nodes)
	);
}

type StandardDraft = { readonly parts: readonly string[] };
type StandardArtifact = { readonly value: string };
type StandardResult = PipelineRunState<StandardArtifact>;
type StandardPipeline = Pipeline<
	Options,
	StandardResult,
	Context,
	Reporter,
	Record<string, never>,
	StandardArtifact,
	StandardDraft,
	StandardDraft,
	StandardArtifact,
	StandardArtifact
>;

const standardPipeline: StandardPipeline = createPipeline({
	createBuildOptions: () => ({}),
	createContext: () => ({ reporter: {} }),
	createFragmentState: (): StandardDraft => ({ parts: ['draft'] }),
	createFragmentArgs: ({ context, draft }) => ({
		context,
		input: draft,
		output: draft,
		reporter: context.reporter,
	}),
	finalizeFragmentState: ({ draft }): StandardArtifact => ({
		value: draft.parts.join(':'),
	}),
	createBuilderArgs: ({ context, artifact }) => ({
		context,
		input: artifact,
		output: artifact,
		reporter: context.reporter,
	}),
});
type ExportedStandardExtension = StandardPipelineExtension<
	Options,
	StandardResult,
	Context,
	Reporter,
	Record<string, never>,
	StandardArtifact,
	StandardDraft,
	StandardDraft,
	StandardArtifact,
	StandardArtifact
>;
const exportedStandardExtension: ExportedStandardExtension = {
	register: () => ({ artifact }) => ({
		artifact: { value: artifact.value + ':typed' },
	}),
};
standardPipeline.extensions.use(exportedStandardExtension);
const assertStandardPipelineSurface = () => {
	standardPipeline.use({
		...({} as Parameters<StandardPipeline['ir']['use']>[0]),
		// @ts-expect-error generic registration accepts only standard helper kinds
		kind: 'invalid-kind',
	});
};
void assertStandardPipelineSurface;

const standardResult = standardPipeline.run({ source: 'standard' });
if (isPromiseLike(standardResult)) {
	throw new Error('A synchronous standard pipeline returned a Promise.');
}
if (standardResult.artifact.value !== 'draft:typed') {
	throw new Error(
		'Standard extension did not receive and replace the finalised artifact.'
	);
}
`;

try {
	let tarballPath = suppliedTarball;
	if (tarballPath) {
		if (!existsSync(tarballPath)) {
			throw new Error(`Supplied tarball does not exist: ${tarballPath}`);
		}
	} else {
		execFileSync(
			'pnpm',
			['pack', '--pack-destination', qualificationRoot],
			{
				cwd: packageRoot,
				stdio: 'pipe',
			}
		);

		const tarball = readdirSync(qualificationRoot).find((entry) =>
			entry.endsWith('.tgz')
		);
		if (!tarball) {
			throw new Error('pnpm pack did not produce a tarball.');
		}
		tarballPath = join(qualificationRoot, tarball);
	}

	const fixtureRoot = join(qualificationRoot, 'consumer');
	const installedPackage = join(
		fixtureRoot,
		'node_modules',
		'@wpkernel',
		'pipeline'
	);
	mkdirSync(installedPackage, { recursive: true });
	execFileSync(
		'tar',
		['-xzf', tarballPath, '-C', installedPackage, '--strip-components=1'],
		{ stdio: 'pipe' }
	);

	const packedManifest = JSON.parse(
		readFileSync(join(installedPackage, 'package.json'), 'utf8')
	);
	if (
		packedManifest.name !== sourceManifest.name ||
		packedManifest.version !== sourceManifest.version
	) {
		throw new Error(
			'Packed package identity does not match the source manifest.'
		);
	}
	const exportKeys = Object.keys(packedManifest.exports ?? {}).sort();
	if (
		JSON.stringify(exportKeys) !== JSON.stringify(['.', './package.json'])
	) {
		throw new Error(
			`Packed package exposes unexpected entry points: ${exportKeys.join(', ')}`
		);
	}

	writeFileSync(
		join(fixtureRoot, 'package.json'),
		JSON.stringify({ private: true, type: 'module' }, null, 2)
	);
	writeFileSync(
		join(fixtureRoot, 'tsconfig.json'),
		JSON.stringify(
			{
				compilerOptions: {
					declaration: true,
					module: 'ESNext',
					moduleResolution: 'Bundler',
					outDir: 'dist',
					strict: true,
					target: 'ES2022',
				},
				include: ['src/**/*.ts'],
			},
			null,
			2
		)
	);
	mkdirSync(join(fixtureRoot, 'src'), { recursive: true });
	writeFileSync(join(fixtureRoot, 'src', 'index.ts'), source);

	const typescriptBin = join(
		repositoryRoot,
		'node_modules',
		'typescript',
		'bin',
		'tsc'
	);
	execFileSync(
		process.execPath,
		[typescriptBin, '--project', 'tsconfig.json'],
		{
			cwd: fixtureRoot,
			stdio: 'pipe',
		}
	);

	const declaration = readFileSync(
		join(fixtureRoot, 'dist', 'index.d.ts'),
		'utf8'
	);
	if (
		declaration.includes('core/runner') ||
		declaration.includes('dist/core/') ||
		declaration.includes('AgnosticStageDeps')
	) {
		throw new Error(
			'External declarations leaked private Pipeline runner types.'
		);
	}

	execFileSync(process.execPath, [join(fixtureRoot, 'dist', 'index.js')], {
		cwd: fixtureRoot,
		stdio: 'pipe',
	});

	console.log(`Packed API qualification passed: ${basename(tarballPath)}`);
} finally {
	rmSync(qualificationRoot, { recursive: true, force: true });
}
