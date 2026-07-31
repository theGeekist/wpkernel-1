import type { IRv1 } from '../../ir/publicTypes';
import type { PluginLoaderUiConfig } from './types';

type DataViewsConfig = {
	readonly preferencesKey?: unknown;
};

function resolvePreferencesKey(
	ir: IRv1,
	resourceName: string,
	namespace: string
): string {
	const resource = ir.resources.find(
		(candidate) => candidate.name === resourceName
	);
	const dataviews = resource?.ui?.admin?.dataviews as
		| DataViewsConfig
		| undefined;
	const configured = dataviews?.preferencesKey;

	return typeof configured === 'string' && configured.trim().length > 0
		? configured.trim()
		: `${namespace}/dataviews/${resourceName}`;
}

export function buildUiConfig(ir: IRv1): PluginLoaderUiConfig | null {
	const surfaces =
		ir.artifacts.surfaces ??
		(Object.create(null) as NonNullable<IRv1['artifacts']['surfaces']>);
	const resourcesWithMenu = Object.values(surfaces).filter(
		(surface) => surface.menu && surface.menu.slug
	);
	// Without menu-bearing surfaces we skip UI entirely.
	if (resourcesWithMenu.length === 0) {
		return null;
	}

	// The loader metadata comes from the UI fragment; if missing, skip UI.
	const loader = ir.ui?.loader;
	if (!loader) {
		return null;
	}

	return {
		handle: loader.handle,
		assetPath: loader.assetPath,
		scriptPath: loader.scriptPath,
		localizationObject: loader.localizationObject,
		namespace: loader.namespace,
		resources: resourcesWithMenu.map((surface) => ({
			resource: surface.resource,
			menu: surface.menu,
			preferencesKey: resolvePreferencesKey(
				ir,
				surface.resource,
				loader.namespace
			),
		})),
	};
}
