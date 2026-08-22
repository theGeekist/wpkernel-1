import path from 'node:path';
import type { Reporter } from '@wpkernel/core/reporter';
import { createNoopReporter as buildNoopReporter } from '@wpkernel/core/reporter';
import type { FragmentIrOptions, IRv1 } from './publicTypes';
import { createPipeline } from '../runtime';
import type {
	BuilderHelper,
	FragmentHelper,
	Pipeline,
	PipelinePhase,
} from '../runtime';
import type { Workspace } from '../workspace';
import { buildWorkspace } from '../workspace';
import { createMetaFragment } from './fragments/ir.meta.core';
import { createLayoutFragment } from './fragments/ir.layout.core';
import { createSchemasFragment } from './fragments/ir.schemas.core';
import { createResourcesFragment } from './fragments/ir.resources.core';
import { createBundlerFragment } from './fragments/ir.bundler.core';
import { createUiFragment } from './fragments/ui';
import { createCapabilitiesFragment } from './fragments/ir.capabilities.core';
import { createCapabilityMapFragment } from './fragments/ir.capability-map.core';
import { createBlocksFragment } from './fragments/ir.blocks.core';
import { createDiagnosticsFragment } from './fragments/ir.diagnostics.core';
import { createOrderingFragment } from './fragments/ir.ordering.core';
import { createValidationFragment } from './fragments/validation';
import { createArtifactsFragment } from './fragments/ir.artifacts.plan';
import {
	createPlanBuilder,
	createBundler,
	createJsBlocksBuilder,
	createPhpBuilderConfigHelper,
	createPhpBaseControllerHelper,
	createPhpCapabilityHelper,
	createPhpChannelHelper,
	createPhpCodemodIngestionHelper,
	createPhpDriverInstaller,
	createPhpIndexFileHelper,
	createPhpPersistenceRegistryHelper,
	createPhpPluginLoaderHelper,
	createPhpResourceControllerHelper,
	createPhpTransientStorageHelper,
	createPhpWpOptionStorageHelper,
	createPhpWpPostRoutesHelper,
	createPhpWpTaxonomyStorageHelper,
	createTsCapabilityBuilder,
	createTsIndexBuilder,
	createTsTypesBuilder,
	createTsResourcesBuilder,
	createUiEntryBuilder,
	createTsConfigBuilder,
	createAdminScreenBuilder,
	createAppConfigBuilder,
	createAppFormBuilder,
	createWpProgramWriterHelper,
} from '../builders';
import { buildAdapterExtensionsExtension } from '../runtime/adapterExtensions';
import { buildEmptyGenerationState } from '../apply/manifest';

/**
 * Defines the environment for creating an Intermediate Representation (IR).
 *
 * @category IR
 * @public
 */
export interface CreateIrEnvironment {
	/** Optional: The workspace instance to use. */
	readonly workspace?: Workspace;
	/** Optional: The reporter instance for logging. */
	readonly reporter?: Reporter;
	/** Optional: The pipeline phase to execute. */
	readonly phase?: PipelinePhase;
	/** Optional: The pipeline instance to use. */
	readonly pipeline?: Pipeline;
}

/**
 * Registers the core IR fragments with the pipeline.
 *
 * These fragments are responsible for extracting various pieces of information
 * from the configuration and building up the Intermediate Representation.
 *
 * @category IR
 * @returns The immutable core fragment programme.
 */
function registerCoreFragments(): readonly FragmentHelper[] {
	return [
		createLayoutFragment(),
		createMetaFragment(),
		createSchemasFragment(),
		createResourcesFragment(),
		createBundlerFragment(),
		createUiFragment(),
		createCapabilitiesFragment(),
		createCapabilityMapFragment(),
		createDiagnosticsFragment(),
		createBlocksFragment(),
		createOrderingFragment(),
		createValidationFragment(),
		createArtifactsFragment(),
	];
}

/**
 * Registers the core builders with the pipeline.
 *
 * These builders are responsible for taking the Intermediate Representation
 * and generating various output artifacts (e.g., PHP, TypeScript, bundles).
 *
 * @category IR
 * @returns The immutable core builder programme.
 */
function registerCoreBuilders(): readonly BuilderHelper[] {
	return [
		createJsBlocksBuilder(),
		createTsTypesBuilder(),
		createTsResourcesBuilder(),
		createAdminScreenBuilder(),
		createAppConfigBuilder(),
		createAppFormBuilder(),
		createUiEntryBuilder(),
		createTsConfigBuilder(),
		createBundler(),
		createPhpDriverInstaller(),
		createPhpChannelHelper(),
		createPhpBuilderConfigHelper(),
		createPhpBaseControllerHelper(),
		createPhpTransientStorageHelper(),
		createPhpWpOptionStorageHelper(),
		createPhpWpTaxonomyStorageHelper(),
		createPhpWpPostRoutesHelper(),
		createPhpResourceControllerHelper(),
		createPhpCapabilityHelper(),
		createPhpPersistenceRegistryHelper(),
		createPhpPluginLoaderHelper(),
		createPhpIndexFileHelper(),
		createPhpCodemodIngestionHelper({ files: [] }),
		createWpProgramWriterHelper(),
		createTsCapabilityBuilder(),
		createTsIndexBuilder(),
		createPlanBuilder(),
	];
}

async function runIrPipeline(
	options: FragmentIrOptions,
	environment: CreateIrEnvironment,
	mode: 'fragments-only' | 'with-builders'
): Promise<IRv1> {
	const pipeline =
		environment.pipeline ??
		createPipeline({
			fragments: registerCoreFragments(),
			builders: mode === 'with-builders' ? registerCoreBuilders() : [],
			extensions: [buildAdapterExtensionsExtension()],
		});

	const workspace =
		environment.workspace ??
		buildWorkspace(path.dirname(options.sourcePath));
	const reporter = environment.reporter ?? buildNoopReporter();
	const phase = environment.phase ?? 'generate';

	const { ir } = await pipeline.run({
		phase,
		config: options.config,
		namespace: options.namespace,
		origin: options.origin,
		sourcePath: options.sourcePath,
		workspace,
		reporter,
		generationState: buildEmptyGenerationState(),
	});

	return ir;
}

/**
 * Builds the Intermediate Representation (IR) by running only the core IR fragments.
 *
 * This variant does not register or execute any builders. It is intended for
 * scenarios where you want a deterministic IR to assert against (e.g. tests
 * or analysis tooling) without generating any artefacts on disk.
 *
 * @category IR
 * @param    options     - Options for building the IR, including configuration and source paths.
 * @param    environment - Optional environment settings for the IR creation process.
 * @returns A promise that resolves to the generated `IRv1` object.
 */
export function createIr(
	options: FragmentIrOptions,
	environment: CreateIrEnvironment = {}
): Promise<IRv1> {
	return runIrPipeline(options, environment, 'fragments-only');
}

/**
 * Runs the full generation pipeline (IR + builders) from the given build options.
 *
 * This function sets up a pipeline with core IR fragments and all core builders,
 * then executes it to both construct the IR and generate artefacts (PHP, TS, UI
 * entries, bundles, etc.) as a side-effect. It represents the high-level
 * "generate everything" entry point used by the CLI.
 *
 * @category IR
 * @param    options     - Options for building the IR, including configuration and source paths.
 * @param    environment - Optional environment settings for the IR creation process.
 * @returns A promise that resolves to the generated `IRv1` object.
 */
export async function createIrWithBuilders(
	options: FragmentIrOptions,
	environment: CreateIrEnvironment = {}
): Promise<IRv1> {
	return runIrPipeline(options, environment, 'with-builders');
}

export { registerCoreFragments, registerCoreBuilders };
