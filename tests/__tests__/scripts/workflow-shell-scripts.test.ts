import { execFile, spawn } from 'node:child_process';
import {
	access,
	chmod,
	mkdtemp,
	mkdir,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const workflowScripts = [
	'scripts/workflow/prepare-upstream-pr.sh',
	'scripts/workflow/sync-fork-main.sh',
	'scripts/workflow/update-upstream-pr.sh',
] as const;
const workflowLibraries = [
	'scripts/workflow/lib/authoring-remote-authority.sh',
	'scripts/workflow/lib/sync-git-object-id.sh',
	'scripts/workflow/lib/sync-fetch-snapshots.sh',
	'scripts/workflow/lib/sync-recovery-state.sh',
] as const;
const fixtureRoots: string[] = [];
const syncScript = path.resolve('scripts/workflow/sync-fork-main.sh');
const updatePrScript = path.resolve('scripts/workflow/update-upstream-pr.sh');
const preparePrScript = path.resolve('scripts/workflow/prepare-upstream-pr.sh');
const prePushHook = path.resolve('.husky/pre-push');
const authoringRepository = 'https://github.com/theGeekist/wpkernel-1.git';
const upstreamRepository = 'https://github.com/wpkernel/wpkernel.git';

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

async function localBranchState(root: string): Promise<{
	readonly branch: string;
	readonly refs: string;
}> {
	const branch = await execFileAsync('git', ['branch', '--show-current'], {
		cwd: root,
	});
	const refs = await execFileAsync(
		'git',
		['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'],
		{ cwd: root }
	);
	return { branch: branch.stdout.trim(), refs: refs.stdout };
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

function runPrePushHook(
	root: string,
	updates: string
): Promise<{
	readonly code: number | null;
	readonly stderr: string;
}> {
	return new Promise((resolve, reject) => {
		const child = spawn(
			prePushHook,
			['origin', 'https://github.com/theGeekist/wpkernel-1.git'],
			{ cwd: root }
		);
		let stderr = '';
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on('error', reject);
		child.on('close', (code) => resolve({ code, stderr }));
		child.stdin.end(updates);
	});
}

function runScriptWithInput(
	root: string,
	script: string,
	input: string,
	env: NodeJS.ProcessEnv
): Promise<{
	readonly code: number | null;
	readonly stderr: string;
}> {
	return new Promise((resolve, reject) => {
		const child = spawn(script, [], { cwd: root, env });
		let stderr = '';
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on('error', reject);
		child.on('close', (code) => resolve({ code, stderr }));
		child.stdin.end(input);
	});
}

async function authoringRemoteEnvironment(
	fixtureRoot: string,
	raceScript?: string
): Promise<NodeJS.ProcessEnv> {
	const bin = path.join(fixtureRoot, 'bin');
	const wrapper = path.join(bin, 'git');
	const git = (await execFileAsync('which', ['git'])).stdout.trim();
	await mkdir(bin, { recursive: true });
	await writeFile(
		wrapper,
		`#!/bin/sh
if [ "$1" = push ] && [ -n "\${WPK_TEST_RACE_SCRIPT:-}" ]; then
	"$WPK_TEST_RACE_SCRIPT"
fi
if [ "$1" = remote ] && [ "$2" = get-url ]; then
	printf '%s\\n' '${authoringRepository}'
	exit 0
fi
exec '${git}' "$@"
`,
		'utf8'
	);
	await chmod(wrapper, 0o755);
	return {
		...process.env,
		PATH: `${bin}:${process.env.PATH ?? ''}`,
		...(raceScript ? { WPK_TEST_RACE_SCRIPT: raceScript } : {}),
	};
}

async function promotionRemoteEnvironment(
	fixtureRoot: string
): Promise<NodeJS.ProcessEnv> {
	const bin = path.join(fixtureRoot, 'bin');
	const wrapper = path.join(bin, 'git');
	const git = (await execFileAsync('which', ['git'])).stdout.trim();
	await mkdir(bin);
	await writeFile(
		wrapper,
		`#!/bin/sh
if [ "$1" = remote ] && [ "$2" = get-url ]; then
	for remote; do :; done
	case "$remote" in
		origin) printf '%s\\n' '${authoringRepository}' ;;
		upstream) printf '%s\\n' '${upstreamRepository}' ;;
	esac
	exit 0
fi
exec '${git}' "$@"
`,
		'utf8'
	);
	await chmod(wrapper, 0o755);
	return { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` };
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

	it('keeps PR branch pushes on published authoring main', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-pre-push-'));
		const remoteRoot = await mkdtemp(
			path.join(os.tmpdir(), 'wpk-pre-push-remotes-')
		);
		fixtureRoots.push(root, remoteRoot);
		const fetchRemote = path.join(remoteRoot, 'fetch.git');
		const pushRemote = path.join(remoteRoot, 'push.git');
		await execFileAsync('git', ['init', '--bare', '--quiet', fetchRemote]);
		await execFileAsync('git', ['init', '--bare', '--quiet', pushRemote]);
		await initialiseRepository(root);
		await execFileAsync(
			'git',
			[
				'config',
				`url.file://${pushRemote}.insteadOf`,
				authoringRepository,
			],
			{ cwd: root }
		);
		await commitFile(root, 'base.txt', 'base\n');
		await execFileAsync('git', ['remote', 'add', 'origin', fetchRemote], {
			cwd: root,
		});
		await execFileAsync(
			'git',
			['remote', 'set-url', '--push', 'origin', authoringRepository],
			{ cwd: root }
		);
		await execFileAsync(
			'git',
			['push', '--quiet', '-u', 'origin', 'main'],
			{
				cwd: root,
			}
		);
		await commitFile(root, 'first.txt', 'first\n');
		const intermediateSha = (
			await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })
		).stdout.trim();
		await commitFile(root, 'second.txt', 'second\n');
		await execFileAsync('git', ['push', '--quiet', 'origin', 'main'], {
			cwd: root,
		});
		const publishedSha = (
			await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })
		).stdout.trim();
		const permitted = await runPrePushHook(
			root,
			`refs/heads/pr/example ${publishedSha} refs/heads/pr/example ${'0'.repeat(40)}\n`
		);
		expect(permitted).toEqual({ code: 0, stderr: '' });

		const intermediate = await runPrePushHook(
			root,
			`refs/heads/pr/example ${intermediateSha} refs/heads/pr/example ${publishedSha}\n`
		);
		expect(intermediate.code).toBe(1);
		expect(intermediate.stderr).toContain(
			'does not equal the published authoring-main revision'
		);

		await commitFile(root, 'pr-only.txt', 'not on main\n');
		const unpublishedSha = (
			await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })
		).stdout.trim();
		const blocked = await runPrePushHook(
			root,
			`refs/heads/pr/example ${unpublishedSha} refs/heads/pr/example ${publishedSha}\n`
		);
		expect(blocked.code).toBe(1);
		expect(blocked.stderr).toContain(
			'does not equal the published authoring-main revision'
		);
	});

	it('fast-forwards an existing PR branch from published authoring main', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-update-pr-'));
		const remoteRoot = await mkdtemp(
			path.join(os.tmpdir(), 'wpk-update-pr-origin-')
		);
		fixtureRoots.push(root, remoteRoot);
		const remote = path.join(remoteRoot, 'origin.git');
		await execFileAsync('git', ['init', '--bare', '--quiet', remote]);
		await initialiseRepository(root);
		await execFileAsync(
			'git',
			['config', `url.file://${remote}.insteadOf`, authoringRepository],
			{ cwd: root }
		);
		await execFileAsync(
			'git',
			['remote', 'add', 'origin', authoringRepository],
			{
				cwd: root,
			}
		);
		await commitFile(root, 'base.txt', 'base\n');
		await execFileAsync(
			'git',
			['push', '--quiet', '-u', 'origin', 'main'],
			{
				cwd: root,
			}
		);
		await execFileAsync('git', ['branch', 'pr/example'], { cwd: root });
		await execFileAsync(
			'git',
			['push', '--quiet', 'origin', 'pr/example'],
			{
				cwd: root,
			}
		);
		await commitFile(root, 'correction.txt', 'correction\n');
		await execFileAsync('git', ['push', '--quiet', 'origin', 'main'], {
			cwd: root,
		});
		const mainSha = (
			await execFileAsync('git', ['rev-parse', 'main'], { cwd: root })
		).stdout.trim();
		const before = await localBranchState(root);
		const environment = await authoringRemoteEnvironment(remoteRoot);

		await expect(
			execFileAsync(updatePrScript, [], {
				cwd: root,
				env: { ...environment, PR_BRANCH: 'pr/example' },
			})
		).resolves.toMatchObject({
			stdout: expect.stringContaining(
				'Updated pr/example to the exact origin/main revision.'
			),
		});
		await expect(
			execFileAsync(
				'git',
				['ls-remote', 'origin', 'refs/heads/pr/example'],
				{
					cwd: root,
				}
			)
		).resolves.toMatchObject({
			stdout: expect.stringContaining(mainSha),
		});
		await expect(localBranchState(root)).resolves.toEqual(before);
	});

	it('leaves local branches unchanged when a leased PR update races', async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'wpk-update-pr-race-')
		);
		const remoteRoot = await mkdtemp(
			path.join(os.tmpdir(), 'wpk-update-pr-race-origin-')
		);
		const racer = path.join(remoteRoot, 'racer');
		fixtureRoots.push(root, remoteRoot);
		const remote = path.join(remoteRoot, 'origin.git');
		await execFileAsync('git', ['init', '--bare', '--quiet', remote]);
		await initialiseRepository(root);
		await execFileAsync(
			'git',
			['config', `url.file://${remote}.insteadOf`, authoringRepository],
			{ cwd: root }
		);
		await execFileAsync(
			'git',
			['remote', 'add', 'origin', authoringRepository],
			{ cwd: root }
		);
		await commitFile(root, 'base.txt', 'base\n');
		await execFileAsync(
			'git',
			['push', '--quiet', '-u', 'origin', 'main'],
			{ cwd: root }
		);
		await execFileAsync('git', ['branch', 'pr/example'], { cwd: root });
		await execFileAsync(
			'git',
			['push', '--quiet', 'origin', 'pr/example'],
			{ cwd: root }
		);
		await commitFile(root, 'correction.txt', 'correction\n');
		await execFileAsync('git', ['push', '--quiet', 'origin', 'main'], {
			cwd: root,
		});
		await execFileAsync('git', [
			'clone',
			'--quiet',
			'--branch',
			'main',
			remote,
			racer,
		]);
		await execFileAsync('git', ['config', 'user.name', 'Workflow Racer'], {
			cwd: racer,
		});
		await execFileAsync(
			'git',
			['config', 'user.email', 'racer@example.test'],
			{
				cwd: racer,
			}
		);
		await commitFile(racer, 'racer.txt', 'racer\n');
		const git = (await execFileAsync('which', ['git'])).stdout.trim();
		const raceScript = path.join(remoteRoot, 'advance-remote.sh');
		await writeFile(
			raceScript,
			`#!/bin/sh
'${git}' -C '${racer}' push --quiet origin main
'${git}' -C '${racer}' push --quiet origin main:refs/heads/pr/example
`,
			'utf8'
		);
		await chmod(raceScript, 0o755);
		const before = await localBranchState(root);
		const environment = await authoringRemoteEnvironment(
			remoteRoot,
			raceScript
		);

		await expect(
			execFileAsync(updatePrScript, [], {
				cwd: root,
				env: { ...environment, PR_BRANCH: 'pr/example' },
			})
		).rejects.toMatchObject({
			stderr: expect.stringContaining('stale info'),
		});
		await expect(localBranchState(root)).resolves.toEqual(before);

		const retryEnvironment = await authoringRemoteEnvironment(remoteRoot);
		await expect(
			execFileAsync(updatePrScript, [], {
				cwd: root,
				env: { ...retryEnvironment, PR_BRANCH: 'pr/example' },
			})
		).resolves.toMatchObject({
			stdout: expect.stringContaining(
				'Updated pr/example to the exact origin/main revision.'
			),
		});
		await expect(localBranchState(root)).resolves.toEqual(before);
	});

	it('refuses a non-pr branch name before preparing an upstream PR', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-prepare-pr-'));
		const remoteRoot = await mkdtemp(
			path.join(os.tmpdir(), 'wpk-prepare-pr-remotes-')
		);
		fixtureRoots.push(root, remoteRoot);
		const authoringRemote = path.join(remoteRoot, 'authoring.git');
		const upstreamRemote = path.join(remoteRoot, 'upstream.git');
		await execFileAsync('git', [
			'init',
			'--bare',
			'--quiet',
			authoringRemote,
		]);
		await execFileAsync('git', [
			'init',
			'--bare',
			'--quiet',
			upstreamRemote,
		]);
		await initialiseRepository(root);
		await execFileAsync(
			'git',
			[
				'config',
				`url.file://${authoringRemote}.insteadOf`,
				authoringRepository,
			],
			{ cwd: root }
		);
		await execFileAsync(
			'git',
			[
				'config',
				`url.file://${upstreamRemote}.insteadOf`,
				upstreamRepository,
			],
			{ cwd: root }
		);
		await execFileAsync(
			'git',
			['remote', 'add', 'origin', authoringRepository],
			{
				cwd: root,
			}
		);
		await execFileAsync(
			'git',
			['remote', 'add', 'upstream', upstreamRepository],
			{
				cwd: root,
			}
		);
		await commitFile(root, 'base.txt', 'base\n');
		await execFileAsync(
			'git',
			['push', '--quiet', '-u', 'origin', 'main'],
			{
				cwd: root,
			}
		);
		await execFileAsync(
			'git',
			['push', '--quiet', '-u', 'upstream', 'main'],
			{
				cwd: root,
			}
		);
		const environment = await promotionRemoteEnvironment(remoteRoot);

		await expect(
			runScriptWithInput(
				root,
				preparePrScript,
				'y\nnot-a-pr\n',
				environment
			)
		).resolves.toMatchObject({
			code: 1,
			stderr: expect.stringContaining(
				"PR branch must be a valid pr/* branch, not 'not-a-pr'"
			),
		});
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
