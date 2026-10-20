import {
	assertPromotionPullSource,
	promotionPullPaths,
	associatedPullPageState,
	findPromotionSourceSha,
	parsePublicApiResponse,
	resolvePromotion,
	selectAuthoringCI,
} from '../../../scripts/docs/promotion-resolver.cjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const upstreamSha = 'upstream-sha';
const sourceSha = 'source-sha';

function promotionPull(headSha = sourceSha) {
	return {
		base: { ref: 'main' },
		head: {
			repo: { full_name: 'theGeekist/wpkernel-1' },
			sha: headSha,
		},
		merge_commit_sha: upstreamSha,
		merged_at: '2026-08-22T00:00:00Z',
	};
}

function commit(treeSha: string, sha?: string) {
	return { ...(sha ? { sha } : {}), tree: { sha: treeSha } };
}

function ciRun(overrides: Partial<Record<string, string | number>> = {}) {
	return {
		conclusion: 'success',
		event: 'push',
		head_branch: 'main',
		head_sha: sourceSha,
		html_url: 'https://github.example/runs/10',
		id: 10,
		run_attempt: 1,
		status: 'completed',
		updated_at: '2026-08-22T00:00:00Z',
		...overrides,
	};
}

describe('documentation promotion resolver', () => {
	it.each(['before', 'after'])(
		'rejects a live PR revision changing %s metadata pagination',
		async (when) => {
			const workflow = readFileSync(
				'.github/workflows/docs-promotion.yml',
				'utf8'
			);
			const script = workflow
				.split('script: |\n')[1]
				.split('\n\n            - name:')[0]
				.split('\n')
				.map((line) => line.slice(22))
				.join('\n');
			const execute = new Function(
				'require',
				'github',
				'context',
				'process',
				`return (async () => { ${script} })();`
			);
			const expected = {
				head: { sha: 'head' },
				base: { sha: 'base' },
				changed_files: 1,
			};
			const changed = { ...expected, head: { sha: 'new-head' } };
			const get = jest
				.fn()
				.mockResolvedValueOnce({
					data: when === 'before' ? changed : expected,
				})
				.mockResolvedValueOnce({ data: changed });
			const write = jest.fn();
			const mockRequire = (name: string) =>
				name === 'node:fs'
					? { writeFileSync: write }
					: name === 'node:path'
						? path
						: { promotionPullPaths };
			await expect(
				execute(
					mockRequire,
					{
						rest: { pulls: { get, listFiles: jest.fn() } },
						paginate: jest
							.fn()
							.mockResolvedValue([{ filename: 'docs/x.md' }]),
					},
					{
						payload: { pull_request: expected },
						repo: { owner: 'wpkernel', repo: 'wpkernel' },
						issue: { number: 1 },
					},
					{ env: { RUNNER_TEMP: '/tmp' } }
				)
			).rejects.toThrow('Pull revision changed');
			expect(write).not.toHaveBeenCalled();
		}
	);

	it('retains renamed source paths from complete GitHub metadata', () => {
		const paths = promotionPullPaths({ changed_files: 1 }, [
			{ filename: 'guide.md', previous_filename: 'docs/guide.md' },
		]);
		expect(paths).toEqual(['guide.md', 'docs/guide.md']);
		expect(() =>
			assertPromotionPullSource('wpkernel/wpkernel', undefined, paths)
		).toThrow('must be promoted');
	});

	it('accepts complete paginated metadata including deleted paths', () => {
		const files = Array.from({ length: 201 }, (_, index) => ({
			filename: `docs/${index}.md`,
		}));
		expect(promotionPullPaths({ changed_files: 201 }, files)).toHaveLength(
			201
		);
	});

	it.each([0, 2, 3001, -1, Number.NaN])(
		'rejects incomplete or unbounded file list with count %s',
		(changed_files) => {
			expect(() =>
				promotionPullPaths({ changed_files }, [
					{ filename: 'docs/x.md' },
				])
			).toThrow('incomplete');
		}
	);

	it('pins admission to trusted base code with read-only metadata access', () => {
		const workflow = readFileSync(
			'.github/workflows/docs-promotion.yml',
			'utf8'
		);
		expect(workflow).toContain('pull_request_target:');
		expect(workflow).toContain(
			'ref: ${{ github.event.pull_request.base.sha }}'
		);
		expect(workflow).toContain('persist-credentials: false');
		expect(workflow).toContain('pull-requests: read');
		expect(workflow).not.toContain(
			'ref: ${{ github.event.pull_request.head.sha }}'
		);
		expect(workflow).toContain('assertRevision(before)');
		expect(workflow).toContain('assertRevision(after)');
	});

	const authoringHead = {
		repo: { full_name: 'theGeekist/wpkernel-1' },
		ref: 'main',
	};

	it.each([
		'docs/guide.md',
		'packages/pipeline/src/index.ts',
		'package.json',
		'pnpm-lock.yaml',
		'pnpm-workspace.yaml',
		'.github/workflows/docs.yml',
		'scripts/docs/promotion-resolver.cjs',
	])('rejects direct upstream PRs affecting %s before deployment', (file) => {
		expect(() =>
			assertPromotionPullSource(
				'wpkernel/wpkernel',
				{
					head: {
						repo: { full_name: 'wpkernel/wpkernel' },
						ref: 'repair',
					},
				},
				[file]
			)
		).toThrow('must be promoted from theGeekist/wpkernel-1:main');
	});

	it('admits fork-main promotions and internal authoring PRs', () => {
		expect(() =>
			assertPromotionPullSource(
				'wpkernel/wpkernel',
				{ head: authoringHead },
				['docs/deleted.md']
			)
		).not.toThrow();
		expect(() =>
			assertPromotionPullSource(
				'theGeekist/wpkernel-1',
				{ head: { ...authoringHead, ref: 'repair' } },
				['docs/guide.md']
			)
		).not.toThrow();
	});

	it('rejects fork feature branches and absent source metadata for deployment paths', () => {
		expect(() =>
			assertPromotionPullSource(
				'wpkernel/wpkernel',
				{ head: { ...authoringHead, ref: 'repair' } },
				['docs/guide.md']
			)
		).toThrow('authoring main');
		expect(() =>
			assertPromotionPullSource('wpkernel/wpkernel', undefined, [
				'docs/guide.md',
			])
		).toThrow('authoring main');
	});

	it('does not require a promotion for paths outside deployment triggers', () => {
		expect(() =>
			assertPromotionPullSource('wpkernel/wpkernel', undefined, [
				'README.md',
				'AGENTS.md',
			])
		).not.toThrow();
	});

	const docsWorkflow = readFileSync(
		path.resolve('.github/workflows/docs.yml'),
		'utf8'
	);

	it('permits manual recovery only through an explicit main-ref admission gate', () => {
		expect(docsWorkflow).toContain('    workflow_dispatch:\n');
		expect(docsWorkflow).toContain('    admit-main-ref:\n');
		expect(docsWorkflow).toContain(
			'if [[ "${GITHUB_REF}" != \'refs/heads/main\' ]]; then'
		);
		expect(docsWorkflow).toContain(
			'Documentation deployment is only admitted from refs/heads/main; received ${GITHUB_REF}.'
		);
		expect(docsWorkflow).toContain('        needs: admit-main-ref\n');
	});

	it('retains the push-only authoring-main promotion receipt contract', () => {
		expect(docsWorkflow).toContain(
			'    push:\n        branches:\n            - main\n'
		);
		expect(docsWorkflow).toContain(
			'commits/${GITHUB_SHA}/pulls?per_page=100&page=${page}'
		);
		expect(docsWorkflow).toContain(
			'branch=main&event=push&head_sha=${source_sha}&per_page=100'
		);
		expect(docsWorkflow).toContain(
			'node scripts/docs/promotion-resolver.cjs resolve-promotion'
		);
	});

	it('resolves one promotion receipt with matching authoring and upstream trees', () => {
		expect(
			resolvePromotion({
				pullsPages: [[promotionPull()]],
				sourceCommit: commit('tree-sha'),
				upstreamCommit: commit('tree-sha'),
				upstreamSha,
			})
		).toEqual({ sourceSha, sourceTree: 'tree-sha' });
	});

	it.each([
		['zero', []],
		['multiple', [promotionPull(), promotionPull('another-source-sha')]],
	])('rejects %s matching promotion receipts', (_name, pulls) => {
		expect(() => findPromotionSourceSha(upstreamSha, [pulls])).toThrow(
			'expected exactly one merged theGeekist/wpkernel-1 pull request'
		);
	});

	it('rejects an associated pull without a merged receipt', () => {
		const { merged_at: _mergedAt, ...unmergedPull } = promotionPull();
		expect(() =>
			findPromotionSourceSha(upstreamSha, [[unmergedPull]])
		).toThrow(
			'expected exactly one merged theGeekist/wpkernel-1 pull request'
		);
	});

	it('ignores malformed associated pulls while finding the promotion receipt', () => {
		expect(
			findPromotionSourceSha(upstreamSha, [
				[promotionPull(), { ...promotionPull(), head: { repo: null } }],
			])
		).toBe(sourceSha);
	});

	it.each([
		['a missing base', { base: undefined }],
		['an array base', { base: [] }],
		['a missing head', { head: undefined }],
		['an array head', { head: [] }],
		['a missing head repository', { head: {} }],
		['an array head repository', { head: { repo: [] } }],
	])('ignores an associated pull with %s', (_name, malformedPull) => {
		expect(
			findPromotionSourceSha(upstreamSha, [
				[promotionPull(), { ...promotionPull(), ...malformedPull }],
			])
		).toBe(sourceSha);
	});

	it.each([false, '', 0])(
		'rejects a malformed merged receipt value %p',
		(mergedAt) => {
			expect(() =>
				findPromotionSourceSha(upstreamSha, [
					[{ ...promotionPull(), merged_at: mergedAt }],
				])
			).toThrow(
				'expected exactly one merged theGeekist/wpkernel-1 pull request'
			);
		}
	);

	it('enforces the explicit associated-pull pagination bound', () => {
		const fullPage = Array.from({ length: 100 }, () => promotionPull());
		expect(associatedPullPageState(fullPage, 1)).toBe('continue');
		expect(() => associatedPullPageState(fullPage, 3)).toThrow(
			'Associated-pull lookup exceeded the explicit 300-entry bound.'
		);
	});

	it('rejects an oversized associated-pull page', () => {
		const oversizedPage = Array.from({ length: 101 }, () =>
			promotionPull()
		);
		expect(() => associatedPullPageState(oversizedPage, 1)).toThrow(
			'associated-pulls response exceeds the 100-entry page size'
		);
		expect(() =>
			findPromotionSourceSha(upstreamSha, [oversizedPage])
		).toThrow('associated-pulls response exceeds the 100-entry page size');
	});

	it('rejects a promotion receipt whose commit trees differ', () => {
		expect(() =>
			resolvePromotion({
				pullsPages: [[promotionPull()]],
				sourceCommit: commit('authoring-tree'),
				upstreamCommit: commit('upstream-tree'),
				upstreamSha,
			})
		).toThrow('authoring and upstream commit trees do not match');
	});

	it.each([
		[
			'authoring',
			commit('tree-sha', 'unexpected-source-sha'),
			commit('tree-sha', upstreamSha),
			'authoring commit SHA does not match the expected revision',
		],
		[
			'upstream',
			commit('tree-sha', sourceSha),
			commit('tree-sha', 'unexpected-upstream-sha'),
			'upstream commit SHA does not match the expected revision',
		],
	])(
		'rejects an %s commit whose API identity does not match its requested revision',
		(_name, sourceCommit, upstreamCommit, message) => {
			expect(() =>
				resolvePromotion({
					pullsPages: [[promotionPull()]],
					sourceCommit,
					upstreamCommit,
					upstreamSha,
				})
			).toThrow(message);
		}
	);

	it('rejects malformed API and associated-pull responses', () => {
		expect(() =>
			parsePublicApiResponse({
				bodyText: '{',
				status: 200,
				url: 'https://api.github.example/commit',
			})
		).toThrow('GitHub API response is not valid JSON');
		expect(() =>
			findPromotionSourceSha(upstreamSha, [{ pull: true }])
		).toThrow('associated-pulls response is not an array');
		expect(() =>
			selectAuthoringCI({ sourceSha, workflowRuns: {} })
		).toThrow('authoring CI response workflow_runs is not an array');
	});

	it('reports public API rate-limit diagnostics without making a request', () => {
		expect(() =>
			parsePublicApiResponse({
				bodyText: '{}',
				headers: {
					'x-ratelimit-remaining': '0',
					'x-ratelimit-reset': '1787356800',
				},
				status: 403,
				url: 'https://api.github.example/commit',
			})
		).toThrow('rate-limit remaining=0, reset=1787356800');
	});

	it.each([
		['absent', [], 'pending', '', ''],
		['pending', [ciRun({ status: 'in_progress' })], 'pending', '', ''],
		[
			'failed',
			[
				ciRun({
					conclusion: 'failure',
					html_url: 'https://github.example/runs/11',
					id: 11,
				}),
			],
			'failure',
			'11',
			'https://github.example/runs/11',
		],
		[
			'successful',
			[
				ciRun({
					html_url: 'https://github.example/runs/10',
					id: 10,
					run_attempt: 1,
				}),
				ciRun({
					html_url: 'https://github.example/runs/12',
					id: 12,
					run_attempt: 2,
				}),
			],
			'success',
			'12',
			'https://github.example/runs/12',
		],
	])(
		'selects %s authoring CI state',
		(_name, workflowRuns, state, runId, runUrl) => {
			expect(
				selectAuthoringCI({
					sourceSha,
					workflowRuns: { workflow_runs: workflowRuns },
				})
			).toEqual({
				state,
				runId,
				runUrl,
			});
		}
	);

	it.each([
		['empty run ID', { id: '' }],
		['zero run ID', { id: 0 }],
		['empty run URL', { html_url: '' }],
	])('rejects a successful CI receipt with %s', (_name, overrides) => {
		expect(() =>
			selectAuthoringCI({
				sourceSha,
				workflowRuns: { workflow_runs: [ciRun(overrides)] },
			})
		).toThrow('latest authoring CI run has no ID or URL');
	});
});
