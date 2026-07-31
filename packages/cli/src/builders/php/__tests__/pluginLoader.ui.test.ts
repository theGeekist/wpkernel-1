import type { IRv1 } from '../../../ir/publicTypes';
import { buildUiConfig } from '../pluginLoader.ui';

function buildIr(): IRv1 {
	return {
		meta: {
			namespace: 'acme-jobs',
		},
		resources: [
			{
				name: 'job',
				ui: {
					admin: {
						view: 'dataviews',
						dataviews: {
							preferencesKey: 'custom/jobs',
						},
					},
				},
			},
			{
				name: 'application',
				ui: {
					admin: {
						view: 'dataviews',
						dataviews: {},
					},
				},
			},
		],
		ui: {
			loader: {
				handle: 'wp-acme-jobs-ui',
				assetPath: 'build/index.asset.json',
				scriptPath: 'build/index.js',
				localizationObject: 'wpKernelUISettings',
				namespace: 'acme-jobs',
			},
			resources: [],
		},
		artifacts: {
			surfaces: {
				job: {
					resource: 'job',
					menu: { slug: 'acme-jobs', title: 'Jobs' },
				},
				application: {
					resource: 'application',
					menu: {
						slug: 'acme-applications',
						title: 'Applications',
					},
				},
			},
		},
	} as unknown as IRv1;
}

describe('buildUiConfig', () => {
	it('preserves configured preferences keys and derives the canonical fallback', () => {
		expect(buildUiConfig(buildIr())?.resources).toEqual([
			{
				resource: 'job',
				menu: { slug: 'acme-jobs', title: 'Jobs' },
				preferencesKey: 'custom/jobs',
			},
			{
				resource: 'application',
				menu: {
					slug: 'acme-applications',
					title: 'Applications',
				},
				preferencesKey: 'acme-jobs/dataviews/application',
			},
		]);
	});
});
