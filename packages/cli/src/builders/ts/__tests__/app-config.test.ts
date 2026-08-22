import path from 'node:path';
import * as ts from 'typescript';
import { makeIr } from '@cli-tests/ir.test-support';
import { makeWorkspaceMock } from '@cli-tests/workspace.test-support';
import { makeResource } from '@cli-tests/builders/fixtures.test-support';
import {
	buildReporter,
	buildOutput,
} from '@cli-tests/builders/builder-harness.test-support';
import { createAppConfigBuilder } from '../app-config';
import { buildEmptyGenerationState } from '../../../apply/manifest';

function buildWorkspace() {
	const writes: Array<{ file: string; contents: string }> = [];
	const workspace = makeWorkspaceMock({
		write: async (file: string, contents: string | Buffer) => {
			writes.push({ file, contents: String(contents) });
		},
		resolve: (...parts: string[]) => path.join(process.cwd(), ...parts),
	});
	return { workspace, writes };
}

describe('app-config builder', () => {
	it('skips when not in generate phase', async () => {
		const ir = makeIr();
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();

		await createAppConfigBuilder().apply(
			{
				input: {
					phase: 'apply',
					options: {
						namespace: ir.meta.namespace,
						origin: ir.meta.origin,
						sourcePath: ir.meta.sourcePath,
					},
					ir,
				},
				context: {
					workspace,
					reporter,
					phase: 'apply',
					generationState: buildEmptyGenerationState(),
				},
				output,
				reporter,
			},
			undefined
		);

		expect(writes).toHaveLength(0);
	});

	it('skips when ui plan missing', async () => {
		const ir = makeIr();
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();

		await createAppConfigBuilder().apply(
			{
				input: {
					phase: 'generate',
					options: {
						namespace: ir.meta.namespace,
						origin: ir.meta.origin,
						sourcePath: ir.meta.sourcePath,
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

		expect(writes).toHaveLength(0);
	});

	it('writes config when ui plan exists', async () => {
		const ir = makeIr();
		const resource = makeResource({
			name: 'job',
			storage: {
				mode: 'wp-post',
				supports: ['title'],
				meta: {
					rating: { type: 'number' },
				},
				taxonomies: {
					departments: { taxonomy: 'acme_department' },
				},
			} as any,
		});
		ir.resources = [resource];
		ir.artifacts.surfaces[resource.id] = {
			resource: resource.name,
			appDir: `/app/${resource.name}`,
			generatedAppDir: `/generated/app/${resource.name}`,
			pagePath: '',
			formPath: '',
			configPath: '',
		};
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();

		await createAppConfigBuilder().apply(
			{
				input: {
					phase: 'generate',
					options: {
						namespace: ir.meta.namespace,
						origin: ir.meta.origin,
						sourcePath: ir.meta.sourcePath,
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

		const configWrite = writes.find((w) => w.file.endsWith('config.tsx'));
		expect(configWrite).toBeDefined();
		expect(configWrite?.contents).toContain("id: 'title'");
		expect(configWrite?.contents).toContain("id: 'rating'");
		expect(configWrite?.contents).toContain("id: 'departments'");
		expect(configWrite?.contents).toContain('item.departments');
		expect(configWrite?.contents).toMatch(
			/defaultView: \{[\s\S]*fields: \[[\s\S]*'departments'/u
		);
	});

	it('deduplicates core, meta, and taxonomy DataViews fields', async () => {
		const ir = makeIr();
		const resource = makeResource({
			name: 'application',
			storage: {
				mode: 'wp-post',
				meta: {
					status: { type: 'string' },
					id: { type: 'string' },
					priority: { type: 'integer' },
				},
				taxonomies: {
					status: { taxonomy: 'status' },
					priority: { taxonomy: 'priority' },
				},
			} as any,
		});
		ir.resources = [resource];
		ir.artifacts.surfaces[resource.id] = {
			resource: resource.name,
			appDir: `/app/${resource.name}`,
			generatedAppDir: `/generated/app/${resource.name}`,
			pagePath: '',
			formPath: '',
			configPath: '',
		};
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();

		await createAppConfigBuilder().apply({
			input: {
				phase: 'generate',
				options: {
					namespace: ir.meta.namespace,
					origin: ir.meta.origin,
					sourcePath: ir.meta.sourcePath,
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
		});

		const content = writes[0]?.contents ?? '';
		expect(content.match(/id: 'status'/gu)).toHaveLength(1);
		expect(content.match(/id: 'priority'/gu)).toHaveLength(1);
		expect(content.match(/'status'/gu)).toHaveLength(2);
		expect(content.match(/'priority'/gu)).toHaveLength(2);
	});

	it('emits valid config source for arbitrary authoritative keys', async () => {
		const ir = makeIr();
		(ir.meta as { namespace: string }).namespace = "vendor's\\domain\n";
		const resource = makeResource({
			name: 'article',
			storage: {
				mode: 'wp-post',
				meta: {
					"editor's note": { type: 'string' },
					'123': { type: 'number' },
					['__proto__']: { type: 'string' },
				},
				taxonomies: {
					"critic's-choice": { taxonomy: "writer's tags" },
					'punctuation.key': { taxonomy: 'punctuation.key' },
				},
			} as any,
		});
		ir.resources = [resource];
		ir.artifacts.surfaces[resource.id] = {
			resource: resource.name,
			appDir: `/app/${resource.name}`,
			generatedAppDir: `/generated/app/${resource.name}`,
			pagePath: '',
			formPath: '',
			configPath: '',
		};
		const { workspace, writes } = buildWorkspace();

		await createAppConfigBuilder().apply({
			input: {
				phase: 'generate',
				options: {
					namespace: ir.meta.namespace,
					origin: ir.meta.origin,
					sourcePath: ir.meta.sourcePath,
				},
				ir,
			},
			context: {
				workspace,
				reporter: buildReporter(),
				phase: 'generate',
				generationState: buildEmptyGenerationState(),
			},
			output: buildOutput(),
			reporter: buildReporter(),
		});

		const content = writes[0]?.contents ?? '';
		expect(content).toContain("id: 'editor\\'s note'");
		expect(content).toContain(
			"label: __('Editor\\'s note', 'vendor\\'s\\\\domain\\n')"
		);
		expect(content).toContain("item['critic\\'s-choice']");
		expect(content).toContain("id: '__proto__'");
		expect(content).toContain(
			"fields: ['123', 'editor\\'s note', '__proto__'"
		);

		const transpiled = ts.transpileModule(content, {
			fileName: 'config.tsx',
			compilerOptions: {
				jsx: ts.JsxEmit.ReactJSX,
				target: ts.ScriptTarget.ES2022,
			},
			reportDiagnostics: true,
		});
		expect(
			(transpiled.diagnostics ?? []).filter(
				(diagnostic) =>
					diagnostic.category === ts.DiagnosticCategory.Error
			)
		).toEqual([]);
	});

	it('handles resources without storage gracefully', async () => {
		const ir = makeIr();
		const resource = makeResource({ name: 'ghost', storage: undefined });
		ir.resources = [resource];
		ir.artifacts.surfaces[resource.id] = {
			appDir: '',
			resource: resource.name,
			generatedAppDir: `/generated/app/${resource.name}`,
			pagePath: '',
			formPath: '',
			configPath: '',
		};
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();

		await createAppConfigBuilder().apply(
			{
				input: {
					phase: 'generate',
					options: {
						namespace: ir.meta.namespace,
						origin: ir.meta.origin,
						sourcePath: ir.meta.sourcePath,
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

		const configWrite = writes.find((w) => w.file.endsWith('config.tsx'));
		expect(configWrite).toBeDefined();
	});
});
