import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const typedoc = path.resolve('node_modules/typedoc/bin/typedoc');
const plugin = path.resolve('scripts/docs/typedoc-public-surface.mjs');

jest.setTimeout(30_000);

type PipelineSourceOptions = {
	driftAliasExtensionConstraint?:
		| 'PipelineEdges'
		| 'PipelineNodes'
		| 'PipelineProjection';
	driftCreateExtensionsConstraint?: boolean;
	driftCreateMiddlewareConstraint?: boolean;
	driftPipelineEdgesRhs?: boolean;
	driftPipelineNodesRhs?: boolean;
	driftPipelineProjectionRhs?: boolean;
	omitPipelineEdges?: boolean;
	reorderExtensions?: boolean;
	wrongCheckedArguments?: boolean;
};

const pipelineSource = (options: PipelineSourceOptions) => `
export type NodeRegistry = Readonly<Record<string, unknown>>;
export interface Edge<TFrom extends string = string, TTo extends string = string> {
	readonly from: TFrom;
	readonly to: TTo;
}
export type OutputProjection<TNodes extends NodeRegistry> = Readonly<Record<string, keyof TNodes & string>>;
type GraphExtensionRegistrationShape = object;
${options.driftCreateMiddlewareConstraint ? 'type NodeMiddlewareRegistration = object;' : ''}
type ExtensionNodes<TNodes, TExtensions> = TNodes & { readonly extensionNodes?: TExtensions };
type ExtensionEdges<TEdges, TExtensions> = TEdges & { readonly extensionEdges?: TExtensions };
type ExtensionProjection<TProjection, TExtensions> = TProjection & { readonly extensionProjection?: TExtensions };
type ClosedOutputProjection<TProjection> = TProjection;
type CheckedGraphExtensionRegistrations<TInputs, TNodes, TEdges, TEffects, TCapabilities, TExtensions> = {
	readonly checkedExtensions?: readonly [TInputs, TNodes, TEdges, TEffects, TCapabilities, TExtensions];
};
type CheckedNodeMiddlewareRegistrations<TInputs, TNodes, TEdges, TEffects, TCapabilities, TMiddleware> = {
	readonly checkedMiddleware?: readonly [TInputs, TNodes, TEdges, TEffects, TCapabilities, TMiddleware];
};

export interface Pipeline<TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities> {
	readonly kind: 'pipeline';
}

export interface CreatePipelineOptions<
	TInputs,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
	TExtensions extends ${options.driftCreateExtensionsConstraint ? 'readonly object[]' : 'readonly GraphExtensionRegistrationShape[]'},
	TParticipants,
	TMiddleware extends ${options.driftCreateMiddlewareConstraint ? 'readonly NodeMiddlewareRegistration[]' : 'readonly object[]'},
> {
	readonly extensions?: ${options.reorderExtensions ? 'CheckedGraphExtensionRegistrations<TInputs, TNodes, TEdges, TEffects, TCapabilities, NoInfer<TExtensions>> & TExtensions' : `TExtensions & CheckedGraphExtensionRegistrations<TInputs, TNodes, TEdges, TEffects, TCapabilities, NoInfer<${options.wrongCheckedArguments ? 'TMiddleware' : 'TExtensions'}>>`};
	readonly middleware?: TMiddleware & CheckedNodeMiddlewareRegistrations<
		TInputs,
		ExtensionNodes<TNodes, TExtensions>,
		ExtensionEdges<TEdges, TExtensions>,
		TEffects,
		TCapabilities,
		NoInfer<TMiddleware>
	>;
}

export declare function createPipeline<
	TInputs,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
	TExtensions extends readonly GraphExtensionRegistrationShape[],
	TParticipants,
	TMiddleware extends readonly object[] = readonly [],
>(options: CreatePipelineOptions<
	TInputs,
	TNodes,
	TEdges,
	TEffects,
	TProjection,
	TCapabilities,
	TExtensions,
	TParticipants,
	TMiddleware
>): Pipeline<TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities>;

export type PipelineNodes<TNodes extends NodeRegistry, TExtensions extends ${options.driftAliasExtensionConstraint === 'PipelineNodes' ? 'readonly object[]' : 'readonly GraphExtensionRegistrationShape[]'}> = ${options.driftPipelineNodesRhs ? 'TNodes' : 'ExtensionNodes<TNodes, TExtensions>'};
${options.omitPipelineEdges ? '' : `export type PipelineEdges<TEdges extends readonly Edge[], TExtensions extends ${options.driftAliasExtensionConstraint === 'PipelineEdges' ? 'readonly object[]' : 'readonly GraphExtensionRegistrationShape[]'}> = ${options.driftPipelineEdgesRhs ? 'TEdges' : 'ExtensionEdges<TEdges, TExtensions>'};`}
export type PipelineProjection<
	TNodes extends NodeRegistry,
	TProjection,
	TExtensions extends ${options.driftAliasExtensionConstraint === 'PipelineProjection' ? 'readonly object[]' : 'readonly GraphExtensionRegistrationShape[]'},
> = ${
	options.driftPipelineProjectionRhs
		? 'TProjection'
		: `ExtensionProjection<TProjection, TExtensions> extends infer TAccumulated
	? ClosedOutputProjection<TAccumulated> extends OutputProjection<ExtensionNodes<TNodes, TExtensions>>
		? ClosedOutputProjection<TAccumulated>
		: never
	: never`
};
`;

type TypeDocResult = ReturnType<typeof spawnSync> & {
	readonly outputFile: string;
};

async function runTypeDoc(source: string): Promise<TypeDocResult> {
	const fixture = await fs.mkdtemp(
		path.join(os.tmpdir(), 'wpkernel-typedoc-surface-')
	);
	const entry = path.join(fixture, 'index.ts');
	const tsconfig = path.join(fixture, 'tsconfig.json');
	const outputFile = path.join(fixture, 'project.json');
	await fs.writeFile(entry, source);
	await fs.writeFile(
		tsconfig,
		JSON.stringify({
			compilerOptions: {
				module: 'NodeNext',
				moduleResolution: 'NodeNext',
				strict: true,
				target: 'ES2022',
			},
			include: [entry],
		})
	);

	return Object.assign(
		spawnSync(
			typedoc,
			[
				'--entryPoints',
				entry,
				'--tsconfig',
				tsconfig,
				'--plugin',
				plugin,
				'--name',
				'@wpkernel/pipeline',
				'--json',
				outputFile,
				'--skipErrorChecking',
				'--readme',
				'none',
			],
			{ cwd: fixture, encoding: 'utf8' }
		),
		{ outputFile }
	);
}

type JsonReflection = {
	readonly name?: string;
	readonly children?: readonly JsonReflection[];
	readonly type?: { readonly name?: string; readonly type?: string };
};

function findReflection(
	reflection: JsonReflection,
	name: string
): JsonReflection | undefined {
	if (reflection.name === name) {
		return reflection;
	}

	for (const child of reflection.children ?? []) {
		const match = findReflection(child, name);
		if (match) {
			return match;
		}
	}

	return undefined;
}

describe('TypeDoc public Pipeline projection', () => {
	it('projects the complete validated source shape', async () => {
		const result = await runTypeDoc(pipelineSource({}));
		try {
			expect(result.status).toBe(0);
			const project = JSON.parse(
				await fs.readFile(result.outputFile, 'utf8')
			) as JsonReflection;
			const createOptions = findReflection(
				project,
				'CreatePipelineOptions'
			);
			const extensions = createOptions
				? findReflection(createOptions, 'extensions')
				: undefined;
			const pipelineNodes = findReflection(project, 'PipelineNodes');
			const createPipeline = findReflection(project, 'createPipeline');

			expect(extensions?.type).toMatchObject({
				name: 'TExtensions',
				type: 'reference',
			});
			expect(pipelineNodes?.type).toMatchObject({
				name: 'NodeRegistry',
				type: 'reference',
			});
			for (const internalName of [
				'CheckedGraphExtensionRegistrations',
				'CheckedNodeMiddlewareRegistrations',
				'NodeMiddlewareRegistration',
			]) {
				expect(JSON.stringify(createOptions)).not.toContain(
					internalName
				);
				expect(JSON.stringify(createPipeline)).not.toContain(
					internalName
				);
			}
		} finally {
			await fs.rm(path.dirname(result.outputFile), {
				force: true,
				recursive: true,
			});
		}
	});

	it('fails when a required projection target is missing', async () => {
		const result = await runTypeDoc(
			pipelineSource({ omitPipelineEdges: true })
		);
		try {
			expect(result.status).not.toBe(0);
			expect(`${result.stdout}${result.stderr}`).toContain(
				'expected exactly one type alias named PipelineEdges, found 0'
			);
		} finally {
			await fs.rm(path.dirname(result.outputFile), {
				force: true,
				recursive: true,
			});
		}
	});

	it('fails when a checked tuple intersection is reordered', async () => {
		const result = await runTypeDoc(
			pipelineSource({ reorderExtensions: true })
		);
		try {
			expect(result.status).not.toBe(0);
			expect(`${result.stdout}${result.stderr}`).toContain(
				'CreatePipelineOptions.extensions must retain its exact public tuple and checked-helper generic argument tree'
			);
		} finally {
			await fs.rm(path.dirname(result.outputFile), {
				force: true,
				recursive: true,
			});
		}
	});

	it('fails when checked-helper generic arguments drift', async () => {
		const result = await runTypeDoc(
			pipelineSource({ wrongCheckedArguments: true })
		);
		try {
			expect(result.status).not.toBe(0);
			expect(`${result.stdout}${result.stderr}`).toContain(
				'CreatePipelineOptions.extensions must retain its exact public tuple and checked-helper generic argument tree'
			);
		} finally {
			await fs.rm(path.dirname(result.outputFile), {
				force: true,
				recursive: true,
			});
		}
	});

	it.each<[string, PipelineSourceOptions]>([
		[
			'CreatePipelineOptions.TExtensions',
			{ driftCreateExtensionsConstraint: true },
		],
		[
			'CreatePipelineOptions.TMiddleware',
			{ driftCreateMiddlewareConstraint: true },
		],
	])('fails when the %s constraint drifts', async (name, options) => {
		const result = await runTypeDoc(pipelineSource(options));
		try {
			expect(result.status).not.toBe(0);
			expect(`${result.stdout}${result.stderr}`).toContain(
				`${name} must retain its exact original constraint before projection`
			);
		} finally {
			await fs.rm(path.dirname(result.outputFile), {
				force: true,
				recursive: true,
			});
		}
	});

	it.each<
		[
			'PipelineEdges' | 'PipelineNodes' | 'PipelineProjection',
			PipelineSourceOptions,
		]
	>([
		['PipelineNodes', { driftAliasExtensionConstraint: 'PipelineNodes' }],
		['PipelineEdges', { driftAliasExtensionConstraint: 'PipelineEdges' }],
		[
			'PipelineProjection',
			{ driftAliasExtensionConstraint: 'PipelineProjection' },
		],
	])(
		'fails when the %s TExtensions constraint drifts',
		async (name, options) => {
			const result = await runTypeDoc(pipelineSource(options));
			try {
				expect(result.status).not.toBe(0);
				expect(`${result.stdout}${result.stderr}`).toContain(
					`${name}.TExtensions must retain its exact original constraint before projection`
				);
			} finally {
				await fs.rm(path.dirname(result.outputFile), {
					force: true,
					recursive: true,
				});
			}
		}
	);

	it.each<[string, PipelineSourceOptions]>([
		['PipelineNodes', { driftPipelineNodesRhs: true }],
		['PipelineEdges', { driftPipelineEdgesRhs: true }],
		['PipelineProjection', { driftPipelineProjectionRhs: true }],
	])('fails when the %s right-hand side drifts', async (name, options) => {
		const result = await runTypeDoc(pipelineSource(options));
		try {
			expect(result.status).not.toBe(0);
			expect(`${result.stdout}${result.stderr}`).toContain(
				`${name} must retain its exact compiler-derived right-hand side before projection`
			);
		} finally {
			await fs.rm(path.dirname(result.outputFile), {
				force: true,
				recursive: true,
			});
		}
	});
});
