#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { readPipelineReleaseMetadata } from './pipeline-release-metadata.mjs';

const PIPELINE_PACKAGE_PATH = 'packages/pipeline/package.json';

function run(command: string, args: readonly string[], cwd: string): void {
	const result = spawnSync(command, [...args], { cwd, stdio: 'inherit' });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function main(): void {
	const args = process.argv.slice(2);
	const targetVersion = args[0];

	if (!targetVersion || args.length !== 1) {
		console.error(
			'Usage: tsx scripts/release/release-pipeline.ts <published-semver-version>'
		);
		process.exit(1);
	}

	const repoRoot = path.resolve(
		fileURLToPath(import.meta.url),
		'..',
		'..',
		'..'
	);
	const manifestPath = path.join(repoRoot, PIPELINE_PACKAGE_PATH);
	const release = readPipelineReleaseMetadata(manifestPath);
	if (release.version !== targetVersion) {
		console.error(
			`Manifest version is ${release.version}, not ${targetVersion}. Update and review release metadata before qualification.`
		);
		process.exit(1);
	}

	console.log(
		`Preparing local qualification for @wpkernel/pipeline@${targetVersion} (${release.distTag}).`
	);
	run('pnpm', ['install', '--frozen-lockfile'], repoRoot);
	run(
		'node',
		['--test', 'scripts/release/pipeline-release-metadata.test.mjs'],
		repoRoot
	);
	run('pnpm', ['--filter', '@wpkernel/pipeline', 'clean'], repoRoot);
	run('pnpm', ['--filter', '@wpkernel/pipeline', 'lint'], repoRoot);
	run('pnpm', ['--filter', '@wpkernel/pipeline', 'typecheck'], repoRoot);
	run('pnpm', ['--filter', '@wpkernel/core...', 'build'], repoRoot);
	run(
		'pnpm',
		['--filter', '@wpkernel/pipeline', 'typecheck:tests'],
		repoRoot
	);
	run('pnpm', ['--filter', '@wpkernel/pipeline', 'test:coverage'], repoRoot);
	run('pnpm', ['--filter', '@wpkernel/pipeline', 'qualify:packed'], repoRoot);

	console.log(
		`\nLocal qualification passed for pipeline-v${targetVersion}. Push the reviewed contribution to origin and merge it through the upstream pull request. The current approved upstream release authority, pipewrk, creates that tag at the merged commit; the trusted workflow rejects every other tag-push actor and publishes ${release.distTag}.`
	);
}

main();
