import path from 'node:path';
import * as ts from 'typescript';
import { makeIr } from '@cli-tests/ir.test-support';
import { makeWorkspaceMock } from '@cli-tests/workspace.test-support';
import {
	buildReporter,
	buildOutput,
} from '@cli-tests/builders/builder-harness.test-support';
import { createTsTypesBuilder } from '../ts.types';
import { buildEmptyGenerationState } from '../../../apply/manifest';

const baseResource = {
	id: 'res:article',
	name: 'article',
	schemaKey: 'article',
	schemaProvenance: 'manual',
	routes: [],
	cacheKeys: { list: { segments: [], source: 'default' } } as any,
	hash: { algo: 'sha256', inputs: [], value: 'article' },
	warnings: [],
} as any;

function buildWorkspace() {
	const writes: Array<{ file: string; contents: string }> = [];
	const workspace = makeWorkspaceMock({
		write: async (
			file: string,
			data: string | Buffer,
			_options?: unknown
		) => {
			writes.push({ file, contents: String(data) });
		},
		resolve: (...parts: string[]) => path.join(process.cwd(), ...parts),
	});
	return { workspace, writes };
}

describe('ts.types builder branch coverage', () => {
	it('emits post supports, custom statuses, meta arrays, and taxonomies', async () => {
		const ir = makeIr();
		const resource = {
			...baseResource,
			storage: {
				mode: 'wp-post',
				postType: 'article',
				supports: ['title', 'editor', 'excerpt'],
				meta: {
					tags: { type: 'string', single: false },
					featured: { type: 'boolean' },
					'seo-title': { type: 'string' },
					"editor's note": { type: 'string' },
					'123': { type: 'number' },
					['__proto__']: { type: 'boolean' },
				},
				taxonomies: {
					departments: { taxonomy: 'acme_department' },
					'book-genre': { taxonomy: 'book_genre' },
					'book genre': { taxonomy: 'book_topic' },
				},
				statuses: ['draft', 'published'],
			},
			identity: { type: 'number', param: "post'id" },
		};
		ir.resources = [resource];
		ir.schemas.push({
			id: 'some',
			provenance: 'auto',
			key: resource.schemaKey,
			hash: { algo: 'sha256', inputs: [], value: 'schema' },
			schema: { type: 'object', properties: {} },
			sourcePath: 'schema.json',
			// warnings: [],
			// source: 'config',
		});
		ir.artifacts.schemas[resource.schemaKey] = {
			// schemaPath: 'schema.json',
			typeDefPath: `/generated/types/${resource.name}.d.ts`,
			// typeSource: 'inferred',
		};
		ir.artifacts.resources[resource.id] = {
			modulePath: '',
			typeDefPath: `/generated/types/${resource.name}.d.ts`,
			typeSource: 'inferred',
		};

		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();

		await createTsTypesBuilder().apply(
			{
				input: {
					phase: 'generate',
					options: {
						origin: 'wpk.config.ts',
						sourcePath: 'wpk.config.ts',
						namespace: ir.meta.namespace,
					},
					ir,
				},
				context: {
					workspace,
					reporter,
					phase: 'generate',
					generationState: buildEmptyGenerationState(),
				},
				output,
				reporter,
			},
			undefined
		);

		const dts = writes.find((w) =>
			w.file.endsWith('article.d.ts')
		)?.contents;
		expect(dts).toBeDefined();
		expect(dts).toContain('title');
		expect(dts).toContain('content');
		expect(dts).toContain('excerpt');
		expect(dts).toContain(
			"status: 'draft' | 'published' | 'trash' | 'auto-draft'"
		);
		expect(dts).toContain('tags?: string[]');
		expect(dts).toContain('featured?: boolean');
		expect(dts).toContain('departments?: number | number[]');
		expect(dts).toContain('departments?: number[]');
		expect(dts).not.toContain('acme_department?:');
		expect(dts).toContain("'post\\'id': number;");
		expect(dts).toContain("'seo-title'?: string;");
		expect(dts).toContain("'editor\\'s note'?: string;");
		expect(dts).toContain("'123'?: number;");
		expect(dts).toContain("'__proto__'?: boolean;");
		expect(dts).toContain("'book-genre'?: number | number[];");
		expect(dts).toContain("'book-genre'?: number[];");
		expect(dts).toContain("'book genre'?: number | number[];");
		expect(dts).toContain("'book genre'?: number[];");
		expect(getDeclarationDiagnostics(dts ?? '')).toEqual([]);
	});

	it.each(['wp-post', 'wp-taxonomy'] as const)(
		'emits a designated %s slug identity exactly once',
		async (mode) => {
			const ir = makeIr();
			const resource = {
				...baseResource,
				storage:
					mode === 'wp-post'
						? { mode: 'wp-post', postType: 'article' }
						: { mode: 'wp-taxonomy' },
				identity: { type: 'string', param: 'slug' },
			};
			ir.resources = [resource];
			ir.schemas.push({
				id: 'some',
				provenance: 'auto',
				key: resource.schemaKey,
				hash: { algo: 'sha256', inputs: [], value: 'schema' },
				schema: { type: 'object', properties: {} },
				sourcePath: 'schema.json',
			});
			ir.artifacts.schemas[resource.schemaKey] = {
				typeDefPath: `/generated/types/${resource.name}.d.ts`,
			};
			ir.artifacts.resources[resource.id] = {
				modulePath: '',
				typeDefPath: `/generated/types/${resource.name}.d.ts`,
				typeSource: 'inferred',
			};

			const { workspace, writes } = buildWorkspace();
			const reporter = buildReporter();
			const output = buildOutput();
			await createTsTypesBuilder().apply(
				{
					input: {
						phase: 'generate',
						options: {
							origin: 'wpk.config.ts',
							sourcePath: 'wpk.config.ts',
							namespace: ir.meta.namespace,
						},
						ir,
					},
					context: {
						workspace,
						reporter,
						phase: 'generate',
						generationState: buildEmptyGenerationState(),
					},
					output,
					reporter,
				},
				undefined
			);

			const dts = writes[0]?.contents ?? '';
			expect(dts.match(/\bslug: string;/gu)).toHaveLength(1);
			expect(getDeclarationDiagnostics(dts)).toEqual([]);
		}
	);
});

function getDeclarationDiagnostics(source: string): readonly ts.Diagnostic[] {
	const fileName = 'article.d.ts';
	const compilerOptions: ts.CompilerOptions = {
		noEmit: true,
		skipLibCheck: true,
		strict: true,
	};
	const defaultHost = ts.createCompilerHost(compilerOptions);
	const sourceFile = ts.createSourceFile(
		fileName,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
	const host: ts.CompilerHost = {
		...defaultHost,
		fileExists: (requestedFile) =>
			requestedFile === fileName || defaultHost.fileExists(requestedFile),
		getSourceFile: (requestedFile, languageVersion) =>
			requestedFile === fileName
				? sourceFile
				: defaultHost.getSourceFile(requestedFile, languageVersion),
		readFile: (requestedFile) =>
			requestedFile === fileName
				? source
				: defaultHost.readFile(requestedFile),
	};
	const program = ts.createProgram([fileName], compilerOptions, host);
	return ts
		.getPreEmitDiagnostics(program)
		.filter((diagnostic) => diagnostic.file?.fileName === fileName);
}
