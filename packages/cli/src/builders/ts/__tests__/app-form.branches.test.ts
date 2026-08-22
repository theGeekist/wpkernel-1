import path from 'node:path';
import * as ts from 'typescript';
import { createAppFormBuilder } from '../app-form';
import { makeIr } from '@cli-tests/ir.test-support';
import { makeWorkspaceMock } from '@cli-tests/workspace.test-support';
import {
	buildReporter,
	buildOutput,
} from '@cli-tests/builders/builder-harness.test-support';
import { buildEmptyGenerationState } from '../../../apply/manifest';

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

describe('app-form builder (branches)', () => {
	it('skips if phase is not generate', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr();

		await createAppFormBuilder().apply({
			input: {
				phase: 'init',
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
				phase: 'init',
				generationState: buildEmptyGenerationState(),
			},
			output,
			reporter,
		});

		expect(reporter.debug).toHaveBeenCalledWith(
			expect.stringContaining('skipping')
		);
		expect(writes).toHaveLength(0);
	});

	it('skips if artifacts missing', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr();
		(ir as any).artifacts = undefined;

		await createAppFormBuilder().apply({
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

		expect(reporter.debug).toHaveBeenCalledWith(
			expect.stringContaining('missing artifact plan')
		);
		expect(writes).toHaveLength(0);
	});

	it('skips resource if ui plan missing', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr({
			resources: [
				{
					name: 'test',
					id: 'test',
				} as any,
			],
		});
		// artifacts default to empty object in makeIr but explicit null helps
		ir.artifacts.surfaces = {};

		await createAppFormBuilder().apply({
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

		expect(reporter.debug).toHaveBeenCalledWith(
			expect.stringContaining('missing ui plan for test')
		);
		expect(writes).toHaveLength(0);
	});

	it('skips resource if generatedAppDir missing', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr({
			resources: [
				{
					name: 'test',
					id: 'test',
				} as any,
			],
		});
		ir.artifacts.surfaces = {
			test: {
				resource: 'test',
				modulePath: 'path',
				appDir: 'app',
				// generatedAppDir missing
			} as any,
		};

		await createAppFormBuilder().apply({
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

		expect(reporter.debug).toHaveBeenCalledWith(
			expect.stringContaining('missing ui dir for test')
		);
		expect(writes).toHaveLength(0);
	});

	it('generates form with wp-post fields (title, meta, taxonomies)', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr({
			resources: [
				{
					name: 'post',
					id: 'post',
					storage: {
						mode: 'wp-post',
						supports: ['title', 'editor', 'excerpt'],
						meta: {
							rating: { type: 'number' },
							isFeatured: { type: 'boolean' },
							subtitle: { type: 'string' },
						},
						taxonomies: {
							category: { taxonomy: 'category' },
							tags: {}, // implicit taxonomy name
						},
					},
				} as any,
			],
		});
		ir.artifacts.surfaces = {
			post: {
				resource: 'post',
				modulePath: 'path',
				appDir: 'app',
				generatedAppDir: 'generated/app',
			} as any,
		};

		await createAppFormBuilder().apply({
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

		expect(writes).toHaveLength(1);
		const content = writes[0]?.contents ?? '';
		expect(content).toContain("title: '',"); // default form
		expect(content).toContain("content: '',");
		expect(content).toContain("excerpt: '',");
		expect(content).toContain('rating: undefined,');
		expect(content).toContain('isFeatured: undefined,');
		expect(content).toContain('category: undefined,');
		expect(content).toContain('tags: undefined,');

		expect(content).toContain(
			"numberField<PostFormInput>('rating', { label: 'Rating', edit: 'integer' }),"
		);
		expect(content).toContain(
			"textField<PostFormInput>('isFeatured', { label: 'IsFeatured', edit: 'text' }),"
		);
		expect(content).toContain(
			"selectField<PostFormInput>('category', categoryOptions.options, { label: 'Category', edit: 'select' }),"
		);
		expect(content).toContain(
			"textField<PostFormInput>('content', { label: 'Content', edit: 'text' }),"
		);
		expect(content).toContain(
			"textField<PostFormInput>('excerpt', { label: 'Excerpt', edit: 'text' }),"
		);
		expect(content).toContain(
			'if (input.content !== undefined) payload.content = input.content;'
		);
		expect(content).toContain(
			'if (input.excerpt !== undefined) payload.excerpt = input.excerpt;'
		);
	});

	it('lets explicit meta status replace the implicit core status field', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr({
			resources: [
				{
					name: 'post',
					id: 'post',
					storage: {
						mode: 'wp-post',
						supports: ['title'],
						meta: {
							id: { type: 'string' },
							title: { type: 'string' },
							status: { type: 'string' },
							rating: { type: 'number' },
						},
						taxonomies: {
							statusTaxonomy: { taxonomy: 'status' },
							ratingTaxonomy: { taxonomy: 'rating' },
							category: { taxonomy: 'category' },
							categoryDuplicate: { taxonomy: 'category' },
						},
					},
				} as any,
			],
		});
		ir.artifacts.surfaces = {
			post: {
				resource: 'post',
				modulePath: 'path',
				appDir: 'app',
				generatedAppDir: 'generated/app',
			} as any,
		};

		await createAppFormBuilder().apply({
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
		expect(content.match(/status: undefined,/gu)).toHaveLength(1);
		expect(content).not.toContain("status: 'publish',");
		expect(content).not.toContain('meta.id');
		expect(content).not.toContain('meta.title');
		expect(content).toContain('meta.status = input.status;');
		expect(content).not.toContain('payload.status = input.status;');
		expect(content).not.toContain('statusField<PostFormInput>');
		expect(
			content.match(/textField<PostFormInput>\('status'/gu)
		).toHaveLength(1);
		expect(content).toContain('meta.rating = input.rating;');
		expect(content).toContain("useTaxonomyOptions('status.list')");
		expect(content).toContain("useTaxonomyOptions('rating.list')");
		expect(content).toContain(
			"selectField<PostFormInput>('statusTaxonomy', statusTaxonomyOptions.options, { label: 'Status', edit: 'select' }),"
		);
		expect(content).toContain(
			"selectField<PostFormInput>('ratingTaxonomy', ratingTaxonomyOptions.options, { label: 'Rating', edit: 'select' }),"
		);
		expect(
			content.match(/selectField<PostFormInput>\('category'/gu)
		).toHaveLength(1);
		expect(content.match(/category: undefined,/gu)).toHaveLength(1);
		expect(content.match(/payload\.category =/gu)).toHaveLength(1);
	});

	it('keeps taxonomy field keys separate from their taxonomy slugs', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr({
			resources: [
				{
					name: 'post',
					id: 'post',
					storage: {
						mode: 'wp-post',
						taxonomies: {
							departments: { taxonomy: 'acme_department' },
						},
					},
				} as any,
			],
		});
		ir.artifacts.surfaces = {
			post: {
				resource: 'post',
				modulePath: 'path',
				appDir: 'app',
				generatedAppDir: 'generated/app',
			} as any,
		};

		await createAppFormBuilder().apply({
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
		expect(content).toContain('departments?: number;');
		expect(content).toContain('departments: undefined,');
		expect(content).toContain(
			"const departmentsOptions = useTaxonomyOptions('acme-department.list');"
		);
		expect(content).toContain(
			"selectField<PostFormInput>('departments', departmentsOptions.options, { label: 'Department', edit: 'select' }),"
		);
		expect(content).toContain(
			'if (input.departments) payload.departments = [input.departments];'
		);
	});

	it('separates arbitrary data keys from collision-free generated bindings', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr({
			resources: [
				{
					name: 'post',
					id: 'post',
					storage: {
						mode: 'wp-post',
						meta: {
							"seo'title": { type: 'string' },
							['__proto__']: { type: 'string' },
						},
						taxonomies: {
							'book-genre': { taxonomy: 'book_genre' },
							'book genre': { taxonomy: 'book_topic' },
							'123': { taxonomy: 'numeric_topic' },
							"critic's-choice": { taxonomy: 'critic_choice' },
						},
					},
				} as any,
			],
		});
		ir.artifacts.surfaces = {
			post: {
				resource: 'post',
				modulePath: 'path',
				appDir: 'app',
				generatedAppDir: 'generated/app',
			} as any,
		};

		await createAppFormBuilder().apply({
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
		expect(content).toContain("'seo\\'title'?: string;");
		expect(content).toContain("'__proto__'?: string;");
		expect(content).toContain("'book-genre'?: number;");
		expect(content).toContain("'book genre'?: number;");
		expect(content).toContain("'123'?: number;");
		expect(content).toContain("'critic\\'s-choice'?: number;");
		expect(content).toContain("'seo\\'title': undefined,");
		expect(content).toContain("['__proto__']: undefined,");
		expect(content).toContain("'book-genre': undefined,");
		expect(content).toContain(
			"if (input['seo\\'title'] !== undefined) meta['seo\\'title'] = input['seo\\'title'];"
		);
		expect(content).toContain(
			"if (input['book-genre']) payload['book-genre'] = [input['book-genre']];"
		);
		expect(content).toContain(
			"if (input['__proto__'] !== undefined) Object.defineProperty(meta, '__proto__', { configurable: true, enumerable: true, value: input['__proto__'], writable: true });"
		);
		expect(content).not.toContain('meta.__proto__');
		expect(content).not.toContain('payload.__proto__');
		expect(content).toContain(
			"const bookGenreOptions = useTaxonomyOptions('book-genre.list');"
		);
		expect(content).toContain(
			"const bookGenreOptions2 = useTaxonomyOptions('book-topic.list');"
		);
		expect(content).toContain(
			"const taxonomy123Options = useTaxonomyOptions('numeric-topic.list');"
		);
		expect(content).toContain(
			"selectField<PostFormInput>('book-genre', bookGenreOptions.options, { label: 'Book Genre', edit: 'select' }),"
		);
		expect(content).toContain(
			"selectField<PostFormInput>('book genre', bookGenreOptions2.options, { label: 'Book Topic', edit: 'select' }),"
		);
		expect(content).toContain(
			"selectField<PostFormInput>('123', taxonomy123Options.options, { label: 'Numeric Topic', edit: 'select' }),"
		);
		expect(content).toContain(
			"selectField<PostFormInput>('critic\\'s-choice', criticSChoiceOptions.options, { label: 'Critic Choice', edit: 'select' }),"
		);
		expect(content).toContain('bookGenreOptions.options,');
		expect(content).toContain('bookGenreOptions2.options,');
		expect(content).toContain('taxonomy123Options.options,');

		const transpiled = ts.transpileModule(content, {
			fileName: 'PostForm.tsx',
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

	it('uses the resource GET route when loading an edit record', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr({
			resources: [
				{
					name: 'post',
					id: 'post',
					identity: { type: 'string', param: 'uuid' },
					routes: [
						{
							method: 'GET',
							path: '/acme/v1/posts/:uuid',
						},
					],
					storage: { mode: 'wp-post' },
				} as any,
			],
		});
		ir.artifacts.surfaces = {
			post: {
				resource: 'post',
				modulePath: 'path',
				appDir: 'app',
				generatedAppDir: 'generated/app',
			} as any,
		};

		await createAppFormBuilder().apply({
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

		expect(writes[0]?.contents).toContain(
			'const fetchPath = `/acme/v1/posts/${editId}`;'
		);
	});

	it('does not generate item actions or a fallback fetch URL for a list-only resource', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr({
			resources: [
				{
					name: 'post',
					id: 'post',
					identity: { type: 'string', param: 'uuid' },
					routes: [
						{ method: 'GET', path: '/acme/v1/posts' },
						{ method: 'POST', path: '/acme/v1/posts' },
					],
					storage: { mode: 'wp-post' },
				} as any,
			],
		});
		ir.artifacts.surfaces = {
			post: {
				resource: 'post',
				modulePath: 'path',
				appDir: 'app',
				generatedAppDir: 'generated/app',
			} as any,
		};

		await createAppFormBuilder().apply({
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
		expect(content).not.toContain('quick-edit');
		expect(content).not.toContain('const fetchPath');
		expect(content).toContain(
			'Editing is not available for this resource.'
		);
		const transpiled = ts.transpileModule(content, {
			fileName: 'PostForm.tsx',
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

	it('throws instead of reporting a successful create when create is unavailable', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr({
			resources: [
				{
					name: 'post',
					id: 'post',
					routes: [{ method: 'GET', path: '/acme/v1/posts' }],
					storage: { mode: 'wp-post' },
				} as any,
			],
		});
		ir.artifacts.surfaces = {
			post: {
				resource: 'post',
				modulePath: 'path',
				appDir: 'app',
				generatedAppDir: 'generated/app',
			} as any,
		};

		await createAppFormBuilder().apply({
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
		expect(content).toContain("mode === 'create' && !mutate.create");
		expect(content).toContain("mode === 'update' && !mutate.update");
		expect(content).not.toContain('mutate.create?.');
		expect(content).not.toContain('mutate.update?.');
	});

	it('generates form without wp-post fields', async () => {
		const { workspace, writes } = buildWorkspace();
		const reporter = buildReporter();
		const output = buildOutput();
		const ir = makeIr({
			resources: [
				{
					name: 'simple',
					id: 'simple',
					storage: {
						mode: 'custom', // Not wp-post
					},
				} as any,
			],
		});
		ir.artifacts.surfaces = {
			simple: {
				resource: 'simple',
				modulePath: 'path',
				appDir: 'app',
				generatedAppDir: 'generated/app',
			} as any,
		};

		await createAppFormBuilder().apply({
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

		expect(writes).toHaveLength(1);
		const content = writes[0]?.contents ?? '';
		expect(content).not.toContain("title: '',");
		expect(content).not.toContain('status:');
	});
});
