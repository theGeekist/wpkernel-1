import { execFile } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const workflowScripts = [
	'scripts/workflow/prepare-upstream-pr.sh',
	'scripts/workflow/sync-fork-main.sh',
] as const;
const fixtureRoots: string[] = [];

describe('repository workflow shell scripts', () => {
	afterEach(async () => {
		await Promise.all(
			fixtureRoots.splice(0).map((root) => rm(root, { recursive: true }))
		);
	});

	it.each(workflowScripts)('%s has valid Bash syntax', async (script) => {
		await expect(
			execFileAsync('bash', ['-n', path.resolve(script)])
		).resolves.toMatchObject({ stderr: '' });
	});

	it.each(workflowScripts)('%s is executable', async (script) => {
		await expect(
			access(path.resolve(script), constants.X_OK)
		).resolves.toBeUndefined();
	});

	it('refuses to synchronise over untracked work', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-sync-script-'));
		fixtureRoots.push(root);
		await execFileAsync('git', ['init', '--quiet'], { cwd: root });
		await writeFile(
			path.join(root, 'untracked.txt'),
			'preserve me\n',
			'utf8'
		);

		await expect(
			execFileAsync(
				path.resolve('scripts/workflow/sync-fork-main.sh'),
				[],
				{
					cwd: root,
				}
			)
		).rejects.toMatchObject({
			stderr: expect.stringContaining('working tree has changes'),
		});
	});
});
