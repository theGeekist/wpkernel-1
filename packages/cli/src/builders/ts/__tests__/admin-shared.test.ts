import {
	resolveAdminDataViews,
	resolveAdminScreenComponentMetadata,
	resolveInteractivityFeature,
	resolveListRoutePath,
	usesAdminDataViews,
} from '../admin-shared';
import type { AdminScreenResourceDescriptor } from '../admin-shared';

const makeDescriptor = (
	overrides: Partial<AdminScreenResourceDescriptor> = {}
): AdminScreenResourceDescriptor => ({
	key: 'job',
	name: 'Job',
	resource: {
		name: 'Job',
		routes: [],
	} as any,
	menu: { slug: 'job', title: 'Job' },
	adminView: 'admin-screen',
	...overrides,
});

describe('admin-shared helpers', () => {
	it('prefers custom interactivity feature and trims whitespace', () => {
		const feature = resolveInteractivityFeature(
			makeDescriptor({
				dataviews: { interactivity: { feature: '  custom  ' } } as any,
			})
		);
		expect(feature).toBe('custom');
	});

	it('falls back to admin-screen interactivity feature when missing/empty', () => {
		expect(resolveInteractivityFeature(makeDescriptor())).toBe(
			'admin-screen'
		);
		expect(
			resolveInteractivityFeature(
				makeDescriptor({
					dataviews: { interactivity: { feature: '   ' } } as any,
				})
			)
		).toBe('admin-screen');
	});

	it('resolves canonical nested DataViews screen metadata from the resource', () => {
		const descriptor = makeDescriptor({
			resource: {
				name: 'Job',
				routes: [],
				ui: {
					admin: {
						view: 'dataviews',
						dataviews: {
							interactivity: { feature: 'nested-feature' },
							screen: {
								component: '@acme/jobs-admin/JobListScreen',
							},
						},
					},
				},
			} as any,
			dataviews: undefined,
		});

		expect(usesAdminDataViews(descriptor)).toBe(true);
		expect(resolveAdminDataViews(descriptor)).toEqual({
			interactivity: { feature: 'nested-feature' },
			screen: {
				component: '@acme/jobs-admin/JobListScreen',
			},
		});
		expect(resolveInteractivityFeature(descriptor)).toBe('nested-feature');
		expect(resolveAdminScreenComponentMetadata(descriptor)).toEqual({
			identifier: 'JobListScreen',
			fileName: 'JobListScreen',
			directories: ['@acme', 'jobs-admin'],
		});
	});

	it('returns list route for first GET without params', () => {
		const descriptor = makeDescriptor({
			resource: {
				routes: [
					{ method: 'POST', path: '/v1/job' },
					{ method: 'GET', path: '/v1/job' },
					{ method: 'GET', path: '/v1/job/:id' },
				],
			} as any,
		});
		expect(resolveListRoutePath(descriptor)).toBe('/v1/job');
	});

	it('skips routes containing params or templated segments', () => {
		const descriptor = makeDescriptor({
			resource: {
				routes: [
					{ method: 'GET', path: '/v1/job/:id' },
					{ method: 'GET', path: '/v1/job/(?P<id>\\d+)' },
					{ method: 'GET', path: '/v1/job/{id}' },
				],
			} as any,
		});
		expect(resolveListRoutePath(descriptor)).toBeNull();
	});
});
