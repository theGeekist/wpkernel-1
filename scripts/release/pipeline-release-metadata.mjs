#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SEMVER =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;

export const parsePipelineVersion = (version) => {
	if (typeof version !== 'string') {
		throw new TypeError('Pipeline version must be a string.');
	}
	const match = SEMVER.exec(version);
	if (!match) {
		throw new Error(
			`Pipeline manifest version is not valid SemVer: ${version}`
		);
	}
	return Object.freeze({
		distTag: match[4] === undefined ? 'latest' : 'beta',
		version,
	});
};

export const readPipelineReleaseMetadata = (manifestPath, expectedTag) => {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	const metadata = parsePipelineVersion(manifest.version);
	if (manifest.name !== '@wpkernel/pipeline') {
		throw new Error(
			`Release manifest is not @wpkernel/pipeline: ${String(manifest.name)}`
		);
	}
	if (
		manifest.publishConfig?.access !== 'public' ||
		manifest.publishConfig?.registry !== 'https://registry.npmjs.org/'
	) {
		throw new Error(
			'Pipeline publication must target the public npm registry.'
		);
	}
	if (manifest.publishConfig?.tag !== metadata.distTag) {
		throw new Error(
			`Pipeline publishConfig.tag must be ${metadata.distTag} for ${metadata.version}.`
		);
	}
	if (
		expectedTag !== undefined &&
		expectedTag !== `pipeline-v${metadata.version}`
	) {
		throw new Error(
			`Release tag ${expectedTag} does not match pipeline-v${metadata.version}.`
		);
	}
	return metadata;
};

export const inspectPipelineArchive = (archivePath) => {
	const bytes = readFileSync(archivePath);
	return Object.freeze({
		integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
		shasum: createHash('sha1').update(bytes).digest('hex'),
		sha512: createHash('sha512').update(bytes).digest('hex'),
	});
};

export const verifyPipelineArchive = (metadataPath, archivePath) => {
	const expected = JSON.parse(readFileSync(metadataPath, 'utf8'));
	const release = parsePipelineVersion(expected.version);
	if (expected.distTag !== release.distTag) {
		throw new Error(
			'Release archive metadata contains an incoherent distribution tag.'
		);
	}
	const actual = inspectPipelineArchive(archivePath);
	if (
		expected.integrity !== actual.integrity ||
		expected.shasum !== actual.shasum ||
		expected.sha512 !== actual.sha512
	) {
		throw new Error(
			'Release archive does not match its qualified SHA-512 identity.'
		);
	}
	return Object.freeze({ ...release, ...actual });
};

const runCli = () => {
	const [command, ...args] = process.argv.slice(2);
	if (command === 'identity') {
		const metadata = readPipelineReleaseMetadata(args[0], args[1]);
		process.stdout.write(`${metadata.version}|${metadata.distTag}\n`);
		return;
	}
	if (command === 'record-archive') {
		const [manifestPath, expectedTag, archivePath, outputPath] = args;
		const release = readPipelineReleaseMetadata(manifestPath, expectedTag);
		const archive = inspectPipelineArchive(archivePath);
		writeFileSync(
			outputPath,
			`${JSON.stringify({ ...release, ...archive }, null, 2)}\n`
		);
		return;
	}
	if (command === 'verify-archive') {
		verifyPipelineArchive(args[0], args[1]);
		return;
	}
	throw new Error(
		'Usage: pipeline-release-metadata.mjs <identity|record-archive|verify-archive> ...'
	);
};

if (
	process.argv[1] &&
	pathToFileURL(process.argv[1]).href === import.meta.url
) {
	runCli();
}
