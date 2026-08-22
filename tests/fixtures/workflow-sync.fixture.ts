import { execFile } from 'node:child_process';
import { access, chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const syncScript = path.resolve('scripts/workflow/sync-fork-main.sh');
const fixtureRoots: string[] = [];

export type SyncFixture = {
	readonly root: string;
	readonly work: string;
	readonly origin: string;
	readonly upstream: string;
	readonly baseSha: string;
};

export async function git(cwd: string, ...args: string[]): Promise<string> {
	const { stdout } = await execFileAsync('git', args, { cwd });
	return stdout.trim();
}

export async function commitFile(
	work: string,
	name: string,
	contents: string
): Promise<string> {
	await writeFile(path.join(work, name), contents, 'utf8');
	await git(work, 'add', name);
	await git(work, 'commit', '--quiet', '-m', `${name}:${contents.trim()}`);
	return git(work, 'rev-parse', 'HEAD');
}

export async function createFixture(): Promise<SyncFixture> {
	const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-sync-integration-'));
	fixtureRoots.push(root);
	const work = path.join(root, 'work');
	const origin = path.join(root, 'origin.git');
	const upstream = path.join(root, 'upstream.git');
	await mkdir(work);
	await git(work, 'init', '--quiet', '--initial-branch=main');
	await git(work, 'config', 'user.name', 'Workflow Test');
	await git(work, 'config', 'user.email', 'workflow@example.test');
	const baseSha = await commitFile(work, 'shared.txt', 'base\n');
	await git(root, 'init', '--quiet', '--bare', origin);
	await git(root, 'init', '--quiet', '--bare', upstream);
	await git(work, 'push', origin, 'HEAD:refs/heads/main');
	await git(work, 'push', upstream, 'HEAD:refs/heads/main');
	await git(
		work,
		'remote',
		'add',
		'origin',
		'https://github.com/theGeekist/wpkernel-1.git'
	);
	await git(
		work,
		'remote',
		'add',
		'upstream',
		'https://github.com/wpkernel/wpkernel.git'
	);
	return { root, work, origin, upstream, baseSha };
}

export async function prepareConflictFixture(
	fixture: SyncFixture
): Promise<void> {
	const sourceSha = await commitFile(fixture.work, 'shared.txt', 'source\n');
	await git(fixture.work, 'push', fixture.origin, 'HEAD:refs/heads/main');
	await git(fixture.work, 'reset', '--hard', fixture.baseSha);
	await commitFile(fixture.work, 'shared.txt', 'release\n');
	await git(fixture.work, 'push', fixture.upstream, 'HEAD:refs/heads/main');
	await git(fixture.work, 'reset', '--hard', sourceSha);
}

export async function rebaseIsActive(work: string): Promise<boolean> {
	try {
		await access(path.join(work, '.git', 'rebase-merge'));
		return true;
	} catch {
		return false;
	}
}

export async function createMockGit(
	fixture: SyncFixture
): Promise<NodeJS.ProcessEnv> {
	const bin = path.join(fixture.root, 'bin');
	const pushLog = path.join(fixture.root, 'push.log');
	await mkdir(bin);
	const realGit = (await execFileAsync('which', ['git'])).stdout.trim();
	const wrapper = [
		'#!/usr/bin/env bash',
		'set -euo pipefail',
		'if [[ $1 == ls-remote ]]; then',
		'  url=$3',
		'  if [[ $url == *theGeekist/wpkernel-1.git ]]; then source=$MOCK_ORIGIN_REPOSITORY; else source=$MOCK_UPSTREAM_REPOSITORY; fi',
		'  exec "$REAL_GIT" ls-remote --exit-code "$source" "$4"',
		'fi',
		'if [[ $1 == fetch ]]; then',
		'  url=$2',
		'  refspec=$3',
		'  if [[ $url == *theGeekist/wpkernel-1.git ]]; then source=$MOCK_ORIGIN_REPOSITORY; else source=$MOCK_UPSTREAM_REPOSITORY; fi',
		'  "$REAL_GIT" fetch "$source" "$refspec"',
		'  if [[ ${MOCK_MOVE_TRACKING_AFTER_FETCH:-0} == 1 ]]; then',
		'    "$REAL_GIT" update-ref refs/remotes/origin/main "$MOCK_CONCURRENT_SHA"',
		'    "$REAL_GIT" update-ref refs/remotes/upstream/main "$MOCK_CONCURRENT_SHA"',
		'  fi',
		'  if [[ ${MOCK_MOVE_PRIVATE_AFTER_FETCH:-0} == 1 ]]; then',
		'    while IFS= read -r snapshot_ref; do',
		'      "$REAL_GIT" update-ref "$snapshot_ref" "$MOCK_CONCURRENT_SHA"',
		'    done < <("$REAL_GIT" for-each-ref --format="%(refname)" refs/wpkernel-sync)',
		'  fi',
		'  exit 0',
		'fi',
		'if [[ $1 == push ]]; then',
		'  printf "%s\\n" "$@" >"$MOCK_PUSH_LOG"',
		'  exit 0',
		'fi',
		'if [[ $1 == update-ref && ${2:-} == --stdin ]]; then',
		'  input=$(cat)',
		'  if [[ ${MOCK_FAIL_RECOVERY_CAS:-0} == 1 && $input == *"update refs/heads/main"* ]]; then exit 86; fi',
		'  if [[ ${MOCK_MOVE_BEFORE_WITNESS:-0} == 1 && $input == *"create refs/wpkernel-sync/completed"* ]]; then',
		'    "$REAL_GIT" update-ref refs/heads/wpkernel-sync-candidate "$MOCK_CONCURRENT_SHA"',
		'  fi',
		'  if [[ ${MOCK_MOVE_BEFORE_ADOPTION:-0} == 1 && $input == *"update refs/heads/main"* ]]; then',
		'    current=$("$REAL_GIT" rev-parse refs/heads/wpkernel-sync-candidate)',
		'    completed=$("$REAL_GIT" rev-parse refs/wpkernel-sync/completed)',
		'    printf "start\\nupdate refs/heads/wpkernel-sync-candidate %s %s\\nupdate refs/wpkernel-sync/completed %s %s\\nprepare\\ncommit\\n" "$MOCK_CONCURRENT_SHA" "$current" "$MOCK_CONCURRENT_SHA" "$completed" | "$REAL_GIT" update-ref --stdin >/dev/null',
		'  fi',
		'  if [[ ${MOCK_MOVE_RECOVERY_ON_CLEANUP:-0} == 1 && $input == *"delete refs/heads/wpkernel-sync-candidate"* ]]; then',
		'    "$REAL_GIT" update-ref refs/heads/wpkernel-sync-candidate "$MOCK_CONCURRENT_SHA"',
		'  fi',
		'  if [[ ${MOCK_CREATE_COMPLETION_ON_CLEANUP:-0} == 1 && $input == *"delete refs/heads/wpkernel-sync-candidate"* ]]; then',
		'    candidate=$("$REAL_GIT" rev-parse refs/heads/wpkernel-sync-candidate)',
		'    "$REAL_GIT" update-ref refs/wpkernel-sync/completed "$candidate"',
		'  fi',
		'  printf "%s\\n" "$input" | "$REAL_GIT" "$@"',
		'  result=$?',
		'  if [[ ${MOCK_DIRTY_AFTER_ADOPTION:-0} == 1 && $input == *"update refs/heads/main"* && $result == 0 ]]; then',
		'    printf dirty > concurrent-untracked.txt',
		'  fi',
		'  exit "$result"',
		'fi',
		'exec "$REAL_GIT" "$@"',
		'',
	].join('\n');
	await writeFile(path.join(bin, 'git'), wrapper, 'utf8');
	await chmod(path.join(bin, 'git'), 0o755);
	return {
		...process.env,
		PATH: `${bin}:${process.env.PATH ?? ''}`,
		REAL_GIT: realGit,
		MOCK_ORIGIN_REPOSITORY: fixture.origin,
		MOCK_UPSTREAM_REPOSITORY: fixture.upstream,
		MOCK_PUSH_LOG: pushLog,
		SYNC_SCRIPT: syncScript,
	};
}

export async function runSync(
	fixture: SyncFixture,
	env: NodeJS.ProcessEnv,
	input: string
) {
	return execFileAsync(
		'bash',
		['-c', 'printf %s "$SYNC_INPUT" | "$SYNC_SCRIPT"'],
		{
			cwd: fixture.work,
			env: { ...env, SYNC_INPUT: input },
			timeout: 45_000,
		}
	);
}

export async function cleanupFixtures(): Promise<void> {
	await Promise.all(
		fixtureRoots.splice(0).map((root) => rm(root, { recursive: true }))
	);
}
