/* eslint-disable @wpkernel/no-hardcoded-layout-paths */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const showcaseRoot = resolve(process.cwd(), 'examples/showcase');

test('old generator output loads controllers from the current layout', async () => {
	const [pluginLoader, jobShim] = await Promise.all([
		readFile(resolve(showcaseRoot, 'plugin.php'), 'utf8'),
		readFile(resolve(showcaseRoot, 'inc/Rest/JobController.php'), 'utf8'),
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
});
