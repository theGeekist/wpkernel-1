import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, posix, resolve } from 'node:path';

import { packageRoot } from './context.mjs';

const packArchive = (qualificationRoot) => {
	execFileSync('pnpm', ['pack', '--pack-destination', qualificationRoot], {
		cwd: packageRoot,
		stdio: 'pipe',
	});
	const archive = readdirSync(qualificationRoot).find((entry) =>
		entry.endsWith('.tgz')
	);
	if (!archive) {
		throw new Error('pnpm pack did not produce a tarball.');
	}
	return join(qualificationRoot, archive);
};

export const resolveArchive = (qualificationRoot, suppliedArchive) => {
	if (!suppliedArchive) {
		return packArchive(qualificationRoot);
	}
	const archive = resolve(process.cwd(), suppliedArchive);
	if (!existsSync(archive)) {
		throw new Error(`Supplied tarball does not exist: ${archive}`);
	}
	return archive;
};

export const inspectArchive = (archive) => {
	const contentsBuffer = readFileSync(archive);
	const sha512 = createHash('sha512').update(contentsBuffer).digest('hex');
	const integrity = `sha512-${createHash('sha512')
		.update(contentsBuffer)
		.digest('base64')}`;
	const contents = execFileSync('tar', ['-tzf', archive], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	})
		.trim()
		.split('\n')
		.filter(Boolean)
		.sort();
	return { basename: basename(archive), contents, integrity, sha512 };
};

const collectExportTargets = (value) => {
	if (typeof value === 'string') {
		return [value];
	}
	if (!value || typeof value !== 'object') {
		return [];
	}
	return Object.values(value).flatMap(collectExportTargets);
};

export const assertArchiveContents = (archiveIdentity, manifest) => {
	const entries = new Set(archiveIdentity.contents);
	if (entries.size !== archiveIdentity.contents.length) {
		throw new Error('Packed archive contains duplicate entries.');
	}
	const nonCanonical = archiveIdentity.contents.filter(
		(entry) =>
			entry.startsWith('/') ||
			entry.includes('\\') ||
			posix.normalize(entry) !== entry
	);
	if (nonCanonical.length > 0) {
		throw new Error(
			`Packed archive contains non-canonical paths: ${nonCanonical.join(', ')}`
		);
	}
	const expectedBasename = `${manifest.name
		.replace(/^@/u, '')
		.replaceAll('/', '-')}-${manifest.version}.tgz`;
	if (archiveIdentity.basename !== expectedBasename) {
		throw new Error(
			`Packed archive name does not match its manifest identity: expected ${expectedBasename}, received ${archiveIdentity.basename}`
		);
	}
	const allowedTopLevel = new Set([
		'package/LICENSE',
		'package/README.md',
		'package/package.json',
	]);
	const unexpected = archiveIdentity.contents.filter(
		(entry) =>
			!allowedTopLevel.has(entry) && !entry.startsWith('package/dist/')
	);
	if (unexpected.length > 0) {
		throw new Error(
			`Packed archive has entries outside its declared distribution: ${unexpected.join(', ')}`
		);
	}
	const requiredEntries = new Set([
		'package/LICENSE',
		'package/README.md',
		'package/package.json',
	]);
	for (const target of collectExportTargets(manifest.exports)) {
		if (target.startsWith('./')) {
			requiredEntries.add(`package/${target.slice(2)}`);
		}
	}
	for (const entry of requiredEntries) {
		if (!entries.has(entry)) {
			throw new Error(
				`Packed archive is missing required entry: ${entry}`
			);
		}
	}
	const forbidden = archiveIdentity.contents.filter(
		(entry) =>
			entry.includes('/src/') ||
			entry.includes('/__tests__/') ||
			/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(entry) ||
			entry.endsWith('.map') ||
			entry.includes('/scripts/')
	);
	if (forbidden.length > 0) {
		throw new Error(
			`Packed archive contains private or source debris: ${forbidden.join(', ')}`
		);
	}
};
