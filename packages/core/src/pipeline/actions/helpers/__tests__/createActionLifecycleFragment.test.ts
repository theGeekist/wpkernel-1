import type { ActionPipelineContext } from '../../types';
import type { ResolvedActionOptions } from '../../../../actions/types';
import type { Reporter } from '../../../../reporter/types';

jest.mock('../../../../actions/context', () => ({
	emitLifecycleEvent: jest.fn(),
}));

jest.mock('../../../../actions/lifecycle', () => ({
	createActionLifecycleEvent: jest.fn((phase: string) => ({ phase })),
}));

jest.mock('../timing', () => ({
	readMonotonicTime: jest.fn(() => 12),
}));

import { emitLifecycleEvent } from '../../../../actions/context';
import { createActionLifecycleEvent } from '../../../../actions/lifecycle';
import { createActionLifecycleFragment } from '../createActionLifecycleFragment';

describe('createActionLifecycleFragment', () => {
	const reporter = {} as Reporter;
	const baseContext: ActionPipelineContext<{ value: number }, string> = {
		actionContext: {} as never,
		actionName: 'Test.Action',
		namespace: 'test',
		reporter,
		requestId: 'request-id',
		resolvedOptions: {
			scope: 'crossTab',
			bridged: true,
		} satisfies ResolvedActionOptions,
		config: {
			name: 'Test.Action',
			handler: async () => 'ok',
		},
		args: { value: 1 },
		definition: {
			action: (async () => undefined) as never,
			namespace: 'test',
		},
	};

	it('captures start time and emits the start lifecycle event', async () => {
		const helper = createActionLifecycleFragment<
			{ value: number },
			string
		>();
		const output: Record<string, unknown> = {};
		const startEvent = { phase: 'start' };
		jest.mocked(createActionLifecycleEvent).mockReturnValue(
			startEvent as never
		);

		await helper.apply({
			context: baseContext,
			reporter,
			input: { args: { value: 9 } },
			output,
		});

		expect(output.startTime).toBe(12);
		expect(output).toMatchObject({ startTime: 12 });
		expect(createActionLifecycleEvent).toHaveBeenCalledWith(
			'start',
			baseContext.resolvedOptions,
			baseContext.actionName,
			baseContext.requestId,
			baseContext.namespace,
			{ args: { value: 9 } }
		);
		expect(emitLifecycleEvent).toHaveBeenCalledWith(startEvent);
	});

	it('rejects initialisation without resolved options', async () => {
		const helper = createActionLifecycleFragment<
			{ value: number },
			string
		>();
		await expect(
			helper.apply({
				context: { ...baseContext, resolvedOptions: undefined },
				reporter,
				input: { args: { value: 1 } },
				output: {},
			})
		).rejects.toMatchObject({ code: 'DeveloperError' });
	});

	it('rejects initialisation without an assembled action context', async () => {
		const helper = createActionLifecycleFragment<
			{ value: number },
			string
		>();
		await expect(
			helper.apply({
				context: { ...baseContext, actionContext: undefined },
				reporter,
				input: { args: { value: 1 } },
				output: {},
			})
		).rejects.toMatchObject({ code: 'DeveloperError' });
	});
});
