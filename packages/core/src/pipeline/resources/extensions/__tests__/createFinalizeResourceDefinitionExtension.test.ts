import { createFinalizeResourceDefinitionExtension } from '../createFinalizeResourceDefinitionExtension';
import * as eventBus from '../../../../events/bus';

describe('createFinalizeResourceDefinitionExtension', () => {
	const context = {
		namespace: 'tests',
	} as never;

	it('does not create a definition when no resource was built', async () => {
		const extension = createFinalizeResourceDefinitionExtension<
			unknown,
			unknown
		>();
		const lifecycle = (await extension.hook({
			context,
			options: {} as never,
			artifact: {},
			lifecycle: 'finalize',
		})) as { commit?: () => void; rollback?: () => void };

		expect(lifecycle.commit?.()).toBeUndefined();
		expect(lifecycle.rollback?.()).toBeUndefined();
	});

	it('records and removes a built resource definition', async () => {
		const resource = {} as never;
		const recordSpy = jest
			.spyOn(eventBus, 'recordResourceDefined')
			.mockImplementation(() => undefined);
		const removeSpy = jest
			.spyOn(eventBus, 'removeResourceDefined')
			.mockImplementation(() => undefined);
		const emitSpy = jest
			.spyOn(eventBus.getWPKernelEventBus(), 'emit')
			.mockImplementation(() => undefined);

		try {
			const extension = createFinalizeResourceDefinitionExtension<
				unknown,
				unknown
			>();
			const lifecycle = (await extension.hook({
				context,
				options: {} as never,
				artifact: { resource },
				lifecycle: 'finalize',
			})) as { commit?: () => void; rollback?: () => void };

			lifecycle.commit?.();
			lifecycle.rollback?.();

			expect(recordSpy).toHaveBeenCalledWith({
				namespace: 'tests',
				resource,
			});
			expect(emitSpy).toHaveBeenCalledWith('resource:defined', {
				namespace: 'tests',
				resource,
			});
			expect(removeSpy).toHaveBeenCalledWith({
				namespace: 'tests',
				resource,
			});
		} finally {
			recordSpy.mockRestore();
			removeSpy.mockRestore();
			emitSpy.mockRestore();
		}
	});
});
