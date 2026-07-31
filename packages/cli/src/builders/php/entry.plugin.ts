import path from 'node:path';
import { createHelper } from '../../runtime';
import type { BuilderApplyOptions, BuilderHelper } from '../../runtime/types';
import {
	AUTO_GUARD_BEGIN,
	buildPluginLoaderProgram,
	buildProgramTargetPlanner,
	getPhpBuilderChannel,
} from '@wpkernel/wp-json-ast';
import { buildUiConfig } from './pluginLoader.ui';
import { toPascalCase } from '../../utils';
import {
	type ContentModel,
	type PostTypesMap,
	type TaxonomiesMap,
	type StatusesMap,
	type Resource,
	type WpPostStorage,
	type WpTaxonomyStorage,
} from './types';
import { type IRSurfacePlan } from '../../ir/publicTypes';
/**
 * Creates a PHP builder helper for generating the main plugin loader file (`plugin.php`).
 *
 * This helper generates the primary entry point for the WordPress plugin,
 * which includes and initializes all other generated PHP components.
 * It also checks for an existing `plugin.php` to avoid overwriting user-owned files.
 *
 * @category AST Builders
 * @returns A `BuilderHelper` instance for generating the plugin loader file.
 */
export function createPhpPluginLoaderHelper(): BuilderHelper {
	return createHelper({
		key: 'builder.generate.php.plugin-loader',
		kind: 'builder',
		dependsOn: [
			'builder.generate.php.channel.bootstrap',
			'builder.generate.php.controller.resources',
			'builder.generate.php.capability',
			'builder.generate.php.registration.persistence',
			'ir.resources.core',
			'ir.capability-map.core',
			'ir.layout.core',
			'ir.artifacts.plan',
		],
		async apply(options: BuilderApplyOptions) {
			const { input, context, reporter } = options;
			if (!canGeneratePluginLoader(input)) {
				return;
			}

			const ir = input.ir;
			const phpPlan = ir.artifacts?.php;
			if (!phpPlan) {
				reporter.debug(
					'createPhpPluginLoaderHelper: missing PHP artifacts plan; skipping.'
				);
				return;
			}

			await generatePluginLoader({
				ir,
				phpPlan,
				context,
				reporter,
			});
		},
	});
}

type UiConfig = ReturnType<typeof buildUiConfig>;
type PluginLoaderControllerPlan = {
	readonly className: string;
	readonly appliedRequirePath: string;
};

export type GeneratePhaseInput = BuilderApplyOptions['input'] & {
	phase: 'generate';
	ir: NonNullable<BuilderApplyOptions['input']['ir']>;
};

async function generatePluginLoader(options: {
	readonly ir: GeneratePhaseInput['ir'];
	readonly phpPlan: NonNullable<GeneratePhaseInput['ir']['artifacts']['php']>;
	readonly context: BuilderApplyOptions['context'];
	readonly reporter: BuilderApplyOptions['reporter'];
}): Promise<void> {
	const { ir, phpPlan, context, reporter } = options;

	// Surfaces should already be planned at IR level; don’t reach into raw config.
	const surfaces = Object.values(ir.artifacts.surfaces ?? {});
	const uiConfig: UiConfig = buildUiConfig(ir);

	const resourceControllers = buildResourceControllers(ir, phpPlan);
	const resourceClassNames = resourceControllers.map(
		(controller) => controller.className
	);
	const phpGeneratedRoot = resolvePhpGeneratedRoot(ir, phpPlan);

	await writeDebugUiFile({
		workspace: context.workspace,
		ir,
		surfaces,
		uiConfig,
		phpPlan,
	});

	if (
		await pluginLoaderIsUserOwned({
			workspace: context.workspace,
			reporter,
			pluginLoaderPath: phpPlan.pluginLoaderPath,
		})
	) {
		return;
	}

	const loaderConfig = buildLoaderConfig({
		ir,
		resourceClassNames,
		resourceControllers,
		uiConfig,
		phpPlan,
		phpGeneratedRoot,
	});

	const program = buildPluginLoaderProgram(loaderConfig);
	const pluginRootDir = phpGeneratedRoot;

	const planner = buildProgramTargetPlanner({
		workspace: context.workspace,
		outputDir: pluginRootDir,
		channel: getPhpBuilderChannel(context),
	});

	planner.queueFile({
		fileName: path.posix.basename(phpPlan.pluginLoaderPath),
		program,
		metadata: { kind: 'plugin-loader' },
		docblock: [],
		uses: [],
		statements: [],
	});

	reporter.debug('createPhpPluginLoaderHelper: queued plugin loader.', {
		outputDir: pluginRootDir,
	});
}

function buildLoaderConfig({
	ir,
	resourceClassNames,
	resourceControllers,
	uiConfig,
	phpPlan,
	phpGeneratedRoot,
}: {
	ir: GeneratePhaseInput['ir'];
	resourceClassNames: string[];
	resourceControllers: readonly PluginLoaderControllerPlan[];
	uiConfig: UiConfig;
	phpPlan: NonNullable<GeneratePhaseInput['ir']['artifacts']['php']>;
	phpGeneratedRoot: string;
}): Parameters<typeof buildPluginLoaderProgram>[0] {
	const base = {
		origin: ir.meta.origin,
		namespace: ir.php.namespace,
		sanitizedNamespace: ir.meta.sanitizedNamespace,
		plugin: ir.meta.plugin,
		resourceClassNames,
		resourceControllers,
		phpGeneratedPath: path.posix.relative(
			path.posix.dirname(phpPlan.pluginLoaderPath),
			phpGeneratedRoot
		),
		autoload:
			phpPlan.autoload.strategy === 'composer'
				? {
						strategy: phpPlan.autoload.strategy,
						autoloadPath: phpPlan.autoload.autoloadPath,
					}
				: { strategy: phpPlan.autoload.strategy },
	};

	const contentModel = buildContentModelConfig(ir);

	return uiConfig
		? { ...base, ui: uiConfig, contentModel }
		: { ...base, contentModel };
}

async function writeDebugUiFile({
	workspace,
	ir,
	surfaces,
	uiConfig,
	phpPlan,
}: {
	workspace: BuilderApplyOptions['context']['workspace'];
	ir: GeneratePhaseInput['ir'];
	surfaces: IRSurfacePlan[];
	uiConfig: UiConfig;
	phpPlan: NonNullable<GeneratePhaseInput['ir']['artifacts']['php']>;
}): Promise<void> {
	await workspace.write(
		phpPlan.debugUiPath,
		JSON.stringify(
			{
				namespace: ir.meta.namespace,
				sanitizedNamespace: ir.meta.sanitizedNamespace,
				surfaces,
				uiConfig: uiConfig ?? null,
			},
			null,
			2
		),
		{ ensureDir: true }
	);
}

function canGeneratePluginLoader(
	input: BuilderApplyOptions['input']
): input is GeneratePhaseInput {
	return input.phase === 'generate' && Boolean(input.ir);
}

function buildResourceControllers(
	ir: GeneratePhaseInput['ir'],
	phpPlan: NonNullable<GeneratePhaseInput['ir']['artifacts']['php']>
): PluginLoaderControllerPlan[] {
	const loaderDirectory = path.posix.dirname(phpPlan.pluginLoaderPath);

	return ir.resources.map((resource) => {
		const planned = phpPlan.controllers[resource.id];
		const fallbackClassName = `${toPascalCase(resource.name)}Controller`;
		const className = planned?.className
			? qualifyControllerClassName(planned.namespace, planned.className)
			: (resource.controllerClass ??
				`${ir.php.namespace}\\Rest\\${fallbackClassName}`);
		const appliedPath =
			planned?.appliedPath ??
			path.posix.join(
				ir.php.autoload,
				'Rest',
				`${fallbackClassName}.php`
			);
		const relativePath = path.posix.relative(loaderDirectory, appliedPath);

		return {
			className,
			appliedRequirePath: relativePath.startsWith('/')
				? relativePath
				: `/${relativePath}`,
		};
	});
}

function qualifyControllerClassName(
	namespace: string,
	className: string
): string {
	const normalisedClass = className.replace(/^\\+/, '');
	if (normalisedClass.includes('\\')) {
		return normalisedClass;
	}

	return [namespace.replace(/\\+$/, ''), normalisedClass]
		.filter(Boolean)
		.join('\\');
}

function resolvePhpGeneratedRoot(
	ir: GeneratePhaseInput['ir'],
	phpPlan: NonNullable<GeneratePhaseInput['ir']['artifacts']['php']>
): string {
	const firstController = Object.values(phpPlan.controllers)[0];
	if (firstController?.generatedPath) {
		return path.posix.dirname(
			path.posix.dirname(firstController.generatedPath)
		);
	}

	if (phpPlan.blocksRegistrarPath) {
		return path.posix.dirname(
			path.posix.dirname(phpPlan.blocksRegistrarPath)
		);
	}

	if (phpPlan.blocksManifestPath) {
		return path.posix.dirname(
			path.posix.dirname(phpPlan.blocksManifestPath)
		);
	}

	return ir.php.outputDir;
}

function buildContentModelConfig(ir: GeneratePhaseInput['ir']): ContentModel {
	const postTypes: PostTypesMap = new Map();
	const taxonomies: TaxonomiesMap = new Map();
	const statuses: StatusesMap = new Map();

	for (const resource of ir.resources) {
		const storage = resource.storage;
		if (!storage) {
			continue;
		}

		const usesDataViews = resource.ui?.admin?.view === 'dataviews';

		if (storage.mode === 'wp-post') {
			addPostTypeFromResource({
				resource,
				storage,
				postTypes,
				taxonomies,
				statuses,
				usesDataViews,
			});
			continue;
		}

		if (storage.mode === 'wp-taxonomy') {
			addTaxonomyFromStorage({
				storage,
				taxonomies,
				usesDataViews,
			});
		}
	}

	if (postTypes.size === 0 && taxonomies.size === 0 && statuses.size === 0) {
		return undefined;
	}

	return {
		postTypes: buildPostTypesArray(postTypes),
		taxonomies: buildTaxonomiesArray(taxonomies),
		statuses: buildStatusesArray(statuses),
	};
}

function addPostTypeFromResource({
	resource,
	storage,
	postTypes,
	taxonomies,
	statuses,
	usesDataViews,
}: {
	resource: Resource;
	storage: WpPostStorage;
	postTypes: PostTypesMap;
	taxonomies: TaxonomiesMap;
	statuses: StatusesMap;
	usesDataViews: boolean;
}): void {
	const postTypeSlug = storage.postType ?? resource.name;
	const labels = buildLabelsFromResource(resource);
	const existing = postTypes.get(postTypeSlug);
	const taxonomySet = existing?.taxonomies ?? new Set<string>();
	const showUi = existing?.showUi ?? true;
	const showInMenu = existing?.showInMenu ?? true;

	addTaxonomiesForPostType({
		storage,
		postTypeSlug,
		taxonomySet,
		taxonomies,
	});

	const supports = getSupportsForPostType(storage);

	postTypes.set(postTypeSlug, {
		labels,
		supports,
		taxonomies: taxonomySet,
		showUi: usesDataViews ? false : showUi,
		showInMenu: usesDataViews ? false : showInMenu,
	});

	addStatusesFromStorage(storage, statuses);
}

function addTaxonomiesForPostType({
	storage,
	postTypeSlug,
	taxonomySet,
	taxonomies,
}: {
	storage: WpPostStorage;
	postTypeSlug: string;
	taxonomySet: Set<string>;
	taxonomies: TaxonomiesMap;
}): void {
	const storageTaxonomies = storage.taxonomies ?? {};
	for (const descriptor of Object.values(storageTaxonomies)) {
		if (!descriptor?.taxonomy) {
			continue;
		}

		taxonomySet.add(descriptor.taxonomy);

		if (!descriptor.register) {
			continue;
		}

		upsertRegisteredTaxonomy({
			slug: descriptor.taxonomy,
			postTypeSlug,
			hierarchical: descriptor.hierarchical,
			taxonomies,
		});
	}
}

function getSupportsForPostType(
	storage: WpPostStorage
): readonly string[] | undefined {
	if (!storage.supports || storage.supports.length === 0) {
		return undefined;
	}
	return storage.supports;
}

function addStatusesFromStorage(
	storage: WpPostStorage,
	statuses: StatusesMap
): void {
	for (const status of storage.statuses ?? []) {
		const label = toLabel(status);
		statuses.set(status, {
			label,
			public: false,
			showInAdminAllList: true,
			showInAdminStatusList: true,
		});
	}
}

function addTaxonomyFromStorage({
	storage,
	taxonomies,
	usesDataViews,
}: {
	storage: WpTaxonomyStorage;
	taxonomies: TaxonomiesMap;
	usesDataViews: boolean;
}): void {
	const slug = storage.taxonomy;
	if (!slug) {
		return;
	}

	const existing = taxonomies.get(slug) ?? {
		objectTypes: new Set<string>(),
		hierarchical: storage.hierarchical,
		labels: buildTaxonomyLabels(slug),
		showUi: true,
		showAdminColumn: true,
	};

	if (typeof storage.hierarchical === 'boolean') {
		existing.hierarchical = storage.hierarchical;
	}

	if (usesDataViews) {
		existing.showUi = false;
		existing.showAdminColumn = false;
	}

	taxonomies.set(slug, existing);
}

function upsertRegisteredTaxonomy({
	slug,
	postTypeSlug,
	hierarchical,
	taxonomies,
}: {
	slug: string;
	postTypeSlug: string;
	hierarchical?: boolean;
	taxonomies: TaxonomiesMap;
}): void {
	const existing = taxonomies.get(slug) ?? {
		objectTypes: new Set<string>(),
		hierarchical,
		labels: buildTaxonomyLabels(slug),
		showUi: true,
		showAdminColumn: true,
	};

	existing.objectTypes.add(postTypeSlug);

	if (typeof hierarchical === 'boolean') {
		existing.hierarchical = hierarchical;
	}

	taxonomies.set(slug, existing);
}

function buildPostTypesArray(postTypes: PostTypesMap) {
	return Array.from(postTypes.entries()).map(
		([
			slug,
			{ labels, supports, taxonomies: taxonomySet, showUi, showInMenu },
		]) => ({
			slug,
			labels,
			supports,
			taxonomies: Array.from(taxonomySet),
			showUi,
			showInMenu,
			showInRest: true,
			rewrite: false,
			capabilityType: 'post',
			mapMetaCap: true,
			public: false,
		})
	);
}

function buildTaxonomiesArray(taxonomies: TaxonomiesMap) {
	return Array.from(taxonomies.entries()).map(
		([
			slug,
			{
				objectTypes,
				hierarchical,
				labels: taxonomyLabels,
				showUi,
				showAdminColumn,
			},
		]) => ({
			slug,
			objectTypes: Array.from(objectTypes),
			hierarchical,
			labels: taxonomyLabels,
			showUi,
			showAdminColumn,
			showInRest: true,
		})
	);
}

function buildStatusesArray(statuses: StatusesMap) {
	return Array.from(statuses.entries()).map(
		([
			slug,
			{
				label,
				public: isPublic,
				showInAdminAllList,
				showInAdminStatusList,
			},
		]) => ({
			slug,
			label,
			public: isPublic,
			showInAdminAllList,
			showInAdminStatusList,
		})
	);
}

function buildLabelsFromResource(
	resource: GeneratePhaseInput['ir']['resources'][number]
): Record<string, string> {
	const singular = toLabel(resource.name);
	const plural = `${singular}s`;

	return {
		name: plural,
		singular_name: singular,
		add_new_item: `Add New ${singular}`,
		edit_item: `Edit ${singular}`,
		new_item: `New ${singular}`,
		view_item: `View ${singular}`,
		search_items: `Search ${plural}`,
		not_found: `No ${plural.toLowerCase()} found`,
		not_found_in_trash: `No ${plural.toLowerCase()} found in Trash`,
		all_items: `All ${plural}`,
		menu_name: plural,
	};
}

function buildTaxonomyLabels(taxonomy: string): Record<string, string> {
	const singular = toLabel(taxonomy);
	const plural = `${singular}s`;
	return {
		name: plural,
		singular_name: singular,
		search_items: `Search ${plural}`,
		all_items: `All ${plural}`,
		parent_item: `Parent ${singular}`,
		parent_item_colon: `Parent ${singular}:`,
		edit_item: `Edit ${singular}`,
		update_item: `Update ${singular}`,
		add_new_item: `Add New ${singular}`,
		new_item_name: `New ${singular} Name`,
		menu_name: plural,
	};
}

function toLabel(value: string): string {
	const spaced = value
		.replace(/[_-]+/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();

	return spaced
		.split(' ')
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(' ');
}

async function pluginLoaderIsUserOwned({
	workspace,
	reporter,
	pluginLoaderPath,
}: {
	workspace: BuilderApplyOptions['context']['workspace'];
	reporter: BuilderApplyOptions['reporter'];
	pluginLoaderPath: string;
}): Promise<boolean> {
	try {
		const existingPlugin = await workspace.readText(pluginLoaderPath);
		if (
			existingPlugin &&
			!new RegExp(AUTO_GUARD_BEGIN, 'u').test(existingPlugin)
		) {
			reporter.info(
				`createPhpPluginLoaderHelper: skipping generation because ${pluginLoaderPath} exists and appears user-owned.`
			);
			return true;
		}
	} catch {
		// ignore - file does not exist or cannot be read
	}

	return false;
}
