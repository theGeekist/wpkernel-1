/* eslint-disable @wpkernel/no-hardcoded-layout-paths */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const showcaseRoot = resolve(process.cwd(), 'examples/showcase');

test('generated output uses the applied controller layout and concrete edit routes', async () => {
	const [pluginLoader, jobShim, jobForm, applicationForm, applicationConfig] =
		await Promise.all([
		readFile(resolve(showcaseRoot, 'plugin.php'), 'utf8'),
		readFile(resolve(showcaseRoot, 'inc/Rest/JobController.php'), 'utf8'),
		readFile(
			resolve(showcaseRoot, 'src/app/job/@acme/jobs-admin/form.tsx'),
			'utf8'
		),
		readFile(
			resolve(showcaseRoot, 'src/app/application/form.tsx'),
			'utf8'
		),
		readFile(
			resolve(showcaseRoot, 'src/app/application/config.tsx'),
			'utf8'
		),
	]);

	expect
		.soft(pluginLoader)
		.toContain("require_once __DIR__ . '/inc/Rest/JobController.php'");
	expect
		.soft(jobShim)
		.toMatch(
			/class JobController extends (?:\\)?Acme\\Jobs\\Generated\\Rest\\JobController/
		);
	expect
		.soft(jobShim)
		.toContain(
			"require_once(__DIR__ . '/../../.wpk/generate/php/Rest/JobController.php')"
		);
	expect.soft(jobForm).toContain(
		'const fetchPath = `/acme/v1/jobs/${editId}`;'
	);
	expect.soft(applicationForm).toContain(
		'const fetchPath = `/acme/v1/applications/${editId}`;'
	);
	expect(applicationConfig.match(/id: 'status'/gu)).toHaveLength(1);
	expect(applicationConfig.match(/'status'/gu)).toHaveLength(2);
});
