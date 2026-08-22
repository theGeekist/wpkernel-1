import { execFile, spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
	cleanupFixtures,
	commitFile,
	createFixture,
	createMockGit,
	git,
	prepareConflictFixture,
	runSync,
} from '../../fixtures/workflow-sync.fixture';

const execFileAsync = promisify(execFile);
const integrationTimeout = 60_000;
const syncScript = path.resolve('scripts/workflow/sync-fork-main.sh');

function waitForPushDecision(child: ReturnType<typeof spawn>): Promise<void> {
	return new Promise((resolve, reject) => {
		let output = '';
		const observe = (chunk: Buffer) => {
			output += chunk.toString();
			if (output.includes('Local main is now based on upstream/main.')) {
				resolve();
			}
		};
		child.stdout?.on('data', observe);
		child.stderr?.on('data', observe);
		child.once('error', reject);
		child.once('close', (code, signal) => {
			reject(
				new Error(
					`Synchronisation exited before the push decision: code=${code}, signal=${signal}.`
				)
			);
		});
	});
}

describe('repository main synchronisation transitions', () => {
	afterEach(cleanupFixtures);

	it(
		'adopts the exact release SHA and constructs the exact lease push',
		async () => {
			const fixture = await createFixture();
			const releaseSha = await commitFile(
				fixture.work,
				'release.txt',
				'release\n'
			);
			await git(
				fixture.work,
				'push',
				fixture.upstream,
				'HEAD:refs/heads/main'
			);
			await git(fixture.work, 'reset', '--hard', fixture.baseSha);
			const env = await createMockGit(fixture);

			await runSync(fixture, env, 'y\n');

			expect(await git(fixture.work, 'rev-parse', 'main')).toBe(
				releaseSha
			);
			const push = await readFile(env.MOCK_PUSH_LOG as string, 'utf8');
			expect(push).toContain(
				`${releaseSha}:refs/heads/main\n--force-with-lease=refs/heads/main:${fixture.baseSha}`
			);
			expect(push).toContain(
				'https://github.com/theGeekist/wpkernel-1.git'
			);
		},
		integrationTimeout
	);

	it(
		'cleans private fetch snapshots when interrupted before the push decision',
		async () => {
			const fixture = await createFixture();
			await commitFile(fixture.work, 'release.txt', 'release\n');
			await git(
				fixture.work,
				'push',
				fixture.upstream,
				'HEAD:refs/heads/main'
			);
			await git(fixture.work, 'reset', '--hard', fixture.baseSha);
			const child = spawn(syncScript, [], {
				cwd: fixture.work,
				env: await createMockGit(fixture),
				stdio: ['pipe', 'pipe', 'pipe'],
			});
			await waitForPushDecision(child);
			const closed = new Promise<
				readonly [number | null, NodeJS.Signals | null]
			>((resolve) => {
				child.once('close', (code, signal) => resolve([code, signal]));
			});

			child.kill('SIGINT');
			await expect(closed).resolves.toEqual([130, null]);
			expect(
				await git(
					fixture.work,
					'for-each-ref',
					'--format=%(refname)',
					'refs/wpkernel-sync'
				)
			).toBe('');
		},
		integrationTimeout
	);

	it(
		'refuses to discard unpublished local commits',
		async () => {
			const fixture = await createFixture();
			await commitFile(fixture.work, 'local-only.txt', 'preserve me\n');
			const env = await createMockGit(fixture);

			await expect(runSync(fixture, env, '')).rejects.toMatchObject({
				stderr: expect.stringContaining(
					'local main contains commits not published to origin/main'
				),
			});
		},
		integrationTimeout
	);

	it(
		'rejects mutation of reserved snapshots after validated fetch',
		async () => {
			const fixture = await createFixture();
			await commitFile(fixture.work, 'authoring.txt', 'authoring\n');
			await git(
				fixture.work,
				'push',
				fixture.origin,
				'HEAD:refs/heads/main'
			);
			const tree = await git(fixture.work, 'rev-parse', 'HEAD^{tree}');
			const concurrentSha = await git(
				fixture.work,
				'commit-tree',
				tree,
				'-p',
				fixture.baseSha,
				'-m',
				'concurrent private snapshot'
			);
			const env = {
				...(await createMockGit(fixture)),
				MOCK_MOVE_PRIVATE_AFTER_FETCH: '1',
				MOCK_CONCURRENT_SHA: concurrentSha,
			};

			await expect(runSync(fixture, env, 'n\n')).rejects.toMatchObject({
				stderr: expect.stringContaining(
					'private fetch snapshot authority changed concurrently'
				),
			});
			const preserved = await git(
				fixture.work,
				'for-each-ref',
				'--format=%(objectname)',
				'refs/wpkernel-sync'
			);
			expect(preserved.split('\n')).toEqual([
				concurrentSha,
				concurrentSha,
			]);
		},
		integrationTimeout
	);

	it(
		'uses private fetch snapshots when shared tracking refs move',
		async () => {
			const fixture = await createFixture();
			const releaseSha = await commitFile(
				fixture.work,
				'release.txt',
				'release\n'
			);
			await git(
				fixture.work,
				'push',
				fixture.upstream,
				'HEAD:refs/heads/main'
			);
			await git(fixture.work, 'reset', '--hard', fixture.baseSha);
			const env = {
				...(await createMockGit(fixture)),
				MOCK_MOVE_TRACKING_AFTER_FETCH: '1',
				MOCK_CONCURRENT_SHA: fixture.baseSha,
			};

			await runSync(fixture, env, 'n\n');

			expect(await git(fixture.work, 'rev-parse', 'main')).toBe(
				releaseSha
			);
			expect(
				await git(
					fixture.work,
					'for-each-ref',
					'--format=%(refname)',
					'refs/wpkernel-sync'
				)
			).toBe('');
		},
		integrationTimeout
	);

	it(
		'adopts a successful named rebase candidate',
		async () => {
			const fixture = await createFixture();
			const sourceSha = await commitFile(
				fixture.work,
				'authoring.txt',
				'authoring\n'
			);
			await git(
				fixture.work,
				'push',
				fixture.origin,
				'HEAD:refs/heads/main'
			);
			const env = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: ':',
			};

			await runSync(fixture, env, '\nn\n');

			expect(await git(fixture.work, 'rev-parse', 'main')).toBe(
				sourceSha
			);
			await expect(
				git(
					fixture.work,
					'show-ref',
					'--verify',
					'refs/heads/wpkernel-sync-candidate'
				)
			).rejects.toBeDefined();
		},
		integrationTimeout
	);

	it(
		'resumes and adopts a manually resolved rebase conflict',
		async () => {
			const fixture = await createFixture();
			await prepareConflictFixture(fixture);
			const env = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: ':',
			};

			await expect(runSync(fixture, env, '\n')).rejects.toBeDefined();
			await writeFile(
				path.join(fixture.work, 'shared.txt'),
				'resolved\n',
				'utf8'
			);
			await git(fixture.work, 'add', 'shared.txt');
			await execFileAsync('git', ['rebase', '--continue'], {
				cwd: fixture.work,
				env: { ...process.env, GIT_EDITOR: 'true' },
			});
			await runSync(
				fixture,
				{ ...env, SYNC_RECOVERY: 'complete' },
				'n\n'
			);

			expect(await git(fixture.work, 'branch', '--show-current')).toBe(
				'main'
			);
			expect(
				await readFile(path.join(fixture.work, 'shared.txt'), 'utf8')
			).toBe('resolved\n');
			await expect(
				git(
					fixture.work,
					'show-ref',
					'--verify',
					'refs/heads/wpkernel-sync-candidate'
				)
			).rejects.toBeDefined();
		},
		integrationTimeout
	);
});
