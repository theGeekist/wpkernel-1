import { buildEmptyGenerationState } from '../../apply/manifest';
import { buildWorkspace } from '../../workspace';
import { createReporterMock, type ReporterMock } from '../../../tests/reporter';
import { createHelper } from '../createHelper';
import { createPipeline, type CliPipelineOptions } from '../createPipeline';
import type {
	BuilderHelper,
	FragmentHelper,
	Pipeline,
	PipelineRunOptions,
	PipelineRunResult,
} from '../types';

function buildRunOptions(reporter = createReporterMock()): PipelineRunOptions {
	return {
		phase: 'generate',
		config: {
			version: 1,
			namespace: 'compatibility',
			schemas: {},
			resources: {},
		},
		namespace: 'compatibility',
		origin: 'typescript',
		sourcePath: '/tmp/wpk.config.ts',
		workspace: buildWorkspace('/tmp'),
		reporter,
		generationState: buildEmptyGenerationState(),
	};
}

function buildValidFragment(): FragmentHelper {
	return createHelper({
		key: 'ir.compatibility',
		kind: 'fragment',
		apply({ output }) {
			output.assign({
				meta: {
					namespace: 'compatibility',
					sanitizedNamespace: 'Compatibility',
					origin: 'typescript',
					sourcePath: '/tmp/wpk.config.ts',
				},
				capabilityMap: {
					sourcePath: undefined,
					definitions: [],
					fallback: {
						capability: 'manage_options',
						appliesTo: 'resource',
					},
					missing: [],
					unused: [],
					warnings: [],
				},
				php: {
					namespace: 'Compatibility',
					autoload: 'inc/',
					outputDir: 'php.generated',
				},
				layout: {},
				artifacts: [],
			} as never);
		},
	});
}

function runSynchronously(
	pipeline: Pipeline,
	options: PipelineRunOptions
): PipelineRunResult {
	const result = pipeline.run(options);
	expect(result).not.toBeInstanceOf(Promise);
	return result as PipelineRunResult;
}

function createCompatibilityPipeline(
	overrides: Pick<CliPipelineOptions, 'builders' | 'extensions'>
): Pipeline {
	return createPipeline({
		fragments: [buildValidFragment()],
		builders: overrides.builders,
		extensions: overrides.extensions,
	});
}

function buildBuilder(
	key: string,
	priority: number,
	onApply: () => void
): BuilderHelper {
	return createHelper({
		key,
		kind: 'builder',
		priority,
		apply: onApply,
	});
}

describe('CLI v1 compatibility integration', () => {
	it('maps deterministic builder ordering by priority, key, and registration', () => {
		const order: string[] = [];
		const builders = [
			buildBuilder('builder.duplicate', 0, () =>
				order.push('duplicate-1')
			),
			buildBuilder('builder.beta', 1, () => order.push('beta')),
			buildBuilder('builder.high', 5, () => order.push('high')),
			buildBuilder('builder.duplicate', 0, () =>
				order.push('duplicate-2')
			),
			buildBuilder('builder.alpha', 1, () => order.push('alpha')),
		];
		const pipeline = createCompatibilityPipeline({
			builders,
			extensions: [],
		});

		const result = runSynchronously(pipeline, buildRunOptions());

		expect(order).toEqual([
			'high',
			'alpha',
			'beta',
			'duplicate-1',
			'duplicate-2',
		]);
		expect(
			result.steps
				.filter((step) => step.kind === 'builder')
				.map((step) => step.key)
		).toEqual([
			'builder.high',
			'builder.alpha',
			'builder.beta',
			'builder.duplicate',
			'builder.duplicate',
		]);
	});

	it('commits an extension after successful builder execution', () => {
		const events: string[] = [];
		const commit = jest.fn(() => {
			events.push('commit');
		});
		const rollback = jest.fn(() => {
			events.push('rollback');
		});
		const builder = buildBuilder('builder.success', 0, () =>
			events.push('builder')
		);
		const pipeline = createCompatibilityPipeline({
			builders: [builder],
			extensions: [
				{
					key: 'extension.success',
					hook() {
						events.push('hook');
						return { commit, rollback };
					},
				},
			],
		});

		runSynchronously(pipeline, buildRunOptions());

		expect(events).toEqual(['hook', 'builder', 'commit']);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(rollback).not.toHaveBeenCalled();
	});

	it('rolls back an earlier extension when a later hook fails', () => {
		const commit = jest.fn();
		const rollback = jest.fn();
		const pipeline = createCompatibilityPipeline({
			builders: [],
			extensions: [
				{
					key: 'extension.prepared',
					hook: () => ({ commit, rollback }),
				},
				{
					key: 'extension.failing',
					hook() {
						throw new Error('extension failure');
					},
				},
			],
		});

		expect(() => pipeline.run(buildRunOptions())).toThrow(
			'extension failure'
		);
		expect(commit).not.toHaveBeenCalled();
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('rolls back an extension when a builder fails', () => {
		const commit = jest.fn();
		const rollback = jest.fn();
		const pipeline = createCompatibilityPipeline({
			builders: [
				buildBuilder('builder.failing', 0, () => {
					throw new Error('builder failure');
				}),
			],
			extensions: [
				{
					key: 'extension.rollback',
					hook: () => ({ commit, rollback }),
				},
			],
		});

		expect(() => pipeline.run(buildRunOptions())).toThrow(
			'builder failure'
		);
		expect(commit).not.toHaveBeenCalled();
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('requires no rollback handler when later execution fails', () => {
		const reporter = createReporterMock();
		const commit = jest.fn();
		const pipeline = createCompatibilityPipeline({
			builders: [
				buildBuilder('builder.failing', 0, () => {
					throw new Error('builder failure');
				}),
			],
			extensions: [
				{
					key: 'extension.commit-only',
					hook: () => ({ commit }),
				},
			],
		});

		expect(() => pipeline.run(buildRunOptions(reporter))).toThrow(
			'builder failure'
		);
		expect(commit).not.toHaveBeenCalled();
		expect(reporter.warn).not.toHaveBeenCalled();
	});

	it('projects extension rollback failures through the CLI reporter', () => {
		const reporter: ReporterMock = createReporterMock();
		const rollback = jest.fn(() => {
			throw new Error('rollback failure');
		});
		const pipeline = createCompatibilityPipeline({
			builders: [
				buildBuilder('builder.failing', 0, () => {
					throw new Error('builder failure');
				}),
			],
			extensions: [
				{
					key: 'extension.rollback-warning',
					hook: () => ({ rollback }),
				},
			],
		});

		expect(() => pipeline.run(buildRunOptions(reporter))).toThrow(
			'builder failure'
		);
		expect(rollback).toHaveBeenCalledTimes(1);
		expect(reporter.warn).toHaveBeenCalledWith(
			'Pipeline extension rollback failed.',
			{
				error: 'rollback failure',
				extensions: ['extension.rollback-warning'],
			}
		);
	});

	it('rejects a detached run function without its CLI authority', () => {
		const pipeline = createCompatibilityPipeline({
			builders: [],
			extensions: [],
		});
		const detachedRun = pipeline.run;

		expect(() => detachedRun(buildRunOptions())).toThrow(
			'Invalid CLI Pipeline authority.'
		);
	});
});
