import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { WPK_CONFIG_SOURCES } from '@wpkernel/core/contracts';
import { loadTestLayoutSync } from '../layout.test-support.js';

const execFileAsync = promisify(execFile);

export const VERSIONED_CLI_FIXTURE_SCHEMA_VERSION = 1 as const;
export const RELEASED_CLI_FIXTURE_VERSION = '0.11.0';
export const CURRENT_BETA_CLI_FIXTURE_VERSION = '0.12.6-beta.3';

export const VERSIONED_CLI_FIXTURE_IDS = [
	'new',
	'released',
	'current-beta',
	'user-edited',
	'dirty',
	'conflicted',
	'interrupted',
	'renamed-resource',
	'removed-resource',
] as const;

export type VersionedCliFixtureId = (typeof VERSIONED_CLI_FIXTURE_IDS)[number];

export type VersionedCliProjectState =
	| 'new'
	| 'ready'
	| 'user-edited'
	| 'dirty'
	| 'conflicted'
	| 'interrupted'
	| 'renamed-resource'
	| 'removed-resource';

export interface VersionedCliResourceTransition {
	readonly before: readonly string[];
	readonly desired: readonly string[];
}

export interface VersionedCliFixtureExpectation {
	readonly repository: 'absent' | 'clean' | 'dirty';
	readonly presentPaths: readonly string[];
	readonly absentPaths: readonly string[];
	readonly preservedUserPaths: readonly string[];
}

export interface VersionedCliProjectFixture {
	readonly schemaVersion: typeof VERSIONED_CLI_FIXTURE_SCHEMA_VERSION;
	readonly id: VersionedCliFixtureId;
	readonly projectState: VersionedCliProjectState;
	readonly sourceCliVersion: string | null;
	readonly targetCliVersion: string;
	readonly resources: VersionedCliResourceTransition;
	readonly baselineFiles: Readonly<Record<string, string>>;
	readonly workspaceFiles: Readonly<Record<string, string>>;
	readonly deletedPaths: readonly string[];
	readonly expected: VersionedCliFixtureExpectation;
}

const JOB_RESOURCE = 'job';
const POSITION_RESOURCE = 'position';
const SETTINGS_RESOURCE = 'settings';
const FIXTURE_LAYOUT = loadTestLayoutSync();
const CONFIG_PATH = WPK_CONFIG_SOURCES.WPK_CONFIG_TS;
const PACKAGE_PATH = 'package.json';
const PLUGIN_PATH = FIXTURE_LAYOUT.resolve('plugin.loader');
const CONTROLLERS_PATH = FIXTURE_LAYOUT.resolve('controllers.applied');
const PHP_GENERATED_PATH = FIXTURE_LAYOUT.resolve('php.generated');
const JOB_CONTROLLER_PATH = path.posix.join(
	CONTROLLERS_PATH,
	'JobController.php'
);
const POSITION_CONTROLLER_PATH = path.posix.join(
	CONTROLLERS_PATH,
	'PositionController.php'
);
const SETTINGS_CONTROLLER_PATH = path.posix.join(
	CONTROLLERS_PATH,
	'SettingsController.php'
);
const APPLY_STATE_PATH = FIXTURE_LAYOUT.resolve('apply.state');
const APPLY_PLAN_PATH = FIXTURE_LAYOUT.resolve('plan.manifest');
const APPLY_BASE_PLUGIN_PATH = path.posix.join(
	FIXTURE_LAYOUT.resolve('plan.base'),
	PLUGIN_PATH
);
const APPLY_INCOMING_PLUGIN_PATH = path.posix.join(
	FIXTURE_LAYOUT.resolve('plan.incoming'),
	PLUGIN_PATH
);

export const VERSIONED_CLI_FIXTURE_PATHS = {
	config: CONFIG_PATH,
	package: PACKAGE_PATH,
	plugin: PLUGIN_PATH,
	jobController: JOB_CONTROLLER_PATH,
	positionController: POSITION_CONTROLLER_PATH,
	settingsController: SETTINGS_CONTROLLER_PATH,
	applyState: APPLY_STATE_PATH,
	applyPlan: APPLY_PLAN_PATH,
	applyBasePlugin: APPLY_BASE_PLUGIN_PATH,
	applyIncomingPlugin: APPLY_INCOMING_PLUGIN_PATH,
} as const;

function buildPackageJson(cliVersion: string): string {
	return `${JSON.stringify(
		{
			name: 'acme-cli-fixture',
			private: true,
			type: 'module',
			scripts: {
				generate: 'wpk generate',
				apply: 'wpk apply',
			},
			devDependencies: {
				'@wpkernel/cli': cliVersion,
			},
		},
		null,
		2
	)}\n`;
}

function buildResourceConfig(resourceNames: readonly string[]): string {
	const resources = resourceNames
		.map(
			(resourceName) => `\t\t${resourceName}: {
\t\t\tname: '${resourceName}',
\t\t\troutes: {
\t\t\t\tlist: {
\t\t\t\t\tpath: '/acme/v1/${resourceName}',
\t\t\t\t\tmethod: 'GET',
\t\t\t\t},
\t\t\t},
\t\t\tidentity: {
\t\t\t\ttype: 'number',
\t\t\t\tparam: 'id',
\t\t\t},
\t\t\tstorage: {
\t\t\t\tmode: 'wp-option',
\t\t\t\toptionName: 'acme_${resourceName}',
\t\t\t},
\t\t}`
		)
		.join(',\n');

	return `import type { WPKernelConfigV1 } from '@wpkernel/cli/config/types';

export const wpkConfig: WPKernelConfigV1 = {
\tversion: 1,
\tnamespace: 'acme-fixture',
\tschemas: {},
\tresources: {
${resources}
\t},
};

export type WPKernelConfig = typeof wpkConfig;
`;
}

function buildPluginLoader(options: {
	readonly generatedLabel: string;
	readonly userCode?: string;
}): string {
	const userCode = options.userCode ? `\n${options.userCode.trim()}\n` : '\n';

	return `<?php
/**
 * Plugin Name: Acme CLI Fixture
 */

// WPK:BEGIN AUTO
function acme_fixture_generated_version(): string
{
    return '${options.generatedLabel}';
}
// WPK:END AUTO
${userCode}`;
}

function buildController(resourceName: string): string {
	const className = `${resourceName[0]!.toUpperCase()}${resourceName.slice(
		1
	)}Controller`;

	return `<?php

namespace AcmeFixture\\Rest;

class ${className}
{
}
`;
}

function buildGenerationState(resources: readonly string[]): string {
	const entries = Object.fromEntries(
		resources.map((resourceName) => {
			const className = `${resourceName[0]!.toUpperCase()}${resourceName.slice(
				1
			)}Controller.php`;

			return [
				resourceName,
				{
					hash: `fixture-${resourceName}`,
					artifacts: {
						generated: [
							path.posix.join(
								PHP_GENERATED_PATH,
								'Rest',
								className
							),
						],
						shims: [path.posix.join(CONTROLLERS_PATH, className)],
					},
				},
			];
		})
	);

	return `${JSON.stringify({ version: 1, resources: entries }, null, 2)}\n`;
}

function buildProjectFiles(options: {
	readonly cliVersion: string;
	readonly resources: readonly string[];
	readonly generatedLabel?: string;
	readonly userCode?: string;
}): Record<string, string> {
	const files: Record<string, string> = {
		[PACKAGE_PATH]: buildPackageJson(options.cliVersion),
		[CONFIG_PATH]: buildResourceConfig(options.resources),
		[PLUGIN_PATH]: buildPluginLoader({
			generatedLabel: options.generatedLabel ?? options.cliVersion,
			userCode: options.userCode,
		}),
		[APPLY_STATE_PATH]: buildGenerationState(options.resources),
	};

	for (const resourceName of options.resources) {
		const className = `${resourceName[0]!.toUpperCase()}${resourceName.slice(
			1
		)}Controller.php`;
		files[path.posix.join(CONTROLLERS_PATH, className)] =
			buildController(resourceName);
	}

	return files;
}

const CURRENT_PROJECT_FILES = buildProjectFiles({
	cliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
	resources: [JOB_RESOURCE],
});

const RELEASED_PROJECT_FILES = buildProjectFiles({
	cliVersion: RELEASED_CLI_FIXTURE_VERSION,
	resources: [JOB_RESOURCE],
});

const CONFLICT_BASE_PLUGIN = buildPluginLoader({
	generatedLabel: 'conflict-base',
});
const CONFLICT_INCOMING_PLUGIN = buildPluginLoader({
	generatedLabel: 'conflict-incoming',
});
const CONFLICT_CURRENT_PLUGIN = buildPluginLoader({
	generatedLabel: 'conflict-current',
});

const INTERRUPTED_INCOMING_PLUGIN = buildPluginLoader({
	generatedLabel: 'interrupted-incoming',
});

function fixture(
	options: Omit<
		VersionedCliProjectFixture,
		'schemaVersion' | 'targetCliVersion'
	>
): VersionedCliProjectFixture {
	return {
		schemaVersion: VERSIONED_CLI_FIXTURE_SCHEMA_VERSION,
		targetCliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
		...options,
	};
}

export const VERSIONED_CLI_PROJECT_FIXTURES = {
	new: fixture({
		id: 'new',
		projectState: 'new',
		sourceCliVersion: null,
		resources: { before: [], desired: [] },
		baselineFiles: {},
		workspaceFiles: {},
		deletedPaths: [],
		expected: {
			repository: 'absent',
			presentPaths: [],
			absentPaths: [PACKAGE_PATH, CONFIG_PATH, PLUGIN_PATH],
			preservedUserPaths: [],
		},
	}),
	released: fixture({
		id: 'released',
		projectState: 'ready',
		sourceCliVersion: RELEASED_CLI_FIXTURE_VERSION,
		resources: { before: [JOB_RESOURCE], desired: [JOB_RESOURCE] },
		baselineFiles: RELEASED_PROJECT_FILES,
		workspaceFiles: {},
		deletedPaths: [],
		expected: {
			repository: 'clean',
			presentPaths: [
				PACKAGE_PATH,
				CONFIG_PATH,
				PLUGIN_PATH,
				JOB_CONTROLLER_PATH,
				APPLY_STATE_PATH,
			],
			absentPaths: [],
			preservedUserPaths: [],
		},
	}),
	'current-beta': fixture({
		id: 'current-beta',
		projectState: 'ready',
		sourceCliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
		resources: { before: [JOB_RESOURCE], desired: [JOB_RESOURCE] },
		baselineFiles: CURRENT_PROJECT_FILES,
		workspaceFiles: {},
		deletedPaths: [],
		expected: {
			repository: 'clean',
			presentPaths: [
				PACKAGE_PATH,
				CONFIG_PATH,
				PLUGIN_PATH,
				JOB_CONTROLLER_PATH,
				APPLY_STATE_PATH,
			],
			absentPaths: [],
			preservedUserPaths: [],
		},
	}),
	'user-edited': fixture({
		id: 'user-edited',
		projectState: 'user-edited',
		sourceCliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
		resources: { before: [JOB_RESOURCE], desired: [JOB_RESOURCE] },
		baselineFiles: buildProjectFiles({
			cliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
			resources: [JOB_RESOURCE],
			userCode: `function acme_fixture_user_hook(): void
{
    add_action('init', static function (): void {
        // Intentionally user-owned and outside WPK guards.
    });
}`,
		}),
		workspaceFiles: {},
		deletedPaths: [],
		expected: {
			repository: 'clean',
			presentPaths: [
				PACKAGE_PATH,
				CONFIG_PATH,
				PLUGIN_PATH,
				JOB_CONTROLLER_PATH,
			],
			absentPaths: [],
			preservedUserPaths: [PLUGIN_PATH],
		},
	}),
	dirty: fixture({
		id: 'dirty',
		projectState: 'dirty',
		sourceCliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
		resources: { before: [JOB_RESOURCE], desired: [JOB_RESOURCE] },
		baselineFiles: CURRENT_PROJECT_FILES,
		workspaceFiles: {
			[CONFIG_PATH]: `${buildResourceConfig([
				JOB_RESOURCE,
			])}\n// Uncommitted fixture edit.\n`,
		},
		deletedPaths: [],
		expected: {
			repository: 'dirty',
			presentPaths: [
				PACKAGE_PATH,
				CONFIG_PATH,
				PLUGIN_PATH,
				JOB_CONTROLLER_PATH,
			],
			absentPaths: [],
			preservedUserPaths: [],
		},
	}),
	conflicted: fixture({
		id: 'conflicted',
		projectState: 'conflicted',
		sourceCliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
		resources: { before: [JOB_RESOURCE], desired: [JOB_RESOURCE] },
		baselineFiles: {
			...CURRENT_PROJECT_FILES,
			[PLUGIN_PATH]: CONFLICT_BASE_PLUGIN,
		},
		workspaceFiles: {
			[PLUGIN_PATH]: CONFLICT_CURRENT_PLUGIN,
			[APPLY_BASE_PLUGIN_PATH]: CONFLICT_BASE_PLUGIN,
			[APPLY_INCOMING_PLUGIN_PATH]: CONFLICT_INCOMING_PLUGIN,
			[APPLY_PLAN_PATH]: `${JSON.stringify(
				{
					instructions: [
						{
							action: 'write',
							file: PLUGIN_PATH,
							base: APPLY_BASE_PLUGIN_PATH,
							incoming: APPLY_INCOMING_PLUGIN_PATH,
							description: 'Upgrade generated plugin loader',
						},
					],
					skippedDeletions: [],
				},
				null,
				2
			)}\n`,
		},
		deletedPaths: [],
		expected: {
			repository: 'dirty',
			presentPaths: [
				PLUGIN_PATH,
				APPLY_PLAN_PATH,
				APPLY_BASE_PLUGIN_PATH,
				APPLY_INCOMING_PLUGIN_PATH,
			],
			absentPaths: [],
			preservedUserPaths: [],
		},
	}),
	interrupted: fixture({
		id: 'interrupted',
		projectState: 'interrupted',
		sourceCliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
		resources: { before: [JOB_RESOURCE], desired: [JOB_RESOURCE] },
		baselineFiles: CURRENT_PROJECT_FILES,
		workspaceFiles: {
			[APPLY_BASE_PLUGIN_PATH]: CURRENT_PROJECT_FILES[PLUGIN_PATH]!,
			[APPLY_INCOMING_PLUGIN_PATH]: INTERRUPTED_INCOMING_PLUGIN,
		},
		deletedPaths: [APPLY_PLAN_PATH],
		expected: {
			repository: 'dirty',
			presentPaths: [
				PLUGIN_PATH,
				APPLY_BASE_PLUGIN_PATH,
				APPLY_INCOMING_PLUGIN_PATH,
			],
			absentPaths: [APPLY_PLAN_PATH],
			preservedUserPaths: [],
		},
	}),
	'renamed-resource': fixture({
		id: 'renamed-resource',
		projectState: 'renamed-resource',
		sourceCliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
		resources: {
			before: [JOB_RESOURCE],
			desired: [POSITION_RESOURCE],
		},
		baselineFiles: CURRENT_PROJECT_FILES,
		workspaceFiles: {
			[CONFIG_PATH]: buildResourceConfig([POSITION_RESOURCE]),
		},
		deletedPaths: [],
		expected: {
			repository: 'dirty',
			presentPaths: [CONFIG_PATH, JOB_CONTROLLER_PATH, APPLY_STATE_PATH],
			absentPaths: [POSITION_CONTROLLER_PATH],
			preservedUserPaths: [],
		},
	}),
	'removed-resource': fixture({
		id: 'removed-resource',
		projectState: 'removed-resource',
		sourceCliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
		resources: {
			before: [JOB_RESOURCE, SETTINGS_RESOURCE],
			desired: [JOB_RESOURCE],
		},
		baselineFiles: buildProjectFiles({
			cliVersion: CURRENT_BETA_CLI_FIXTURE_VERSION,
			resources: [JOB_RESOURCE, SETTINGS_RESOURCE],
		}),
		workspaceFiles: {
			[CONFIG_PATH]: buildResourceConfig([JOB_RESOURCE]),
		},
		deletedPaths: [],
		expected: {
			repository: 'dirty',
			presentPaths: [
				CONFIG_PATH,
				JOB_CONTROLLER_PATH,
				SETTINGS_CONTROLLER_PATH,
				APPLY_STATE_PATH,
			],
			absentPaths: [],
			preservedUserPaths: [],
		},
	}),
} as const satisfies Record<VersionedCliFixtureId, VersionedCliProjectFixture>;

export function getVersionedCliProjectFixture(
	id: VersionedCliFixtureId
): VersionedCliProjectFixture {
	return VERSIONED_CLI_PROJECT_FIXTURES[id];
}

export async function materializeVersionedCliProjectFixture(
	workspaceRoot: string,
	fixtureOrId: VersionedCliProjectFixture | VersionedCliFixtureId
): Promise<VersionedCliProjectFixture> {
	const selectedFixture =
		typeof fixtureOrId === 'string'
			? getVersionedCliProjectFixture(fixtureOrId)
			: fixtureOrId;

	await writeFixtureFiles(workspaceRoot, selectedFixture.baselineFiles);

	if (selectedFixture.expected.repository !== 'absent') {
		await initializeFixtureRepository(workspaceRoot);
	}

	for (const deletedPath of selectedFixture.deletedPaths) {
		await fs.rm(path.join(workspaceRoot, deletedPath), {
			recursive: true,
			force: true,
		});
	}

	await writeFixtureFiles(workspaceRoot, selectedFixture.workspaceFiles);

	return selectedFixture;
}

async function writeFixtureFiles(
	workspaceRoot: string,
	files: Readonly<Record<string, string>>
): Promise<void> {
	await Promise.all(
		Object.entries(files).map(async ([relativePath, contents]) => {
			const absolutePath = path.join(workspaceRoot, relativePath);
			await fs.mkdir(path.dirname(absolutePath), { recursive: true });
			await fs.writeFile(absolutePath, contents, 'utf8');
		})
	);
}

async function initializeFixtureRepository(
	workspaceRoot: string
): Promise<void> {
	await execGit(workspaceRoot, ['init', '--quiet']);
	await execGit(workspaceRoot, [
		'config',
		'user.email',
		'cli-fixtures@wpkernel.dev',
	]);
	await execGit(workspaceRoot, [
		'config',
		'user.name',
		'WPKernel CLI Fixtures',
	]);
	await execGit(workspaceRoot, ['add', '--all']);
	await execGit(workspaceRoot, [
		'commit',
		'--quiet',
		'--message',
		'Seed versioned CLI fixture',
	]);
}

async function execGit(workspaceRoot: string, args: readonly string[]) {
	return execFileAsync('git', [...args], { cwd: workspaceRoot });
}
