import path from 'node:path';
import type { ResourceStorageConfig } from '@wpkernel/core/resource';
import { buildPhpPrettyPrinter, type PhpProgram } from '@wpkernel/php-json-ast';

import {
	buildCreateRouteStatements,
	buildUpdateRouteStatements,
	buildDeleteRouteStatements,
	type BuildCreateRouteStatementsOptions,
} from '..';
import type { MutationMetadataKeys } from '../../../mutation';

type WpPostStorage = Extract<ResourceStorageConfig, { mode: 'wp-post' }>;

describe('wp-post mutation route builders', () => {
	const phpJsonAstRoot = path.resolve(
		__dirname,
		'../../../../../../../php-json-ast'
	);
	const prettyPrinter = buildPhpPrettyPrinter({
		workspace: {
			root: phpJsonAstRoot,
			resolve: (...parts: string[]) =>
				path.resolve(phpJsonAstRoot, ...parts),
			exists: async () => true,
		},
	});
	const metadataKeys: MutationMetadataKeys = {
		cacheSegment: 'cache:wp-post',
		channelTag: 'resource.wpPost.mutation',
		statusValidation: 'mutation:status',
		syncMeta: 'mutation:meta',
		syncTaxonomies: 'mutation:taxonomies',
		cachePriming: 'mutation:cache',
	};

	const storage: WpPostStorage = {
		mode: 'wp-post',
		postType: 'book',
		statuses: ['draft', 'publish'],
		supports: ['title', 'editor'],
		meta: {
			subtitle: { type: 'string' },
		},
		taxonomies: {
			category: { taxonomy: 'category' },
		},
	};

	const resource: BuildCreateRouteStatementsOptions['resource'] = {
		name: 'book',
		storage,
	};

	const identity = { type: 'number', param: 'id' } as const;
	const pascalName = 'Book';

	it('emits create route statements with macros in expected order', () => {
		const statements = buildCreateRouteStatements({
			resource,
			pascalName,
			metadataKeys,
		});

		expect(statements).not.toBeNull();

		const metadataStatements = (statements ?? []).filter(
			(statement) => statement.nodeType === 'Stmt_Nop'
		);

		expect(metadataStatements).toHaveLength(9);
		expect(statements).toMatchSnapshot('create-route-statements');
	});

	it('emits update route statements with guarded status macro', () => {
		const statements = buildUpdateRouteStatements({
			resource,
			pascalName,
			metadataKeys,
			identity,
		});

		expect(statements).not.toBeNull();
		expect(statements).toMatchSnapshot('update-route-statements');
	});

	it('prints configured core post field mappings for create and update', async () => {
		const coreFieldResource: BuildCreateRouteStatementsOptions['resource'] =
			{
				name: 'book',
				storage: {
					...storage,
					supports: ['title', 'editor', 'excerpt'],
				},
			};
		const createStatements =
			buildCreateRouteStatements({
				resource: coreFieldResource,
				pascalName,
				metadataKeys,
			}) ?? [];
		const updateStatements =
			buildUpdateRouteStatements({
				resource: coreFieldResource,
				pascalName,
				metadataKeys,
				identity,
			}) ?? [];
		const [create, update] = await Promise.all([
			prettyPrinter.prettyPrint({
				filePath: 'create-core-fields.php',
				program: createStatements as PhpProgram,
			}),
			prettyPrinter.prettyPrint({
				filePath: 'update-core-fields.php',
				program: updateStatements as PhpProgram,
			}),
		]);

		expect(create.code).toContain(
			"$post_data['post_title'] = $request->get_param('title');"
		);
		expect(create.code).toContain(
			"$post_data['post_content'] = $request->get_param('content');"
		);
		expect(create.code).toContain(
			"$post_data['post_excerpt'] = $request->get_param('excerpt');"
		);
		expect(update.code).toContain(
			"if (null !== $title) {\n    $post_data['post_title'] = $title;\n}"
		);
		expect(update.code).toContain(
			"if (null !== $content) {\n    $post_data['post_content'] = $content;\n}"
		);
		expect(update.code).toContain(
			"if (null !== $excerpt) {\n    $post_data['post_excerpt'] = $excerpt;\n}"
		);
		expect({
			create: create.code,
			update: update.code,
		}).toMatchSnapshot('core-post-fields-printed-php');
	});

	it('emits delete route statements with previous response payload', () => {
		const statements = buildDeleteRouteStatements({
			resource,
			pascalName,
			metadataKeys,
			identity,
		});

		expect(statements).not.toBeNull();
		expect(statements).toMatchSnapshot('delete-route-statements');
	});
});
