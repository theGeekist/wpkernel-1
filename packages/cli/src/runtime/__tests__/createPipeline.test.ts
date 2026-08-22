import { WPKernelError } from '@wpkernel/core/error';
import { buildEmptyGenerationState } from '../../apply/manifest';
import { buildWorkspace } from '../../workspace';
import { createReporterMock } from '../../../tests/reporter';
import { createHelper } from '../createHelper';
import { createPipeline } from '../createPipeline';
import type {
	FragmentApplyOptions,
	FragmentHelper,
	PipelineRunOptions,
	PipelineRunResult,
} from '../types';

function buildRunOptions(): PipelineRunOptions {
	return {
		phase: 'generate',
		config: {
			version: 1,
			namespace: 'test',
			schemas: {},
			resources: {},
		},
		namespace: 'test',
		origin: 'typescript',
		sourcePath: '/tmp/wpk.config.ts',
		workspace: buildWorkspace('/tmp'),
		reporter: createReporterMock(),
		generationState: buildEmptyGenerationState(),
	};
}

function buildFragment(
	key: string,
	apply: (
		options: FragmentApplyOptions
	) => ReturnType<FragmentHelper['apply']>
) {
	return createHelper({ key, kind: 'fragment', apply });
}

function buildValidIrFragment(): FragmentHelper {
	return buildFragment('valid', ({ output }) => {
		output.assign({
			meta: {},
			capabilityMap: {},
			php: {},
			layout: {},
			artifacts: [],
		} as never);
	});
}

describe('createPipeline static programme', () => {
	it('captures fragments before the run and preserves synchronous settlement', () => {
		const pipeline = createPipeline({
			fragments: [buildValidIrFragment()],
		});

		const result = pipeline.run(buildRunOptions());

		expect(result).not.toBeInstanceOf(Promise);
		expect(
			(result as PipelineRunResult).steps.map((step) => step.key)
		).toContain('valid');
	});

	it('promotes only an asynchronous helper', async () => {
		const pipeline = createPipeline({
			fragments: [
				buildValidIrFragment(),
				buildFragment('async', async () => undefined),
			],
		});
		const result = pipeline.run(buildRunOptions());

		expect(result).toBeInstanceOf(Promise);
		await expect(result).resolves.toMatchObject({ diagnostics: [] });
	});

	it('rejects wrong helper kinds and duplicate overrides at construction', () => {
		expect(() =>
			createPipeline({
				fragments: [
					createHelper({
						key: 'wrong',
						kind: 'builder',
						apply: () => undefined,
					}) as never,
				],
			})
		).toThrow(WPKernelError);

		const first = createHelper({
			key: 'same',
			kind: 'fragment',
			mode: 'override',
			apply: () => undefined,
		});
		expect(() =>
			createPipeline({ fragments: [first, { ...first }] })
		).toThrow(WPKernelError);
	});

	it('returns a frozen run-only domain token', () => {
		const pipeline = createPipeline();

		expect(Object.isFrozen(pipeline)).toBe(true);
		expect(Object.keys(pipeline)).toEqual(['run']);
	});
});
