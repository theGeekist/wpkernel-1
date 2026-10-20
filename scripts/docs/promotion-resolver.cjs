#!/usr/bin/env node

const fs = require('node:fs');

const AUTHORING_REPOSITORY = 'theGeekist/wpkernel-1';
const MAX_ASSOCIATED_PULL_PAGES = 3;
const PAGE_SIZE = 100;

function nonEmptyString(value) {
	return typeof value === 'string' && value.length > 0;
}

function isObject(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function object(value, label) {
	if (isObject(value)) {
		return value;
	}

	throw new Error(`${label} is not an object`);
}

function json(text, label) {
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`${label} is not valid JSON`);
	}
}

function parsePublicApiResponse(response) {
	const status = String(response.status);
	const headers = response.headers || {};
	if (status !== '200') {
		const remaining = headers['x-ratelimit-remaining'] || 'unknown';
		const resetAt = headers['x-ratelimit-reset'] || 'unknown';
		throw new Error(
			`Unauthenticated GitHub API request failed with HTTP ${status}; rate-limit remaining=${remaining}, reset=${resetAt}: ${response.url}`
		);
	}

	return json(response.bodyText, 'GitHub API response');
}

function resolvePromotion(input) {
	const sourceSha = findPromotionSourceSha(
		input.upstreamSha,
		input.pullsPages
	);
	assertCommitSha(input.upstreamCommit, input.upstreamSha, 'upstream commit');
	assertCommitSha(input.sourceCommit, sourceSha, 'authoring commit');
	const upstreamTree = treeSha(input.upstreamCommit, 'upstream commit');
	const sourceTree = treeSha(input.sourceCommit, 'authoring commit');
	if (sourceTree !== upstreamTree) {
		throw new Error('authoring and upstream commit trees do not match');
	}

	return { sourceSha, sourceTree };
}

function assertCommitSha(commit, expectedSha, label) {
	const sha = object(commit, label).sha;
	if (nonEmptyString(sha) && sha !== expectedSha) {
		throw new Error(`${label} SHA does not match the expected revision`);
	}
}

function findPromotionSourceSha(upstreamSha, pullsPages) {
	if (pullsPages.length > MAX_ASSOCIATED_PULL_PAGES) {
		throw new Error(
			`Associated-pull lookup exceeded the explicit ${MAX_ASSOCIATED_PULL_PAGES * PAGE_SIZE}-entry bound.`
		);
	}

	const pulls = [];
	for (const page of pullsPages) {
		pulls.push(...associatedPullPage(page));
	}
	if (
		pullsPages.length === MAX_ASSOCIATED_PULL_PAGES &&
		pullsPages.at(-1)?.length === PAGE_SIZE
	) {
		throw new Error(
			`Associated-pull lookup exceeded the explicit ${MAX_ASSOCIATED_PULL_PAGES * PAGE_SIZE}-entry bound.`
		);
	}

	const matches = pulls.filter((pull) => isPromotionPull(pull, upstreamSha));
	if (matches.length !== 1) {
		throw new Error(
			`expected exactly one merged ${AUTHORING_REPOSITORY} pull request for the upstream revision`
		);
	}

	const sourceSha = object(
		object(matches[0], 'promotion pull').head,
		'promotion pull head'
	).sha;
	if (typeof sourceSha !== 'string' || sourceSha.length === 0) {
		throw new Error('promotion pull head SHA is missing');
	}
	return sourceSha;
}

function associatedPullPage(page) {
	if (!Array.isArray(page)) {
		throw new Error('associated-pulls response is not an array');
	}
	if (page.length > PAGE_SIZE) {
		throw new Error(
			'associated-pulls response exceeds the 100-entry page size'
		);
	}
	return page;
}

function associatedPullPageState(page, pageNumber) {
	const pulls = associatedPullPage(page);
	if (!Number.isInteger(pageNumber) || pageNumber < 1) {
		throw new Error('associated-pull page number is invalid');
	}
	if (pulls.length < PAGE_SIZE) {
		return 'complete';
	}
	if (pageNumber >= MAX_ASSOCIATED_PULL_PAGES) {
		throw new Error(
			`Associated-pull lookup exceeded the explicit ${MAX_ASSOCIATED_PULL_PAGES * PAGE_SIZE}-entry bound.`
		);
	}

	return 'continue';
}

function isPromotionPull(pull, upstreamSha) {
	if (!isObject(pull)) {
		return false;
	}

	const candidate = /** @type {Record<string, unknown>} */ (pull);
	if (!isObject(candidate.base) || !isObject(candidate.head)) {
		return false;
	}
	const base = candidate.base;
	const head = candidate.head;
	if (!isObject(head.repo)) {
		return false;
	}
	const repository = head.repo;
	return (
		nonEmptyString(candidate.merged_at) &&
		base.ref === 'main' &&
		candidate.merge_commit_sha === upstreamSha &&
		repository.full_name === AUTHORING_REPOSITORY
	);
}

function treeSha(commit, label) {
	const tree = object(object(commit, label).tree, `${label} tree`);
	if (typeof tree.sha === 'string' && tree.sha.length > 0) {
		return tree.sha;
	}

	throw new Error(`${label} tree SHA is missing`);
}

function selectAuthoringCI(input) {
	const response = object(input.workflowRuns, 'authoring CI response');
	if (!Array.isArray(response.workflow_runs)) {
		throw new Error('authoring CI response workflow_runs is not an array');
	}

	const runs = response.workflow_runs.filter((run) =>
		isSourceMainPush(run, input.sourceSha)
	);
	if (
		runs.length === 0 ||
		runs.some(
			(run) => object(run, 'authoring CI run').status !== 'completed'
		)
	) {
		return { state: 'pending', runId: '', runUrl: '' };
	}

	const latest = [...runs].sort(compareRuns).at(-1);
	const run = object(latest, 'authoring CI run');
	const runId = run.id;
	const runUrl = run.html_url;
	const usableRunId =
		(typeof runId === 'number' && Number.isFinite(runId) && runId > 0) ||
		nonEmptyString(runId);
	if (!usableRunId || !nonEmptyString(runUrl)) {
		throw new Error('latest authoring CI run has no ID or URL');
	}
	if (run.conclusion === 'success') {
		return { state: 'success', runId: String(runId), runUrl };
	}

	return { state: 'failure', runId: String(runId), runUrl };
}

function isSourceMainPush(run, sourceSha) {
	if (!run || typeof run !== 'object' || Array.isArray(run)) {
		return false;
	}

	const candidate = /** @type {Record<string, unknown>} */ (run);
	return (
		candidate.head_sha === sourceSha &&
		candidate.head_branch === 'main' &&
		candidate.event === 'push'
	);
}

function compareRuns(left, right) {
	const first = object(left, 'authoring CI run');
	const second = object(right, 'authoring CI run');
	const attempt = Number(first.run_attempt) - Number(second.run_attempt);
	if (attempt !== 0) {
		return attempt;
	}

	return String(first.updated_at).localeCompare(String(second.updated_at));
}

function readJson(file) {
	return json(fs.readFileSync(file, 'utf8'), file);
}

function readHeaders(file) {
	const headers = {};
	for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
		const match = /^([^:]+):\s*(.*)$/.exec(line);
		if (match) {
			headers[match[1].toLowerCase()] = match[2];
		}
	}
	return headers;
}

function argumentValue(args, name) {
	const index = args.indexOf(name);
	if (index === -1 || !args[index + 1]) {
		throw new Error(`missing required argument ${name}`);
	}
	return args[index + 1];
}

function values(args, name) {
	const matches = [];
	for (let index = 0; index < args.length; index += 1) {
		if (args[index] === name && args[index + 1]) {
			matches.push(args[index + 1]);
		}
	}
	if (matches.length === 0) {
		throw new Error(`missing required argument ${name}`);
	}
	return matches;
}

function main() {
	const [command, ...args] = process.argv.slice(2);
	if (command === 'check-public-response') {
		parsePublicApiResponse({
			bodyText: fs.readFileSync(
				argumentValue(args, '--body-file'),
				'utf8'
			),
			headers: readHeaders(argumentValue(args, '--headers-file')),
			status: argumentValue(args, '--status'),
			url: argumentValue(args, '--url'),
		});
		return;
	}
	if (command === 'resolve-promotion') {
		const result = resolvePromotion({
			pullsPages: values(args, '--pulls-file').map(readJson),
			sourceCommit: readJson(argumentValue(args, '--source-commit-file')),
			upstreamCommit: readJson(
				argumentValue(args, '--upstream-commit-file')
			),
			upstreamSha: argumentValue(args, '--upstream-sha'),
		});
		process.stdout.write(`${result.sourceSha}\t${result.sourceTree}\n`);
		return;
	}
	if (command === 'find-promotion') {
		process.stdout.write(
			`${findPromotionSourceSha(
				argumentValue(args, '--upstream-sha'),
				values(args, '--pulls-file').map(readJson)
			)}\n`
		);
		return;
	}
	if (command === 'associated-pull-page-state') {
		process.stdout.write(
			`${associatedPullPageState(
				readJson(argumentValue(args, '--page-file')),
				Number(argumentValue(args, '--page-number'))
			)}\n`
		);
		return;
	}
	if (command === 'select-ci') {
		const result = selectAuthoringCI({
			sourceSha: argumentValue(args, '--source-sha'),
			workflowRuns: readJson(argumentValue(args, '--response-file')),
		});
		process.stdout.write(
			`${result.state}\t${result.runId}\t${result.runUrl}\n`
		);
		return;
	}

	throw new Error(`unknown command ${command || '(none)'}`);
}

if (require.main === module) {
	try {
		main();
	} catch (error) {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	}
}

module.exports = {
	parsePublicApiResponse,
	associatedPullPageState,
	findPromotionSourceSha,
	resolvePromotion,
	selectAuthoringCI,
};
