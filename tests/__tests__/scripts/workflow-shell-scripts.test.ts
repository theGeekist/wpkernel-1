import { execFile } from 'node:child_process';
import { access, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const workflowScripts = [
	'scripts/workflow/prepare-upstream-pr.sh',
	'scripts/workflow/sync-fork-main.sh',
] as const;
const workflowLibraries = [
	'scripts/workflow/lib/sync-git-object-id.sh',
	'scripts/workflow/lib/sync-fetch-snapshots.sh',
	'scripts/workflow/lib/sync-recovery-state.sh',
] as const;
const fixtureRoots: string[] = [];
const syncScript = path.resolve('scripts/workflow/sync-fork-main.sh');

jest.setTimeout(30_000);

async function initialiseRepository(root: string): Promise<void> {
	await execFileAsync('git', ['init', '--quiet', '--initial-branch=main'], {
		cwd: root,
	});
	await execFileAsync('git', ['config', 'user.name', 'Workflow Test'], {
		cwd: root,
	});
	await execFileAsync(
		'git',
		['config', 'user.email', 'workflow@example.test'],
		{
			cwd: root,
		}
	);
}

async function commitFile(root: string, name: string, contents: string) {
	await writeFile(path.join(root, name), contents, 'utf8');
	await execFileAsync('git', ['add', name], { cwd: root });
	await execFileAsync('git', ['commit', '--quiet', '-m', name], {
		cwd: root,
	});
}

async function addCanonicalRemotes(root: string): Promise<void> {
	await execFileAsync(
		'git',
		[
			'remote',
			'add',
			'origin',
			'https://github.com/theGeekist/wpkernel-1.git',
		],
		{ cwd: root }
	);
	await execFileAsync(
		'git',
		[
			'remote',
			'add',
			'upstream',
			'https://github.com/wpkernel/wpkernel.git',
		],
		{ cwd: root }
	);
}

describe('repository workflow shell scripts', () => {
	afterEach(async () => {
		await Promise.all(
			fixtureRoots.splice(0).map((root) => rm(root, { recursive: true }))
		);
	});

	it.each([...workflowScripts, ...workflowLibraries])(
		'%s has valid Bash syntax',
		async (script) => {
			await expect(
				execFileAsync('bash', ['-n', path.resolve(script)])
			).resolves.toMatchObject({ stderr: '' });
		}
	);

	it.each(workflowScripts)('%s is executable', async (script) => {
		await expect(
			access(path.resolve(script), constants.X_OK)
		).resolves.toBeUndefined();
	});

	it('resolves its library through CDPATH and a foreign symlink', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-sync-script-'));
		fixtureRoots.push(root);
		const entryPoint = path.join(root, 'sync-fork-main.sh');
		await symlink(syncScript, entryPoint);

		await expect(
			execFileAsync('bash', [entryPoint], {
				cwd: root,
				env: {
					...process.env,
					CDPATH: '.',
					FORK_BRANCH: 'invalid branch',
				},
			})
		).rejects.toMatchObject({
			stderr: expect.stringContaining(
				"invalid branch name 'invalid branch'"
			),
		});
	});

	it('refuses to synchronise over untracked work', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-sync-script-'));
		fixtureRoots.push(root);
		await initialiseRepository(root);
		await writeFile(
			path.join(root, 'untracked.txt'),
			'preserve me\n',
			'utf8'
		);

		await expect(
			execFileAsync(syncScript, [], { cwd: root })
		).rejects.toMatchObject({
			stderr: expect.stringContaining('working tree has changes'),
		});
	});

	it('refuses a working remote that pushes to the release repository', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-sync-script-'));
		fixtureRoots.push(root);
		await initialiseRepository(root);
		await commitFile(root, 'base.txt', 'base\n');
		await addCanonicalRemotes(root);
		await execFileAsync(
			'git',
			[
				'remote',
				'set-url',
				'--push',
				'origin',
				'https://github.com/wpkernel/wpkernel.git',
			],
			{ cwd: root }
		);

		await expect(
			execFileAsync(syncScript, [], { cwd: root })
		).rejects.toMatchObject({
			stderr: expect.stringContaining(
				'working remote must fetch from and push to theGeekist/wpkernel-1'
			),
		});
	});

	it('refuses multiple working push URLs', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-sync-script-'));
		fixtureRoots.push(root);
		await initialiseRepository(root);
		await commitFile(root, 'base.txt', 'base\n');
		await addCanonicalRemotes(root);
		await execFileAsync(
			'git',
			[
				'remote',
				'set-url',
				'--push',
				'origin',
				'https://github.com/theGeekist/wpkernel-1.git',
			],
			{ cwd: root }
		);
		await execFileAsync(
			'git',
			[
				'remote',
				'set-url',
				'--add',
				'--push',
				'origin',
				'https://github.com/wpkernel/wpkernel.git',
			],
			{ cwd: root }
		);

		await expect(
			execFileAsync(syncScript, [], { cwd: root })
		).rejects.toMatchObject({
			stderr: expect.stringContaining(
				'working remote must have exactly one fetch URL and one push URL'
			),
		});
	});

	it('refuses invalid branch names before fetching', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-sync-script-'));
		fixtureRoots.push(root);
		await initialiseRepository(root);
		await commitFile(root, 'base.txt', 'base\n');
		await addCanonicalRemotes(root);

		await expect(
			execFileAsync(syncScript, [], {
				cwd: root,
				env: { ...process.env, FORK_BRANCH: 'invalid branch' },
			})
		).rejects.toMatchObject({
			stderr: expect.stringContaining(
				"invalid branch name 'invalid branch'"
			),
		});
	});
});
