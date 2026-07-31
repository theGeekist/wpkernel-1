import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createWorkspaceRunner } from '../integration/workspace';
import {
	CURRENT_BETA_CLI_FIXTURE_VERSION,
	RELEASED_CLI_FIXTURE_VERSION,
	VERSIONED_CLI_FIXTURE_IDS,
	VERSIONED_CLI_FIXTURE_PATHS,
	VERSIONED_CLI_FIXTURE_SCHEMA_VERSION,
	VERSIONED_CLI_PROJECT_FIXTURES,
	getVersionedCliProjectFixture,
	materializeVersionedCliProjectFixture,
	type VersionedCliFixtureId,
} from '../cli/versioned-project-fixtures.test-support';

const execFileAsync = promisify(execFile);
const withWorkspace = createWorkspaceRunner({
	chdir: false,
});

describe('versioned CLI project fixtures', () => {
	it('covers the complete CLI-010 migration matrix', () => {
		expect(Object.keys(VERSIONED_CLI_PROJECT_FIXTURES).sort()).toEqual(
			[...VERSIONED_CLI_FIXTURE_IDS].sort()
		);

		for (const fixtureId of VERSIONED_CLI_FIXTURE_IDS) {
			const fixture = getVersionedCliProjectFixture(fixtureId);
			expect(fixture).toMatchObject({
				schemaVersion: VERSIONED_CLI_FIXTURE_SCHEMA_VERSION,
				id: fixtureId,
				targetCliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
			});
		}
	});

	it.each(VERSIONED_CLI_FIXTURE_IDS)(
		'materializes the %s project state with its path and repository contract',
		async (fixtureId) => {
			await withWorkspace(async (workspaceRoot) => {
				const fixture = await materializeVersionedCliProjectFixture(
					workspaceRoot,
					fixtureId
				);

				for (const relativePath of fixture.expected.presentPaths) {
					await expect(
						pathExists(workspaceRoot, relativePath)
					).resolves.toBe(true);
				}

				for (const relativePath of fixture.expected.absentPaths) {
					await expect(
						pathExists(workspaceRoot, relativePath)
					).resolves.toBe(false);
				}

				await expectRepositoryState(workspaceRoot, fixtureId);
			});
		}
	);

	it('pins released and beta projects to distinct upgrade sources', () => {
		const released = getVersionedCliProjectFixture('released');
		const currentBeta = getVersionedCliProjectFixture('current-beta');

		expect(released.sourceCliVersion).toBe(RELEASED_CLI_FIXTURE_VERSION);
		expect(currentBeta.sourceCliVersion).toBe(
			CURRENT_BETA_CLI_FIXTURE_VERSION
		);
		expect(released.sourceCliVersion).not.toBe(
			currentBeta.sourceCliVersion
		);
	});

	it('keeps committed user code outside generated ownership guards', async () => {
		await withWorkspace(async (workspaceRoot) => {
			const fixture = await materializeVersionedCliProjectFixture(
				workspaceRoot,
				'user-edited'
			);
			const plugin = await fs.readFile(
				path.join(workspaceRoot, VERSIONED_CLI_FIXTURE_PATHS.plugin),
				'utf8'
			);
			const guardEnd = plugin.indexOf('// WPK:END AUTO');
			const userHook = plugin.indexOf('function acme_fixture_user_hook');

			expect(fixture.expected.preservedUserPaths).toContain(
				VERSIONED_CLI_FIXTURE_PATHS.plugin
			);
			expect(guardEnd).toBeGreaterThanOrEqual(0);
			expect(userHook).toBeGreaterThan(guardEnd);
		});
	});

	it('represents an apply conflict with distinct base, current, and incoming content', async () => {
		await withWorkspace(async (workspaceRoot) => {
			await materializeVersionedCliProjectFixture(
				workspaceRoot,
				'conflicted'
			);

			const [base, current, incoming, rawPlan] = await Promise.all([
				readWorkspaceFile(
					workspaceRoot,
					VERSIONED_CLI_FIXTURE_PATHS.applyBasePlugin
				),
				readWorkspaceFile(
					workspaceRoot,
					VERSIONED_CLI_FIXTURE_PATHS.plugin
				),
				readWorkspaceFile(
					workspaceRoot,
					VERSIONED_CLI_FIXTURE_PATHS.applyIncomingPlugin
				),
				readWorkspaceFile(
					workspaceRoot,
					VERSIONED_CLI_FIXTURE_PATHS.applyPlan
				),
			]);
			const plan = JSON.parse(rawPlan) as {
				instructions: Array<{
					file: string;
					base: string;
					incoming: string;
				}>;
			};

			expect(new Set([base, current, incoming])).toHaveProperty(
				'size',
				3
			);
			expect(plan.instructions).toEqual([
				expect.objectContaining({
					file: VERSIONED_CLI_FIXTURE_PATHS.plugin,
					base: VERSIONED_CLI_FIXTURE_PATHS.applyBasePlugin,
					incoming: VERSIONED_CLI_FIXTURE_PATHS.applyIncomingPlugin,
				}),
			]);
		});
	});

	it('represents an interrupted apply as staged files without a published plan', async () => {
		await withWorkspace(async (workspaceRoot) => {
			await materializeVersionedCliProjectFixture(
				workspaceRoot,
				'interrupted'
			);

			await expect(
				pathExists(
					workspaceRoot,
					VERSIONED_CLI_FIXTURE_PATHS.applyBasePlugin
				)
			).resolves.toBe(true);
			await expect(
				pathExists(
					workspaceRoot,
					VERSIONED_CLI_FIXTURE_PATHS.applyIncomingPlugin
				)
			).resolves.toBe(true);
			await expect(
				pathExists(workspaceRoot, VERSIONED_CLI_FIXTURE_PATHS.applyPlan)
			).resolves.toBe(false);
		});
	});

	it.each([
		['renamed-resource', ['job'], ['position']],
		['removed-resource', ['job', 'settings'], ['job']],
	] as const)(
		'keeps prior generation state for the %s transition',
		async (fixtureId, before, desired) => {
			await withWorkspace(async (workspaceRoot) => {
				const fixture = await materializeVersionedCliProjectFixture(
					workspaceRoot,
					fixtureId
				);
				const generationState = JSON.parse(
					await readWorkspaceFile(
						workspaceRoot,
						VERSIONED_CLI_FIXTURE_PATHS.applyState
					)
				) as { resources: Record<string, unknown> };
				const config = await readWorkspaceFile(
					workspaceRoot,
					VERSIONED_CLI_FIXTURE_PATHS.config
				);

				expect(fixture.resources).toEqual({ before, desired });
				expect(Object.keys(generationState.resources).sort()).toEqual(
					[...before].sort()
				);
				for (const desiredResource of desired) {
					expect(config).toContain(`${desiredResource}: {`);
				}
			});
		}
	);
});

async function expectRepositoryState(
	workspaceRoot: string,
	fixtureId: VersionedCliFixtureId
): Promise<void> {
	const expectedState =
		getVersionedCliProjectFixture(fixtureId).expected.repository;
	const gitDirectoryExists = await pathExists(workspaceRoot, '.git');

	if (expectedState === 'absent') {
		expect(gitDirectoryExists).toBe(false);
		return;
	}

	expect(gitDirectoryExists).toBe(true);
	const { stdout } = await execFileAsync(
		'git',
		['status', '--porcelain', '--untracked-files=all'],
		{ cwd: workspaceRoot }
	);

	if (expectedState === 'clean') {
		expect(stdout).toBe('');
		return;
	}

	expect(stdout.trim()).not.toBe('');
}

async function pathExists(
	workspaceRoot: string,
	relativePath: string
): Promise<boolean> {
	try {
		await fs.access(path.join(workspaceRoot, relativePath));
		return true;
	} catch {
		return false;
	}
}

async function readWorkspaceFile(
	workspaceRoot: string,
	relativePath: string
): Promise<string> {
	return fs.readFile(path.join(workspaceRoot, relativePath), 'utf8');
}
