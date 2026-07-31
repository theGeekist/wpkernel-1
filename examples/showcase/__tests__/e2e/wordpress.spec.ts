import { expect, test } from './fixtures';

test.describe.configure({ mode: 'serial' });

test('publishes a healthy showcase REST namespace', async ({
	wordpressReady,
}) => {
	expect(wordpressReady.pluginStatus).toBe('active');
	expect(wordpressReady.namespace).toBe('acme/v1');
	expect(wordpressReady.routes).toContain('/acme/v1/jobs');
});

test('isolates and removes job fixture state by exact id', async ({
	requestUtils,
	trackedJob,
}) => {
	const jobs = await requestUtils.rest<Array<{ id: number; title: string }>>({
		path: '/acme/v1/jobs',
		method: 'GET',
	});

	expect(jobs).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				id: trackedJob.id,
				title: trackedJob.title,
			}),
		])
	);
});

test('renders the generated jobs DataView without browser errors', async ({
	admin,
	adminSession,
	browserDiagnostics,
	kernel,
	page,
	wordpressReady,
}) => {
	void adminSession;
	void wordpressReady;
	await admin.visitAdminPage('admin.php', 'page=acme-jobs');

	await expect(page.locator('#wpkernel-admin-screen')).toBeVisible();
	await expect(page.locator('script[src*="/build/index.js"]')).toHaveCount(1);

	const jobs = kernel.dataview({
		namespace: 'acme-jobs',
		resource: 'job',
	});
	await expect(jobs.root()).toBeVisible();
	await jobs.waitForLoaded();

	expect(browserDiagnostics.consoleErrors).toEqual([]);
	expect(browserDiagnostics.pageErrors).toEqual([]);
});
