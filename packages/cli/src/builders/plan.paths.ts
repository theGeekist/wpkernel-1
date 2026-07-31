import path from 'node:path';
import { WPKernelError } from '@wpkernel/core/error';
import type { BuilderApplyOptions } from '../runtime/types';

export type PlanLayoutPaths = {
	planManifest: string;
	planBase: string;
	planIncoming: string;
	runtimeGenerated: string;
	runtimeApplied: string;
	phpGenerated: string;
	pluginLoader: string;
	bundlerConfig: string;
	viteConfig: string;
};

export function resolvePlanPaths(
	options: BuilderApplyOptions
): PlanLayoutPaths {
	const ir = getPlanIr(options.input.ir);
	return buildPlanPaths(ir.artifacts, ir.php.outputDir);
}

function getPlanIr(ir?: BuilderApplyOptions['input']['ir']): NonNullable<
	BuilderApplyOptions['input']['ir']
> & {
	artifacts: NonNullable<
		NonNullable<BuilderApplyOptions['input']['ir']>['artifacts']
	>;
} {
	if (!ir?.artifacts?.plan) {
		throw new WPKernelError('DeveloperError', {
			message: 'Plan paths cannot be resolved without an IR.',
		});
	}

	return ir as NonNullable<BuilderApplyOptions['input']['ir']> & {
		artifacts: NonNullable<
			NonNullable<BuilderApplyOptions['input']['ir']>['artifacts']
		>;
	};
}

function buildPlanPaths(
	artifacts: NonNullable<
		NonNullable<BuilderApplyOptions['input']['ir']>['artifacts']
	>,
	phpOutputDir: string
): PlanLayoutPaths {
	const runtimePlan = artifacts.runtime?.runtime;
	const phpPlan = artifacts.php;
	const bundlerPlan = artifacts.bundler;

	const paths: PlanLayoutPaths = {
		planManifest: artifacts.plan.planManifestPath,
		planBase: artifacts.plan.planBaseDir,
		planIncoming: artifacts.plan.planIncomingDir,
		runtimeGenerated: runtimePlan?.generated ?? '',
		runtimeApplied: runtimePlan?.applied ?? '',
		phpGenerated: '',
		pluginLoader: '',
		bundlerConfig: '',
		viteConfig: 'vite.config.ts',
	};

	if (phpPlan) {
		paths.phpGenerated = resolvePhpGeneratedRoot(phpPlan, phpOutputDir);
		paths.pluginLoader = phpPlan.pluginLoaderPath;
	}

	if (bundlerPlan?.configPath) {
		paths.bundlerConfig = bundlerPlan.configPath;
	}

	return paths;
}

function resolvePhpGeneratedRoot(
	phpPlan: NonNullable<
		NonNullable<BuilderApplyOptions['input']['ir']>['artifacts']['php']
	>,
	phpOutputDir: string
): string {
	if (phpPlan.controllers) {
		const firstController = Object.values(phpPlan.controllers)[0];
		if (firstController?.generatedPath) {
			return path.posix.dirname(
				path.posix.dirname(firstController.generatedPath)
			);
		}
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

	return phpOutputDir;
}
