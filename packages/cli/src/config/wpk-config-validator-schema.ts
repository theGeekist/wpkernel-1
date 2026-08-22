import * as t from 'typanion';

const httpMethodValidator = t.isEnum([
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
] as const);

const functionValidator = t.makeValidator<
	unknown,
	(...args: unknown[]) => unknown
>({
	test: (value): value is (...args: unknown[]) => unknown =>
		typeof value === 'function',
});

const resourceRouteValidator = t.isObject(
	{
		path: t.isString(),
		method: httpMethodValidator,
		capability: t.isOptional(t.isString()),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const resourceRouteOperations = [
	'list',
	'get',
	'create',
	'update',
	'remove',
] as const;

/**
 * Typanion validator for resource routes.
 *
 * Ensures that a resource defines at least one route operation (list, get,
 * create, update, or remove).
 *
 * @category Config
 */
export const resourceRoutesValidator = t.cascade(
	t.isObject(
		{
			list: t.isOptional(resourceRouteValidator),
			get: t.isOptional(resourceRouteValidator),
			create: t.isOptional(resourceRouteValidator),
			update: t.isOptional(resourceRouteValidator),
			remove: t.isOptional(resourceRouteValidator),
		},
		{ extra: t.isRecord(t.isUnknown()) }
	),
	(value, state) => {
		const hasRoute = resourceRouteOperations.some(
			(operation) => typeof value[operation] !== 'undefined'
		);
		if (!hasRoute) {
			state?.errors?.push(
				'resources[].routes must define at least one operation.'
			);
			return false;
		}
		return true;
	}
);

const identityNumberValidator = t.isObject(
	{
		type: t.isLiteral('number'),
		param: t.isOptional(t.isLiteral('id')),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const identityStringValidator = t.isObject(
	{
		type: t.isLiteral('string'),
		param: t.isOptional(t.isEnum(['id', 'slug', 'uuid'] as const)),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const resourceIdentityValidator = t.isOptional(
	t.isOneOf([identityNumberValidator, identityStringValidator])
);

const storageTransientValidator = t.isObject(
	{
		mode: t.isLiteral('transient'),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const storagePostMetaValidator = t.isObject(
	{
		type: t.isEnum([
			'string',
			'integer',
			'number',
			'boolean',
			'array',
			'object',
		] as const),
		single: t.isOptional(t.isBoolean()),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const storagePostTaxonomyValidator = t.isObject(
	{
		taxonomy: t.isString(),
		hierarchical: t.isOptional(t.isBoolean()),
		register: t.isOptional(t.isBoolean()),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const storagePostValidator = t.isObject(
	{
		mode: t.isLiteral('wp-post'),
		postType: t.isOptional(t.isString()),
		statuses: t.isOptional(t.isArray(t.isString())),
		supports: t.isOptional(
			t.isArray(
				t.isEnum([
					'title',
					'editor',
					'excerpt',
					'custom-fields',
				] as const)
			)
		),
		meta: t.isOptional(t.isRecord(storagePostMetaValidator)),
		taxonomies: t.isOptional(t.isRecord(storagePostTaxonomyValidator)),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const storageTaxonomyValidator = t.isObject(
	{
		mode: t.isLiteral('wp-taxonomy'),
		taxonomy: t.isString(),
		hierarchical: t.isOptional(t.isBoolean()),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const storageOptionValidator = t.isObject(
	{
		mode: t.isLiteral('wp-option'),
		option: t.isString(),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const resourceStorageValidator = t.isOptional(
	t.isOneOf([
		storageTransientValidator,
		storagePostValidator,
		storageTaxonomyValidator,
		storageOptionValidator,
	])
);

const schemaConfigValidator = t.isObject(
	{
		path: t.isString(),
		description: t.isOptional(t.isString()),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const adaptersValidator = t.isObject(
	{
		php: t.isOptional(
			t.makeValidator<unknown, (...args: unknown[]) => unknown>({
				test: (value): value is (...args: unknown[]) => unknown =>
					typeof value === 'function',
			})
		),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const readinessConfigValidator = t.isObject(
	{
		helpers: t.isOptional(t.isArray(functionValidator)),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const resourceAdminUIValidator = t.isObject(
	{
		view: t.isOptional(t.isString()),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const resourceUIValidator = t.isObject(
	{
		admin: t.isOptional(resourceAdminUIValidator),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const resourceBlocksModeValidator = t.isEnum(['js', 'ssr']);

const resourceBlocksConfigValidator = t.isObject(
	{
		mode: t.isOptional(resourceBlocksModeValidator),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

const resourceConfigValidator = t.isObject(
	{
		name: t.isString(),
		routes: resourceRoutesValidator,
		identity: resourceIdentityValidator,
		storage: resourceStorageValidator,
		queryParams: t.isOptional(t.isRecord(t.isUnknown())),
		namespace: t.isOptional(t.isString()),
		schema: t.isOptional(
			t.isOneOf([t.isString(), t.isRecord(t.isUnknown())])
		),
		ui: t.isOptional(resourceUIValidator),
		blocks: t.isOptional(resourceBlocksConfigValidator),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);

export const wpkConfigValidator = t.isObject(
	{
		version: t.isOptional(t.isLiteral(1)),
		namespace: t.isString(),
		directories: t.isOptional(
			t.isRecord(t.isString(), {
				keys: t.isOneOf([
					t.isLiteral('blocks'),
					t.isLiteral('blocks.applied'),
					t.isLiteral('controllers'),
					t.isLiteral('controllers.applied'),
					t.isLiteral('plugin'),
					t.isLiteral('plugin.loader'),
				]),
			})
		),
		schemas: t.isRecord(schemaConfigValidator),
		resources: t.isRecord(resourceConfigValidator),
		adapters: t.isOptional(adaptersValidator),
		readiness: t.isOptional(readinessConfigValidator),
	},
	{ extra: t.isRecord(t.isUnknown()) }
);
