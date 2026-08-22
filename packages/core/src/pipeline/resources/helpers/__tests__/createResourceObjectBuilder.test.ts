import type { ResourcePipelineContext } from '../../types';
import type { Reporter } from '../../../../reporter/types';
import { createResourceObjectBuilder } from '../createResourceObjectBuilder';

describe('createResourceObjectBuilder', () => {
	const context = {
		config: {},
		normalizedConfig: {},
		namespace: 'tests',
		resourceName: 'Post',
		reporter: {} as Reporter,
		storeKey: 'tests/Post',
	} as ResourcePipelineContext<unknown, unknown>;

	it('rejects a missing resource client', () => {
		const helper = createResourceObjectBuilder<unknown, unknown>();

		expect(() =>
			helper.apply({
				context,
				reporter: context.reporter,
				input: context.config,
				output: {},
			})
		).toThrow(
			'Resource pipeline executed without a client instance. Ensure resource.client.build runs first.'
		);
	});

	it('rejects cache-less client output', () => {
		const helper = createResourceObjectBuilder<unknown, unknown>();

		expect(() =>
			helper.apply({
				context,
				reporter: context.reporter,
				input: context.config,
				output: { client: {} as never },
			})
		).toThrow(
			'Resource pipeline executed without cache keys. Ensure resource.cacheKeys.build runs first.'
		);
	});
});
