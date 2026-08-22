import fs from 'node:fs/promises';
import path from 'node:path';
import { WPKernelError } from '@wpkernel/core/error';
import type { MaybePromise } from '@wpkernel/pipeline';
import { runAdapterExtensions } from '../adapters';
import type {
	AdapterContext,
	AdapterExtension,
	AdapterExtensionFactory,
} from '../config/types';
import type {
	PipelineExtension,
	PipelineExtensionHookOptions,
	PipelineExtensionHookResult,
} from './types';
import { buildTsFormatter } from '../builders/ts';
import { observeMaybePromise } from './maybePromise';

function invokeExtensionFactory(
	factory: AdapterExtensionFactory,
	adapterContext: AdapterContext
): AdapterExtension[] | undefined | Error {
	try {
		const produced = factory(adapterContext);
		if (!produced) {
			return undefined;
		}

		return Array.isArray(produced) ? produced : [produced];
	} catch (error) {
		return error instanceof Error ? error : new Error(String(error));
	}
}

function validateExtension(
	candidate: AdapterExtension | undefined | null
): AdapterExtension | Error {
	if (!candidate) {
		return new Error('Invalid adapter extension returned from factory.');
	}

	const name =
		typeof candidate.name === 'string' ? candidate.name.trim() : '';
	if (!name) {
		return new Error('Adapter extensions must provide a non-empty name.');
	}

	if (typeof candidate.apply !== 'function') {
		return new Error('Adapter extensions must define an apply() function.');
	}

	return { ...candidate, name };
}

function resolveAdapterExtensions(
	factories: AdapterExtensionFactory[],
	adapterContext: AdapterContext
): AdapterExtension[] | Error {
	const extensions: AdapterExtension[] = [];

	for (const factory of factories) {
		const produced = invokeExtensionFactory(factory, adapterContext);
		if (produced instanceof Error) {
			return produced;
		}

		if (!produced) {
			continue;
		}

		for (const candidate of produced) {
			const validated = validateExtension(candidate);
			if (validated instanceof Error) {
				return validated;
			}

			extensions.push(validated);
		}
	}

	return extensions;
}

async function ensureDirectory(
	workspaceRoot: string,
	directoryPath: string
): Promise<void> {
	const absolute = path.isAbsolute(directoryPath)
		? directoryPath
		: path.resolve(workspaceRoot, directoryPath);
	await fs.mkdir(absolute, { recursive: true });
}

function runExtensions({
	options: runOptions,
	artifact,
}: PipelineExtensionHookOptions): MaybePromise<PipelineExtensionHookResult | void> {
	if (runOptions.phase !== 'generate') {
		return undefined;
	}

	const adapterReporter = runOptions.reporter.child('adapter');
	const adapterContext: AdapterContext = {
		config: runOptions.config,
		reporter: adapterReporter,
		namespace: artifact.meta.sanitizedNamespace,
		ir: artifact,
	};

	const extensions = resolveExtensionsOrSkip({
		factories: runOptions.config.adapters?.extensions ?? [],
		adapterContext,
		reporter: adapterReporter,
	});
	if (!extensions || extensions.length === 0) {
		return undefined;
	}

	const generatedRoot = resolveGeneratedRoot(artifact);
	if (!generatedRoot) {
		throw new WPKernelError('DeveloperError', {
			message:
				'Adapter extensions require runtime artifact paths to be present on the IR artifact.',
			data: { namespace: artifact.meta?.namespace },
		});
	}

	adapterReporter.info('Running adapter extensions.', {
		count: extensions.length,
	});

	const workspaceRoot = runOptions.workspace.root;
	const outputDir = runOptions.workspace.resolve(generatedRoot);
	const configDirectory = path.dirname(runOptions.sourcePath);

	const tsFormatter = buildTsFormatter();

	const runResult = runAdapterExtensions({
		extensions,
		adapterContext,
		ir: artifact,
		outputDir,
		configDirectory,
		ensureDirectory: (directoryPath) =>
			ensureDirectory(workspaceRoot, directoryPath),
		writeFile: (filePath, contents) =>
			runOptions.workspace.write(filePath, contents, { ensureDir: true }),
		formatPhp: (_filePath, contents) => contents,
		formatTs: (filePath, contents) =>
			tsFormatter.format({ filePath, contents }),
	});

	return mapMaybe(runResult, (result) => {
		adapterContext.ir = result.ir;

		adapterReporter.info('Adapter extensions completed successfully.', {
			count: extensions.length,
		});

		return {
			artifact: result.ir,
			commit: result.commit,
			rollback: result.rollback,
		};
	});
}

export function buildAdapterExtensionsExtension(): PipelineExtension {
	return {
		key: 'pipeline.extensions.adapters',
		lifecycle: 'finalize',
		hook(options) {
			return runExtensions(options);
		},
	};
}

function mapMaybe<T, TResult>(
	value: MaybePromise<T>,
	map: (value: T) => TResult
): MaybePromise<TResult> {
	const observed = observeMaybePromise<T>(value);
	if (observed.kind === 'failed') {
		throw observed.error;
	}
	return observed.kind === 'synchronous'
		? map(observed.value)
		: observed.promise.then(map);
}

function resolveExtensionsOrSkip({
	factories,
	adapterContext,
	reporter,
}: {
	readonly factories: AdapterExtensionFactory[];
	readonly adapterContext: AdapterContext;
	readonly reporter: PipelineExtensionHookOptions['options']['reporter'];
}): AdapterExtension[] | null {
	if (factories.length === 0) {
		return null;
	}

	const resolved = resolveAdapterExtensions(factories, adapterContext);
	if (resolved instanceof Error) {
		reporter.error('Adapter extensions failed to initialise.', {
			error: resolved.message,
		});
		throw new WPKernelError('DeveloperError', {
			message: 'Adapter extensions failed to initialise.',
			data: { message: resolved.message },
		});
	}

	return resolved;
}

function resolveGeneratedRoot(
	artifact: PipelineExtensionHookOptions['artifact']
): string | null {
	return (
		artifact.artifacts?.runtime?.runtime.generated ??
		artifact.layout?.resolve?.('js.generated') ??
		null
	);
}
