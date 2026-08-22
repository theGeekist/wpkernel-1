import { createSerialPipeline, runPipeline } from '@wpkernel/pipeline/v1';
import { createActionPipeline } from '../createActionPipeline';
import type { Reporter } from '../../../reporter/types';
import type { PipelineDiagnostic } from '@wpkernel/pipeline/v1';
import * as reportingModule from '../../reporting';
import { resetResolvedActionReporters } from '../../../actions/resolveReporter';

jest.mock('@wpkernel/pipeline/v1', () => ({
	createSerialPipeline: jest.fn(),
	runPipeline: jest.fn(),
	createHelper: jest.fn((options) => options),
}));

describe('createActionPipeline diagnostics reporting', () => {
	const createPipelineMock = createSerialPipeline as jest.MockedFunction<
		typeof createSerialPipeline
	>;
	const runPipelineMock = runPipeline as jest.MockedFunction<
		typeof runPipeline
	>;

	let originalRuntime: typeof global.__WP_KERNEL_ACTION_RUNTIME__;
	let originalSilentFlag: string | undefined;

	beforeEach(() => {
		originalRuntime = global.__WP_KERNEL_ACTION_RUNTIME__;
		originalSilentFlag = process.env.WPK_SILENT_REPORTERS;
		global.__WP_KERNEL_ACTION_RUNTIME__ = undefined;
		createPipelineMock.mockReturnValue({
			kind: 'serial-pipeline',
		} as never);
		runPipelineMock.mockReset();
	});

	afterEach(() => {
		jest.clearAllMocks();
		resetResolvedActionReporters();
		global.__WP_KERNEL_ACTION_RUNTIME__ = originalRuntime;
		if (typeof originalSilentFlag === 'undefined') {
			delete process.env.WPK_SILENT_REPORTERS;
		} else {
			process.env.WPK_SILENT_REPORTERS = originalSilentFlag;
		}
	});

	it('forwards diagnostics through reportPipelineDiagnostic', () => {
		const reportSpy = jest.spyOn(
			reportingModule,
			'reportPipelineDiagnostic'
		);

		createActionPipeline();

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
			type: 'conflict',
			key: 'test.helper',
			message: 'conflict detected',
			helpers: ['a', 'b'],
			mode: 'extend',
		};

		pipelineOptions?.onDiagnostic?.({ reporter, diagnostic });

		expect(reportSpy).toHaveBeenCalledWith({ reporter, diagnostic });
	});

	it('constructs the configured developer error type', () => {
		createActionPipeline();
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

	it('projects synchronous action outcomes and preserves failure and cancellation', () => {
		const pipeline = createActionPipeline();

		runPipelineMock.mockReturnValue({
			kind: 'succeeded',
			result: { artifact: {}, diagnostics: [], steps: [] },
		} as never);
		expect(pipeline.run({} as never)).toEqual({
			artifact: {},
			diagnostics: [],
			steps: [],
		});

		const failure = new Error('action failed');
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
			'Action pipeline run was cancelled.'
		);
	});

	it('rejects a detached action pipeline authority', () => {
		const pipeline = createActionPipeline();
		expect(() => pipeline.run.call({} as never, {} as never)).toThrow(
			'Invalid ActionPipeline authority.'
		);
	});

	it('reuses the fallback reporter between pipeline runs', () => {
		global.__WP_KERNEL_ACTION_RUNTIME__ = undefined;

		createActionPipeline();

		const pipelineOptions = createPipelineMock.mock.calls[0]?.[0];

		const runOptions = {
			config: { name: 'test.action', handler: jest.fn() },
			args: {},
			definition: {
				action: { key: 'test', name: 'test.action' },
				namespace: 'wpk/test',
			},
			registry: undefined,
		};

		const firstContext = pipelineOptions?.createContext?.(
			runOptions as never
		);
		const secondContext = pipelineOptions?.createContext?.(
			runOptions as never
		);

		expect(firstContext?.reporter).toBe(secondContext?.reporter);
	});

	it('returns a noop reporter when silent reporting is enabled', () => {
		process.env.WPK_SILENT_REPORTERS = '1';

		const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

		createActionPipeline();

		const pipelineOptions = createPipelineMock.mock.calls[0]?.[0];
		const runOptions = {
			config: { name: 'test.action', handler: jest.fn() },
			args: {},
			definition: {
				action: { key: 'test', name: 'test.action' },
				namespace: 'wpk/test',
			},
			registry: undefined,
		};

		const context = pipelineOptions?.createContext?.(runOptions as never);

		expect(typeof context?.reporter?.warn).toBe('function');
		context?.reporter?.warn?.('should not log');

		expect(consoleWarnSpy).not.toHaveBeenCalled();

		consoleWarnSpy.mockRestore();
	});

	it('reports every diagnostic variant and preserves diagnostic order', () => {
		const reporter = {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			child: jest.fn(),
		} as unknown as Reporter;
		const diagnostics: PipelineDiagnostic[] = [
			{
				type: 'missing-dependency',
				key: 'action.missing',
				dependency: 'action.prerequisite',
				helper: 'action.missing',
				kind: 'fragment',
				message: 'missing dependency',
			},
			{
				type: 'unused-helper',
				key: 'action.unused',
				helper: 'action.unused',
				dependsOn: ['action.prerequisite'],
				kind: 'fragment',
				message: 'unused helper',
			},
		];

		reportingModule.reportPipelineDiagnostics({ reporter, diagnostics });

		expect(reporter.warn).toHaveBeenCalledTimes(2);
		expect(reporter.warn).toHaveBeenNthCalledWith(
			1,
			'Pipeline diagnostic reported.',
			expect.objectContaining({
				type: 'missing-dependency',
				dependency: 'action.prerequisite',
			})
		);
		expect(reporter.warn).toHaveBeenNthCalledWith(
			2,
			'Pipeline diagnostic reported.',
			expect.objectContaining({
				type: 'unused-helper',
				dependsOn: ['action.prerequisite'],
			})
		);
	});
});
