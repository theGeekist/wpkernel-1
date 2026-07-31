import { type buildPhpPrettyPrinter } from '@wpkernel/php-json-ast';
import type { BuilderApplyOptions } from '../runtime/types';
import type { PlanInstruction } from './types';
import { buildPluginLoaderProgram } from '@wpkernel/wp-json-ast';
import path from 'path';
import { buildUiConfig } from './php/pluginLoader.ui';
import { resolvePlanPaths } from './plan.paths';
import { toPascalCase } from '../utils';

export async function addPluginLoaderInstruction({
	options,
	prettyPrinter,
	instructions,
}: {
	readonly options: BuilderApplyOptions;
	readonly prettyPrinter: ReturnType<typeof buildPhpPrettyPrinter>;
	readonly instructions: PlanInstruction[];
}): Promise<void> {
	const loaderInstruction = await emitPluginLoader({
		options,
		prettyPrinter,
	});
	if (loaderInstruction) {
		instructions.push(loaderInstruction);
	}
}

type PluginIr = NonNullable<BuilderApplyOptions['input']['ir']>;
type ResourceControllerPlan = {
	readonly className: string;
	readonly appliedPath: string;
};

export async function emitPluginLoader({
	options,
	prettyPrinter,
}: {
	readonly options: BuilderApplyOptions;
	readonly prettyPrinter: ReturnType<typeof buildPhpPrettyPrinter>;
}): Promise<PlanInstruction | null> {
	const { input, context, output, reporter } = options;
	const { ir } = input;
	const paths = resolvePlanPaths(options);
	const pluginLoaderPath = paths.pluginLoader;

	if (!ir) {
		reporter.warn(
			'createApplyPlanBuilder: IR artifact missing, skipping plugin loader emission.'
		);
		return null;
	}

	const existingPlugin = await readExistingPlugin({
		context,
		pluginLoaderPath,
	});

	const resourceControllers = buildResourceControllers(ir).map(
		(controller) => ({
			className: controller.className,
			appliedRequirePath: buildAppliedRequirePath(
				pluginLoaderPath,
				controller.appliedPath
			),
		})
	);
	const uiConfig = buildUiConfig(ir);
	const phpGeneratedPath = buildLoaderRelativePath(
		pluginLoaderPath,
		paths.phpGenerated
	);
	const generatedLoaderPath = path.posix.join(
		paths.phpGenerated,
		path.posix.basename(pluginLoaderPath)
	);

	const generatedContents = await readGeneratedLoader({
		context,
		generatedLoaderPath,
	});

	const code = await resolvePluginLoaderCode({
		ir,
		uiConfig,
		phpGeneratedPath,
		resourceClassNames: resourceControllers.map(
			(controller) => controller.className
		),
		resourceControllers,
		context,
		prettyPrinter,
		generatedLoaderPath,
		generatedContents,
	});

	if (!code) {
		reporter.warn(
			'createApplyPlanBuilder: unable to resolve generated plugin loader; skipping.'
		);
		return null;
	}

	const incomingPath = path.posix.join(
		paths.planIncoming,
		paths.pluginLoader
	);
	const basePath = path.posix.join(paths.planBase, paths.pluginLoader);

	await writeIncomingAndBase({
		context,
		output,
		incomingPath,
		basePath,
		code,
		existingPlugin,
	});

	reporter.debug('createApplyPlanBuilder: queued plugin loader instruction.');

	return {
		action: 'write',
		file: pluginLoaderPath,
		base: basePath,
		incoming: incomingPath,
		description: 'Update plugin loader',
	} satisfies PlanInstruction;
}

function buildResourceControllers(ir: PluginIr): ResourceControllerPlan[] {
	const phpPlan = ir.artifacts.php;
	return ir.resources.map((resource) => {
		const pascal = toPascalCase(resource.name);
		const fallbackClassName = `${pascal}Controller`;
		const planned = phpPlan.controllers[resource.id];
		const className = planned
			? qualifyClassName(planned.namespace, planned.className)
			: (resource.controllerClass ??
				`${ir.php.namespace}\\Rest\\${fallbackClassName}`);
		const appliedPath =
			planned?.appliedPath ??
			path.posix.join(
				normaliseDirectory(ir.php.autoload),
				'Rest',
				`${fallbackClassName}.php`
			);

		return { className, appliedPath };
	});
}

function qualifyClassName(namespace: string, className: string): string {
	const normalisedClass = className.replace(/^\\+/, '');
	if (normalisedClass.includes('\\')) {
		return normalisedClass;
	}

	return [namespace.replace(/\\+$/, ''), normalisedClass]
		.filter(Boolean)
		.join('\\');
}

function normaliseDirectory(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\.\/|\/$/g, '');
}

function buildLoaderRelativePath(
	pluginLoaderPath: string,
	targetPath: string
): string {
	return path.posix.relative(
		path.posix.dirname(pluginLoaderPath),
		targetPath
	);
}

function buildAppliedRequirePath(
	pluginLoaderPath: string,
	controllerPath: string
): string {
	const loaderDirectory = path.posix.dirname(pluginLoaderPath);
	const relativePath = path.posix.relative(loaderDirectory, controllerPath);
	return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
}

async function readExistingPlugin({
	context,
	pluginLoaderPath,
}: {
	context: BuilderApplyOptions['context'];
	pluginLoaderPath: string;
}): Promise<string | null> {
	const existingPlugin =
		(await context.workspace.readText(pluginLoaderPath)) ?? null;
	return existingPlugin;
}

async function readGeneratedLoader({
	context,
	generatedLoaderPath,
}: {
	context: BuilderApplyOptions['context'];
	generatedLoaderPath: string;
}): Promise<string | undefined> {
	const contents =
		(await context.workspace.readText(generatedLoaderPath)) ?? undefined;
	return contents;
}

async function resolvePluginLoaderCode({
	ir,
	uiConfig,
	phpGeneratedPath,
	resourceClassNames,
	resourceControllers,
	context,
	prettyPrinter,
	generatedLoaderPath,
	generatedContents,
}: {
	ir: PluginIr;
	uiConfig: ReturnType<typeof buildUiConfig>;
	phpGeneratedPath: string;
	resourceClassNames: string[];
	resourceControllers: ReadonlyArray<{
		readonly className: string;
		readonly appliedRequirePath: string;
	}>;
	context: BuilderApplyOptions['context'];
	prettyPrinter: ReturnType<typeof buildPhpPrettyPrinter>;
	generatedLoaderPath: string;
	generatedContents: string | undefined;
}): Promise<string | null> {
	if (generatedContents) {
		return generatedContents;
	}

	const baseConfig = {
		origin: ir.meta.origin,
		namespace: ir.php.namespace,
		sanitizedNamespace: ir.meta.sanitizedNamespace,
		plugin: ir.meta.plugin,
		resourceClassNames,
		resourceControllers,
		phpGeneratedPath,
	};

	const program = buildPluginLoaderProgram(
		uiConfig ? { ...baseConfig, ui: uiConfig } : baseConfig
	);

	const printed = await prettyPrinter.prettyPrint({
		filePath: context.workspace.resolve(generatedLoaderPath),
		program,
	});

	return printed.code ?? null;
}

async function writeIncomingAndBase({
	context,
	output,
	incomingPath,
	basePath,
	code,
	existingPlugin,
}: {
	context: BuilderApplyOptions['context'];
	output: BuilderApplyOptions['output'];
	incomingPath: string;
	basePath: string;
	code: string;
	existingPlugin: string | null;
}): Promise<void> {
	await context.workspace.write(incomingPath, code, { ensureDir: true });
	output.queueWrite({ file: incomingPath, contents: code });

	const existingBase = await context.workspace.readText(basePath);
	if (existingBase !== null) {
		return;
	}

	const baseSnapshot = existingPlugin ?? code;
	await context.workspace.write(basePath, baseSnapshot, {
		ensureDir: true,
	});
	output.queueWrite({ file: basePath, contents: baseSnapshot });
}
