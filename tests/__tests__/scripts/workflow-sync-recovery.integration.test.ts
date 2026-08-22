import { execFile } from 'node:child_process';
import { access, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
	cleanupFixtures,
	commitFile,
	createFixture,
	createMockGit,
	git,
	prepareConflictFixture,
	rebaseIsActive,
	runSync,
} from '../../fixtures/workflow-sync.fixture';

const execFileAsync = promisify(execFile);
const integrationTimeout = 120_000;

describe('repository main synchronisation recovery', () => {
	afterEach(cleanupFixtures);

	it(
		'rejects resume after an ordinary rebase abort',
		async () => {
			const fixture = await createFixture();
			await prepareConflictFixture(fixture);
			const env: NodeJS.ProcessEnv = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: ':',
			};
			await expect(runSync(fixture, env, '\n')).rejects.toBeDefined();
			await git(fixture.work, 'rebase', '--abort');

			await expect(
				runSync(fixture, { ...env, SYNC_RECOVERY: 'resume' }, 'n\n')
			).rejects.toMatchObject({
				stderr: expect.stringContaining(
					'candidate has no matching rebase-completion witness'
				),
			});
			await runSync(fixture, { ...env, SYNC_RECOVERY: 'abort' }, '');
			expect(await git(fixture.work, 'branch', '--show-current')).toBe(
				'main'
			);
		},
		integrationTimeout
	);

	it(
		'rejects completion after an ordinary rebase abort',
		async () => {
			const fixture = await createFixture();
			await commitFile(fixture.work, 'authoring.txt', 'authoring\n');
			await git(
				fixture.work,
				'push',
				fixture.origin,
				'HEAD:refs/heads/main'
			);
			const env = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: "sed -i.bak -e 's/^pick /edit /'",
			};
			await expect(runSync(fixture, env, '\n')).rejects.toBeDefined();
			await git(fixture.work, 'rebase', '--abort');

			await expect(
				runSync(fixture, { ...env, SYNC_RECOVERY: 'complete' }, 'n\n')
			).rejects.toMatchObject({
				stderr: expect.stringContaining(
					'recovery candidate is unchanged from the pre-rebase main'
				),
			});
			await runSync(fixture, { ...env, SYNC_RECOVERY: 'abort' }, '');
		},
		integrationTimeout
	);

	it(
		'refuses dirty completion even when ALLOW_DIRTY is set',
		async () => {
			const fixture = await createFixture();
			await commitFile(fixture.work, 'authoring.txt', 'authoring\n');
			await git(
				fixture.work,
				'push',
				fixture.origin,
				'HEAD:refs/heads/main'
			);
			const env = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: "sed -i.bak -e 's/^pick /edit /'",
			};
			await expect(runSync(fixture, env, '\n')).rejects.toBeDefined();
			await execFileAsync('git', ['rebase', '--continue'], {
				cwd: fixture.work,
				env: { ...process.env, GIT_EDITOR: 'true' },
			});
			await writeFile(
				path.join(fixture.work, 'uncommitted.txt'),
				'dirty\n'
			);

			await expect(
				runSync(
					fixture,
					{ ...env, SYNC_RECOVERY: 'complete', ALLOW_DIRTY: '1' },
					'n\n'
				)
			).rejects.toMatchObject({
				stderr: expect.stringContaining('working tree has changes'),
			});
			await rm(path.join(fixture.work, 'uncommitted.txt'));
			await runSync(fixture, { ...env, SYNC_RECOVERY: 'abort' }, '');
		},
		integrationTimeout
	);

	it(
		'treats edit as a pause and rejects resume after abort',
		async () => {
			const fixture = await createFixture();
			await commitFile(fixture.work, 'authoring.txt', 'authoring\n');
			await git(
				fixture.work,
				'push',
				fixture.origin,
				'HEAD:refs/heads/main'
			);
			const env = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: "sed -i.bak -e 's/^pick /edit /'",
			};

			await expect(runSync(fixture, env, '\n')).rejects.toMatchObject({
				stdout: expect.stringContaining(
					'Interactive rebase paused before completion'
				),
			});
			expect(await rebaseIsActive(fixture.work)).toBe(true);
			await git(fixture.work, 'rebase', '--abort');
			await expect(
				runSync(fixture, { ...env, SYNC_RECOVERY: 'resume' }, 'n\n')
			).rejects.toMatchObject({
				stderr: expect.stringContaining(
					'candidate has no matching rebase-completion witness'
				),
			});
			await runSync(fixture, { ...env, SYNC_RECOVERY: 'abort' }, '');
		},
		integrationTimeout
	);

	it(
		'refuses to abort a rebase it does not own',
		async () => {
			const fixture = await createFixture();
			await prepareConflictFixture(fixture);
			const env = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: ':',
			};
			await expect(runSync(fixture, env, '\n')).rejects.toBeDefined();
			await git(fixture.work, 'rebase', '--abort');
			await git(
				fixture.work,
				'checkout',
				'-b',
				'unrelated',
				'wpkernel-sync-candidate'
			);
			await expect(
				execFileAsync(
					'git',
					['rebase', 'refs/wpkernel-sync/expected-upstream'],
					{
						cwd: fixture.work,
					}
				)
			).rejects.toBeDefined();

			await expect(
				runSync(fixture, { ...env, SYNC_RECOVERY: 'abort' }, '')
			).rejects.toMatchObject({
				stderr: expect.stringContaining(
					'active rebase is not owned by WPKernel synchronisation'
				),
			});
			expect(await rebaseIsActive(fixture.work)).toBe(true);
			await git(fixture.work, 'rebase', '--abort');
			await runSync(fixture, { ...env, SYNC_RECOVERY: 'abort' }, '');
		},
		integrationTimeout
	);

	it(
		'preserves the named candidate when main CAS adoption fails',
		async () => {
			const fixture = await createFixture();
			await commitFile(fixture.work, 'authoring.txt', 'authoring\n');
			await git(
				fixture.work,
				'push',
				fixture.origin,
				'HEAD:refs/heads/main'
			);
			const env = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: ':',
				MOCK_FAIL_RECOVERY_CAS: '1',
			};

			await expect(runSync(fixture, env, '\n')).rejects.toMatchObject({
				stderr: expect.stringContaining(
					'candidate remains preserved on wpkernel-sync-candidate'
				),
			});
			await expect(
				git(
					fixture.work,
					'show-ref',
					'--verify',
					'refs/heads/wpkernel-sync-candidate'
				)
			).resolves.toBeTruthy();
			await runSync(fixture, { ...env, SYNC_RECOVERY: 'abort' }, '');
			expect(await git(fixture.work, 'branch', '--show-current')).toBe(
				'main'
			);
		},
		integrationTimeout
	);

	it(
		'refuses a dirty pre-push state even when ALLOW_DIRTY is set',
		async () => {
			const fixture = await createFixture();
			await commitFile(fixture.work, 'authoring.txt', 'authoring\n');
			await git(
				fixture.work,
				'push',
				fixture.origin,
				'HEAD:refs/heads/main'
			);
			const env: NodeJS.ProcessEnv = {
				...(await createMockGit(fixture)),
				ALLOW_DIRTY: '1',
				GIT_SEQUENCE_EDITOR: ':',
				MOCK_DIRTY_AFTER_ADOPTION: '1',
			};

			await expect(runSync(fixture, env, '\ny\n')).rejects.toMatchObject({
				stderr: expect.stringContaining('working tree has changes'),
			});
			await expect(
				access(env.MOCK_PUSH_LOG as string)
			).rejects.toBeDefined();
		},
		integrationTimeout
	);

	it(
		'rejects a candidate move before creating its completion witness',
		async () => {
			const fixture = await createFixture();
			await commitFile(fixture.work, 'authoring.txt', 'authoring\n');
			await git(
				fixture.work,
				'push',
				fixture.origin,
				'HEAD:refs/heads/main'
			);
			const concurrentSha = await git(
				fixture.work,
				'rev-parse',
				fixture.baseSha
			);
			const env = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: ':',
				MOCK_MOVE_BEFORE_WITNESS: '1',
				MOCK_CONCURRENT_SHA: concurrentSha,
			};

			await expect(runSync(fixture, env, '\n')).rejects.toMatchObject({
				stderr: expect.stringContaining(
					'recovery candidate changed before completion could be witnessed'
				),
			});
			expect(
				await git(
					fixture.work,
					'rev-parse',
					'refs/heads/wpkernel-sync-candidate'
				)
			).toBe(concurrentSha);
			await runSync(
				fixture,
				{
					...env,
					SYNC_RECOVERY: 'abort',
					MOCK_MOVE_BEFORE_WITNESS: '0',
				},
				''
			);
		},
		integrationTimeout
	);

	it('rejects an authority move between resume validation and adoption', async () => {
		const fixture = await createFixture();
		await prepareConflictFixture(fixture);
		const env: NodeJS.ProcessEnv = {
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
		const candidateTree = await git(
			fixture.work,
			'rev-parse',
			'HEAD^{tree}'
		);
		const recordedUpstream = await git(
			fixture.work,
			'rev-parse',
			'refs/wpkernel-sync/expected-upstream'
		);
		const concurrentSha = await git(
			fixture.work,
			'commit-tree',
			candidateTree,
			'-p',
			recordedUpstream,
			'-m',
			'concurrent witnessed candidate'
		);
		await expect(
			runSync(
				fixture,
				{
					...env,
					SYNC_RECOVERY: 'complete',
					MOCK_MOVE_BEFORE_ADOPTION: '1',
					MOCK_CONCURRENT_SHA: concurrentSha,
				},
				'n\n'
			)
		).rejects.toMatchObject({
			stderr: expect.stringContaining(
				'recovery authority changed concurrently'
			),
		});
		expect(
			await git(
				fixture.work,
				'rev-parse',
				'refs/heads/wpkernel-sync-candidate'
			)
		).toBe(concurrentSha);
		expect(
			await git(fixture.work, 'rev-parse', 'refs/wpkernel-sync/completed')
		).toBe(concurrentSha);
		await runSync(fixture, { ...env, SYNC_RECOVERY: 'abort' }, '');
	}, 60_000);

	it(
		'preserves a concurrently advanced candidate during cleanup',
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
				'concurrent candidate'
			);
			const env = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: ':',
				MOCK_MOVE_RECOVERY_ON_CLEANUP: '1',
				MOCK_CONCURRENT_SHA: concurrentSha,
			};

			await expect(runSync(fixture, env, '\n')).rejects.toMatchObject({
				stderr: expect.stringContaining(
					'recovery state changed concurrently; preserving every recovery ref'
				),
			});
			expect(
				await git(
					fixture.work,
					'rev-parse',
					'refs/heads/wpkernel-sync-candidate'
				)
			).toBe(concurrentSha);
			await runSync(
				fixture,
				{
					...env,
					SYNC_RECOVERY: 'abort',
					MOCK_MOVE_RECOVERY_ON_CLEANUP: '0',
				},
				''
			);
		},
		integrationTimeout
	);

	it(
		'preserves all state when completion appears during cleanup',
		async () => {
			const fixture = await createFixture();
			await prepareConflictFixture(fixture);
			const env = {
				...(await createMockGit(fixture)),
				GIT_SEQUENCE_EDITOR: ':',
			};
			await expect(runSync(fixture, env, '\n')).rejects.toBeDefined();

			await expect(
				runSync(
					fixture,
					{
						...env,
						SYNC_RECOVERY: 'abort',
						MOCK_CREATE_COMPLETION_ON_CLEANUP: '1',
					},
					''
				)
			).rejects.toMatchObject({
				stderr: expect.stringContaining(
					'recovery state changed concurrently; preserving every recovery ref'
				),
			});
			await expect(
				git(
					fixture.work,
					'show-ref',
					'--verify',
					'refs/wpkernel-sync/completed'
				)
			).resolves.toBeTruthy();
			await runSync(fixture, { ...env, SYNC_RECOVERY: 'abort' }, '');
		},
		integrationTimeout
	);
});
