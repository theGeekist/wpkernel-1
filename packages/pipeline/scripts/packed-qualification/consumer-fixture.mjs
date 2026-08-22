import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { typescriptBin, typescriptModule } from './context.mjs';
import {
	findReachableForbiddenSymbols,
	readReachableDeclarations,
} from './declarations.mjs';
import { consumerSource } from './consumer-source.mjs';
import { runtimeSource } from './runtime-source.mjs';

const writeJson = (path, value) => {
	writeFileSync(path, JSON.stringify(value, null, 2));
};

const writeRejectedImports = (sourceRoot) => {
	writeFileSync(
		join(sourceRoot, 'rejected-root-compatibility.ts'),
		"// @ts-expect-error compatibility authoring is not exported at the native root\nimport { createHelper } from '@wpkernel/pipeline';\nvoid createHelper;\n"
	);
	writeFileSync(
		join(sourceRoot, 'rejected-root-compiler.ts'),
		"// @ts-expect-error graph compilation remains private to Pipeline\nimport { compileGraph } from '@wpkernel/pipeline';\nvoid compileGraph;\n"
	);
	writeFileSync(
		join(sourceRoot, 'rejected-root-scheduler.ts'),
		"// @ts-expect-error scheduler admission remains private to Pipeline\nimport { scheduleGraph } from '@wpkernel/pipeline';\nvoid scheduleGraph;\n"
	);
	writeFileSync(
		join(sourceRoot, 'rejected-v1.ts'),
		"// @ts-expect-error mutable runner authority is not exported by /v1\nimport { createPipeline } from '@wpkernel/pipeline/v1';\n// @ts-expect-error rollback factories are not exported by /v1\nimport { createPipelineRollback } from '@wpkernel/pipeline/v1';\nvoid createPipeline;\nvoid createPipelineRollback;\n"
	);
	writeFileSync(
		join(sourceRoot, 'rejected-deep-compatibility.ts'),
		"// @ts-expect-error private implementation subpaths are not package exports\nimport { createHelper } from '@wpkernel/pipeline/dist/core/helper.js';\nvoid createHelper;\n"
	);
	writeFileSync(
		join(sourceRoot, 'rejected-deep-compiler.ts'),
		"// @ts-expect-error compiler implementation subpaths are not package exports\nimport { compileGraph } from '@wpkernel/pipeline/dist/v2/graph/compile.js';\nvoid compileGraph;\n"
	);
	writeFileSync(
		join(sourceRoot, 'rejected-deep-scheduler.ts'),
		"// @ts-expect-error scheduler implementation subpaths are not package exports\nimport { scheduleGraph } from '@wpkernel/pipeline/dist/v2/scheduler/schedule.js';\nvoid scheduleGraph;\n"
	);
	writeFileSync(
		join(sourceRoot, 'rejected-contracts.ts'),
		String.raw`
import type {
	Edge,
	EffectContract,
	GraphDeclaration,
	NodeContract,
	NodeMiddlewareFor,
} from '@wpkernel/pipeline';

type Inputs = Readonly<{ source: string }>;
type Nodes = Readonly<{
	parse: NodeContract<'source', string, never>;
	emit: NodeContract<never, string, never, 'write'>;
}>;
type Edges = readonly [Edge<'parse', 'emit'>];
type Effects = Readonly<{
	write: EffectContract<string, string, string, never>;
}>;
type Projection = Readonly<{ result: 'emit' }>;
type Capabilities = Readonly<Record<never, never>>;

const declaration: GraphDeclaration<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Projection,
	Capabilities
> = {
	inputKeys: ['source'],
	nodes: {
		parse: { externalInputs: ['source'], effectKeys: [], priority: 0 },
		emit: { externalInputs: [], effectKeys: ['write'], priority: 0 },
	},
	edges: [{ from: 'parse', to: 'emit' }],
	effects: { write: {} },
	outputs: { result: 'emit' },
	policy: { maxConcurrency: 1 },
	executors: {
		parse: () => ({ kind: 'success', output: 'parsed', effects: [] }),
		emit: () => ({ kind: 'success', output: 'emitted', effects: [] }),
	},
};
void declaration;

export type InvalidProjection = GraphDeclaration<
	Inputs,
	Nodes,
	Edges,
	Effects,
	// @ts-expect-error projections cannot name missing nodes.
	Readonly<{ result: 'missing' }>,
	Capabilities
>;

const invalidExecutor: GraphDeclaration<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Projection,
	Capabilities
> = {
	...declaration,
	executors: {
		...declaration.executors,
		// @ts-expect-error executor output must satisfy its node contract.
		emit: () => ({
			kind: 'success',
			output: 42,
			effects: [],
		}),
	},
};
void invalidExecutor;

const invalidEffect: GraphDeclaration<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Projection,
	Capabilities
> = {
	...declaration,
	executors: {
		...declaration.executors,
		// @ts-expect-error node may only request its declared participant.
		emit: () => ({
			kind: 'success',
			output: 'emitted',
			effects: [
				{
					participant: 'missing',
					payload: 'forbidden',
				},
			],
		}),
	},
};
void invalidEffect;

const invalidMiddleware: NodeMiddlewareFor<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Capabilities,
	'emit',
	'entered'
> = {
	node: 'emit',
	// @ts-expect-error middleware may only request the node's declared participant.
	before: () => ({
		state: 'entered',
		effects: [
			{
				participant: 'missing',
				payload: 'forbidden',
			},
		],
	}),
};
void invalidMiddleware;
`
	);
};

const runTypecheck = (fixtureRoot, project) => {
	try {
		execFileSync(process.execPath, [typescriptBin, '--project', project], {
			cwd: fixtureRoot,
			stdio: 'pipe',
		});
	} catch (error) {
		const output =
			error instanceof Error && 'stdout' in error ? error.stdout : '';
		throw new Error(`Packed ${project} typecheck failed:\n${output}`);
	}
};

const assertConsumerDeclaration = (fixtureRoot) => {
	const declaration = readFileSync(
		join(fixtureRoot, 'dist', 'index.d.ts'),
		'utf8'
	);
	for (const requiredName of [
		'InferredNativeOutcome',
		'InferredSerialPipeline',
		'InferredSerialOutcome',
	]) {
		if (!declaration.includes(requiredName)) {
			throw new Error(
				'Packed consumer declaration did not retain representative inferred values and outcomes.'
			);
		}
	}
	for (const privateName of [
		'core/runner',
		'dist/core/',
		'AgnosticStageDeps',
	]) {
		if (declaration.includes(privateName)) {
			throw new Error(
				'External declarations leaked private Pipeline runner types.'
			);
		}
	}
};

const assertCompatibilityDeclarations = async (installedPackage) => {
	const { default: ts } = await import(typescriptModule);
	const entry = join(installedPackage, 'dist', 'v1.d.ts');
	readReachableDeclarations(entry);
	const forbiddenSymbols = new Set([
		'PreparedSerialRun',
		'Suspension',
		'createPipelineExtension',
		'createPipelineRollback',
		'makePipeline',
		'makeResumablePipeline',
		'maybeThen',
	]);
	const rejected = findReachableForbiddenSymbols(
		ts,
		entry,
		forbiddenSymbols,
		new Set(['serial-authority', 'suspension/types'])
	);
	if (rejected.size > 0) {
		throw new Error(
			`Compatibility declarations leaked rejected authority: ${[...rejected].join(', ')}`
		);
	}
};

export const qualifyConsumer = async ({
	fixtureRoot,
	installedPackage,
	runtimeOnly,
}) => {
	const sourceRoot = join(fixtureRoot, 'src');
	mkdirSync(sourceRoot, { recursive: true });
	if (runtimeOnly) {
		const runtimePath = join(fixtureRoot, 'runtime.mjs');
		writeFileSync(runtimePath, runtimeSource);
		execFileSync(process.execPath, [runtimePath], {
			cwd: fixtureRoot,
			stdio: 'pipe',
		});
		return;
	}
	writeJson(join(fixtureRoot, 'tsconfig.json'), {
		compilerOptions: {
			declaration: true,
			module: 'ESNext',
			moduleResolution: 'Bundler',
			outDir: 'dist',
			strict: true,
			target: 'ES2022',
		},
		include: ['src/**/*.ts'],
	});
	writeJson(join(fixtureRoot, 'tsconfig.nodenext.json'), {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			skipLibCheck: false,
			strict: true,
			target: 'ES2022',
		},
		include: ['src/**/*.ts'],
	});
	writeFileSync(join(sourceRoot, 'index.ts'), consumerSource);
	writeRejectedImports(sourceRoot);

	runTypecheck(fixtureRoot, 'tsconfig.json');
	runTypecheck(fixtureRoot, 'tsconfig.nodenext.json');
	assertConsumerDeclaration(fixtureRoot);
	await assertCompatibilityDeclarations(installedPackage);
	execFileSync(process.execPath, [join(fixtureRoot, 'dist', 'index.js')], {
		cwd: fixtureRoot,
		stdio: 'pipe',
	});
};
