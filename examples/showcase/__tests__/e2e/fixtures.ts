/* eslint-disable react-hooks/rules-of-hooks */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { TestInfo } from '@playwright/test';
import {
	test as wordpressTest,
	expect,
} from '@wordpress/e2e-test-utils-playwright';
import { createWPKernelUtils } from '@wpkernel/e2e-utils/createWPKernelUtils';
import type { WPKernelUtils } from '@wpkernel/e2e-utils/types';
import {
	collectWordPressDiagnostics,
	waitForWordPress,
	type WordPressReadiness,
} from './support/wordpress-runtime';

interface Job {
	created_at: string;
	id: number;
	status: string;
	title: string;
}

interface BrowserDiagnostics {
	consoleErrors: string[];
	pageErrors: string[];
}

interface E2EFixtures {
	adminSession: boolean;
	browserDiagnostics: BrowserDiagnostics;
	trackedJob: Job;
	wordpressReady: WordPressReadiness;
}

const base = wordpressTest.extend<{ kernel: WPKernelUtils }>({
	kernel: async ({ page, requestUtils, admin, editor, pageUtils }, use) => {
		await use(
			createWPKernelUtils({
				admin,
				editor,
				page,
				pageUtils,
				requestUtils,
			})
		);
	},
});

async function attachText(
	testInfo: TestInfo,
	name: string,
	body: string,
	contentType = 'text/plain'
): Promise<void> {
	const artifactPath = testInfo.outputPath(name);
	await mkdir(dirname(artifactPath), { recursive: true });
	await writeFile(artifactPath, body, 'utf8');
	await testInfo.attach(name, {
		path: artifactPath,
		contentType,
	});
}

export const test = base.extend<E2EFixtures>({
	adminSession: async ({ page, wordpressReady }, use) => {
		void wordpressReady;
		await page.goto('/wp-login.php');
		await page
			.locator('#user_login')
			.fill(process.env.WP_USERNAME ?? 'admin');
		await page
			.locator('#user_pass')
			.fill(process.env.WP_PASSWORD ?? 'password');
		await Promise.all([
			page.waitForURL(/\/wp-admin\//u),
			page.locator('#wp-submit').click(),
		]);
		await use(true);
	},

	wordpressReady: async ({ baseURL }, use, testInfo) => {
		if (!baseURL) {
			throw new Error(
				'Playwright baseURL is required for WordPress E2E.'
			);
		}

		try {
			const readiness = await waitForWordPress(baseURL);
			await attachText(
				testInfo,
				'wordpress-readiness.json',
				JSON.stringify(readiness, null, 2),
				'application/json'
			);
			await use(readiness);
		} catch (error) {
			await attachText(
				testInfo,
				'wordpress-diagnostics.json',
				await collectWordPressDiagnostics(),
				'application/json'
			);
			throw error;
		}
	},

	browserDiagnostics: [
		async ({ page }, use, testInfo) => {
			const diagnostics: BrowserDiagnostics = {
				consoleErrors: [],
				pageErrors: [],
			};

			page.on('console', (message) => {
				if (message.type() === 'error') {
					diagnostics.consoleErrors.push(message.text());
				}
			});
			page.on('pageerror', (error) => {
				diagnostics.pageErrors.push(error.stack ?? error.message);
			});

			await use(diagnostics);

			if (
				testInfo.status !== testInfo.expectedStatus ||
				diagnostics.consoleErrors.length > 0 ||
				diagnostics.pageErrors.length > 0
			) {
				await attachText(
					testInfo,
					'browser-diagnostics.json',
					JSON.stringify(diagnostics, null, 2),
					'application/json'
				);
			}
		},
	],

	trackedJob: async ({ requestUtils, wordpressReady }, use, testInfo) => {
		void wordpressReady;
		const unique = `${testInfo.workerIndex}-${Date.now()}`;
		let created: Job | undefined;

		try {
			created = await requestUtils.rest<Job>({
				path: '/acme/v1/jobs',
				method: 'POST',
				data: {
					created_at: new Date().toISOString(),
					id: Date.now(),
					status: 'draft',
					title: `E2E isolated job ${unique}`,
				},
			});

			if (!created || typeof created.id !== 'number') {
				throw new Error(
					`Job creation did not return a numeric id: ${JSON.stringify(created)}`
				);
			}

			await use(created);
		} finally {
			if (created?.id) {
				try {
					await requestUtils.rest({
						path: `/acme/v1/jobs/${created.id}`,
						method: 'DELETE',
					});
				} catch (error) {
					await attachText(
						testInfo,
						'fixture-cleanup-error.txt',
						`Failed to delete job ${created.id}: ${String(error)}`
					);
					throw error;
				}
			}
		}
	},
});

export { expect };
