import { createSerialPipeline, runPipeline } from '@wpkernel/pipeline/v1';
import { createResourcePipeline } from '../createResourcePipeline';
import type { Reporter } from '../../../reporter/types';
import type { PipelineDiagnostic } from '@wpkernel/pipeline/v1';
import * as reportingModule from '../../reporting';

jest.mock('@wpkernel/pipeline/v1', () => ({
	createSerialPipeline: jest.fn(),
	runPipeline: jest.fn(),
	createHelper: jest.fn((options) => options),
}));

describe('createResourcePipeline diagnostics reporting', () => {
	const createPipelineMock = createSerialPipeline as jest.MockedFunction<
		typeof createSerialPipeline
	>;
	const runPipelineMock = runPipeline as jest.MockedFunction<
		typeof runPipeline
	>;

	beforeEach(() => {
		createPipelineMock.mockReturnValue({
			kind: 'serial-pipeline',
		} as never);
		runPipelineMock.mockReset();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('forwards diagnostics through reportPipelineDiagnostic', () => {
		const reportSpy = jest.spyOn(
			reportingModule,
			'reportPipelineDiagnostic'
		);

		createResourcePipeline();

		const pipelineOptions = createPipelineMock.mock.calls[0]?.[0];

		expect(pipelineOptions?.onDiagnostic).toBeDefined();

		const reporter = {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			child: jest.fn(),
		} as unknown as Reporter;
		const diagnostic: PipelineDiagnostic = {
			type: 'unused-helper',
			key: 'resource.helper',
			message: 'unused helper detected',
			dependsOn: [],
		};

		pipelineOptions?.onDiagnostic?.({ reporter, diagnostic });

		expect(reportSpy).toHaveBeenCalledWith({ reporter, diagnostic });
	});

	it('constructs the configured developer error type', () => {
		createResourcePipeline();
		const pipelineOptions = createPipelineMock.mock.calls[0]?.[0];

		const error = pipelineOptions?.createError?.(
			'DeveloperError',
			'configuration failed'
		);

		expect(error).toMatchObject({
			code: 'DeveloperError',
			message: 'configuration failed',
		});
	});

	it('projects synchronous resource outcomes and preserves failure and cancellation', () => {
		const pipeline = createResourcePipeline();

		runPipelineMock.mockReturnValue({
			kind: 'succeeded',
			result: { artifact: {}, diagnostics: [], steps: [] },
		} as never);
		expect(pipeline.run({} as never)).toEqual({
			artifact: {},
			diagnostics: [],
			steps: [],
		});

		const failure = new Error('resource failed');
		runPipelineMock.mockReturnValue({
			kind: 'failed',
			error: failure,
		} as never);
		expect(() => pipeline.run({} as never)).toThrow(failure);

		runPipelineMock.mockImplementation(() => {
			throw failure;
		});
		expect(() => pipeline.run({} as never)).toThrow(failure);

		runPipelineMock.mockReturnValue({
			get then(): never {
				throw failure;
			},
		} as never);
		expect(() => pipeline.run({} as never)).toThrow(failure);

		runPipelineMock.mockReturnValue({ kind: 'cancelled' } as never);
		expect(() => pipeline.run({} as never)).toThrow(
			'Resource pipeline run was cancelled.'
		);
	});

	it('rejects a detached resource pipeline authority', () => {
		const pipeline = createResourcePipeline();
		expect(() => pipeline.run.call({} as never, {} as never)).toThrow(
			'Invalid ResourcePipeline authority.'
		);
	});
});
