import { execFile } from 'node:child_process';
import {
	chmod,
	copyFile,
	mkdtemp,
	mkdir,
	readFile,
	rm,
	writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const prereleaseScript = path.resolve('scripts/workflow/prerelease.ts');
const tsx = path.resolve('node_modules/.bin/tsx');
const fixtureRoots: string[] = [];

const legacyInvocations = [
	[],
	['--help'],
	['--push'],
	['--publish'],
	[
		'--mode',
		'patch',
		'--preid',
		'beta',
		'--remote',
		'upstream',
		'--branch',
		'main',
		'--publish-tag',
		'beta',
		'--version',
		'2.0.1-beta.0',
		'--allow-dirty',
	],
] as const;

async function createCommandSentinel(
	root: string,
	command: string
): Promise<void> {
	const bin = path.join(root, 'bin');
	await mkdir(bin, { recursive: true });
	const executable = path.join(bin, command);
	await writeFile(
		executable,
		`#!/bin/sh\nprintf '%s\\n' "$0 $*" >> "$COMMAND_SENTINEL"\nexit 0\n`,
		'utf8'
	);
	await chmod(executable, 0o755);
}

describe('retired prerelease authority', () => {
	afterEach(async () => {
		await Promise.all(
			fixtureRoots.splice(0).map((root) => rm(root, { recursive: true }))
		);
	});

	it.each(legacyInvocations.map((args) => [args]))(
		'fails closed without invoking legacy commands for %j',
		async (args) => {
			const root = await mkdtemp(
				path.join(os.tmpdir(), 'wpk-prerelease-')
			);
			fixtureRoots.push(root);
			const fixtureScript = path.join(root, 'prerelease.ts');
			const sentinel = path.join(root, 'command-sentinel.log');
			const marker = path.join(root, 'working-tree-marker');
			await copyFile(prereleaseScript, fixtureScript);
			await writeFile(marker, 'preserve me\n', 'utf8');
			await createCommandSentinel(root, 'git');
			await createCommandSentinel(root, 'pnpm');

			await expect(
				execFileAsync(tsx, [fixtureScript, ...args], {
					cwd: root,
					env: {
						...process.env,
						COMMAND_SENTINEL: sentinel,
						PATH: `${path.join(root, 'bin')}:${process.env.PATH ?? ''}`,
					},
				})
			).rejects.toMatchObject({
				code: 1,
				stderr: expect.stringContaining('permanently quarantined'),
			});

			expect(await readFile(sentinel, 'utf8').catch(() => '')).toBe('');
			expect(await readFile(marker, 'utf8')).toBe('preserve me\n');
			expect(
				await readFile(
					path.join(root, '.release-next-version'),
					'utf8'
				).catch(() => '')
			).toBe('');
		}
	);
});
