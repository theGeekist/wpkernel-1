import {
	buildArg,
	buildAssign,
	buildExpressionStatement,
	buildIdentifier,
	buildIfStatement,
	buildMethodCall,
	buildNull,
	buildScalarString,
	buildVariable,
	type PhpStmt,
} from '@wpkernel/php-json-ast';
import type { ResourceStorageConfig } from '@wpkernel/core/resource';
import type { MutationHelperResource } from '../../mutation';
import {
	buildArrayDimFetch,
	buildBinaryOperation,
} from '../../../common/utils';
import { toSnakeCase } from '../../query/utils';

type WpPostStorage = Extract<ResourceStorageConfig, { mode: 'wp-post' }>;

const CORE_POST_FIELDS = [
	{
		support: 'title',
		requestParam: 'title',
		postField: 'post_title',
	},
	{
		support: 'editor',
		requestParam: 'content',
		postField: 'post_content',
	},
	{
		support: 'excerpt',
		requestParam: 'excerpt',
		postField: 'post_excerpt',
	},
] as const satisfies readonly {
	readonly support: NonNullable<WpPostStorage['supports']>[number];
	readonly requestParam: string;
	readonly postField: string;
}[];

/**
 * Builds assignments from configured REST resource fields to WordPress core
 * post fields.
 *
 * @param    options                    - Core-field mapping options.
 * @param    options.resource           - Resource containing wp-post supports.
 * @param    options.guardWithNullCheck - Whether to omit absent request values.
 * @category WordPress AST
 */
export function buildCorePostFieldStatements(options: {
	readonly resource: MutationHelperResource;
	readonly guardWithNullCheck?: boolean;
}): PhpStmt[] {
	const storage = options.resource.storage;
	if (!storage || storage.mode !== 'wp-post') {
		return [];
	}

	const supports = new Set(storage.supports ?? []);

	return CORE_POST_FIELDS.flatMap((field) => {
		if (!supports.has(field.support)) {
			return [];
		}

		const requestValue = buildMethodCall(
			buildVariable('request'),
			buildIdentifier('get_param'),
			[buildArg(buildScalarString(field.requestParam))]
		);
		const target = buildArrayDimFetch(
			'post_data',
			buildScalarString(field.postField)
		);
		const assignment = (value: ReturnType<typeof buildVariable>) =>
			buildExpressionStatement(buildAssign(target, value));

		if (!options.guardWithNullCheck) {
			return [
				buildExpressionStatement(buildAssign(target, requestValue)),
			];
		}

		const value = buildVariable(field.requestParam);
		return [
			buildExpressionStatement(buildAssign(value, requestValue)),
			buildIfStatement(
				buildBinaryOperation('NotIdentical', buildNull(), value),
				[assignment(value)]
			),
		];
	});
}

/**
 * @param    resourceName
 * @category WordPress AST
 */
export function makeErrorCodeFactory(
	resourceName: string
): (suffix: string) => string {
	const base = toSnakeCase(resourceName) || 'resource';
	return (suffix: string) => `wpk_${base}_${suffix}`;
}
