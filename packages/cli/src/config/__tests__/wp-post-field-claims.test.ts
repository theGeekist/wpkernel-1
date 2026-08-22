import type { ResourceConfig } from '@wpkernel/core/resource';
import { findWpPostFieldClaimConflict } from '../wp-post-field-claims';

function createResource(
	overrides: Partial<ResourceConfig> = {}
): ResourceConfig {
	return {
		name: 'thing',
		routes: {
			get: { method: 'GET', path: '/things/:id' },
		},
		storage: { mode: 'wp-post', postType: 'thing' },
		...overrides,
	} as ResourceConfig;
}

describe('wp-post authoritative field claims', () => {
	it.each([
		['title', 'the wp-post entity contract'],
		['page', 'the wp-post query contract'],
	] as const)('detects reserved field %s', (key, existing) => {
		const resource = createResource({
			storage: {
				mode: 'wp-post',
				postType: 'thing',
				meta: { [key]: { type: 'string' } },
			},
		});

		expect(findWpPostFieldClaimConflict(resource)).toEqual({
			key,
			existing,
			claimant: 'storage.meta',
		});
	});

	it('preserves claim order across meta and taxonomies', () => {
		const resource = createResource({
			storage: {
				mode: 'wp-post',
				postType: 'thing',
				meta: { shared: { type: 'string' } },
				taxonomies: {
					shared: { taxonomy: 'thing_shared' },
				},
			},
		});

		expect(findWpPostFieldClaimConflict(resource)).toEqual({
			key: 'shared',
			existing: 'storage.meta',
			claimant: 'storage.taxonomies',
		});
	});

	it.each(['id', 'slug'] as const)(
		'accepts canonical %s identity without a second claim',
		(param) => {
			const resource = createResource({
				identity: { type: 'string', param },
				routes: {
					get: { method: 'GET', path: `/things/:${param}` },
				},
			});

			expect(findWpPostFieldClaimConflict(resource)).toBeUndefined();
		}
	);

	it.each([true, false])('detects a %s uuid identity claim', (explicit) => {
		const resource = createResource({
			identity: explicit ? { type: 'string', param: 'uuid' } : undefined,
			routes: {
				get: { method: 'GET', path: '/things/:uuid' },
			},
			storage: {
				mode: 'wp-post',
				postType: 'thing',
				meta: { uuid: { type: 'string' } },
			},
		});

		expect(findWpPostFieldClaimConflict(resource)).toEqual({
			key: 'uuid',
			existing: 'the resource identity',
			claimant: 'storage.meta',
		});
	});

	it('ignores non wp-post storage', () => {
		const resource = createResource({ storage: { mode: 'transient' } });
		expect(findWpPostFieldClaimConflict(resource)).toBeUndefined();
	});
});
