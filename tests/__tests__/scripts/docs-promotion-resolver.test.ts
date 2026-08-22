import {
	associatedPullPageState,
	findPromotionSourceSha,
	parsePublicApiResponse,
	resolvePromotion,
	selectAuthoringCI,
} from '../../../scripts/docs/promotion-resolver.cjs';

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
