import { execFileSync } from 'node:child_process';
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	assertArchiveContents,
	inspectArchive,
	resolveArchive,
} from './packed-qualification/archive.mjs';
import { qualifyConsumer } from './packed-qualification/consumer-fixture.mjs';
import { sourceManifest } from './packed-qualification/context.mjs';

const assertPackageIdentity = (installedPackage) => {
	const packedManifest = JSON.parse(
		readFileSync(join(installedPackage, 'package.json'), 'utf8')
	);
	if (
		packedManifest.name !== sourceManifest.name ||
		packedManifest.version !== sourceManifest.version
	) {
		throw new Error(
			'Packed package identity does not match the source manifest.'
		);
	}
	const exportKeys = Object.keys(packedManifest.exports ?? {}).sort();
	const expectedExports = ['.', './package.json', './v1'];
	if (JSON.stringify(exportKeys) !== JSON.stringify(expectedExports)) {
		throw new Error(
			`Packed package exposes unexpected entry points: ${exportKeys.join(', ')}`
		);
	}
	return packedManifest;
};

const installArchive = (archive, archiveIdentity, fixtureRoot) => {
	mkdirSync(fixtureRoot, { recursive: true });
	writeFileSync(
		join(fixtureRoot, 'package.json'),
		JSON.stringify(
			{
				private: true,
				type: 'module',
				dependencies: { '@wpkernel/pipeline': `file:${archive}` },
			},
			null,
			2
		)
	);
	for (const arguments_ of [
		['install', '--ignore-scripts', '--lockfile-only'],
		['install', '--ignore-scripts', '--frozen-lockfile'],
	]) {
		execFileSync('pnpm', arguments_, { cwd: fixtureRoot, stdio: 'pipe' });
	}
	const lockfile = readFileSync(join(fixtureRoot, 'pnpm-lock.yaml'), 'utf8');
	if (!lockfile.includes(archiveIdentity.integrity)) {
		throw new Error(
			'Consumer lockfile does not bind the supplied archive integrity.'
		);
	}
	return join(fixtureRoot, 'node_modules', '@wpkernel', 'pipeline');
};

const qualificationRoot = mkdtempSync(
	join(tmpdir(), 'wpkernel-pipeline-qualification-')
);
const arguments_ = process.argv
	.slice(2)
	.filter((argument) => argument !== '--');
const runtimeOnly = arguments_.includes('--runtime-only');
const suppliedArchives = arguments_.filter(
	(argument) => argument !== '--runtime-only'
);
if (suppliedArchives.length > 1) {
	throw new Error('Packed qualification accepts at most one archive.');
}
const suppliedArchive = suppliedArchives[0];

try {
	const archive = resolveArchive(qualificationRoot, suppliedArchive);
	const archiveIdentity = inspectArchive(archive);
	const fixtureRoot = join(qualificationRoot, 'consumer');
	const installedPackage = installArchive(
		archive,
		archiveIdentity,
		fixtureRoot
	);
	const packedManifest = assertPackageIdentity(installedPackage);
	assertArchiveContents(archiveIdentity, packedManifest);
	await qualifyConsumer({ fixtureRoot, installedPackage, runtimeOnly });
	console.log(
		JSON.stringify({
			archive: archiveIdentity.basename,
			contents: archiveIdentity.contents,
			integrity: archiveIdentity.integrity,
			name: packedManifest.name,
			sha512: archiveIdentity.sha512,
			verification: runtimeOnly ? 'runtime-only' : 'full',
			version: packedManifest.version,
		})
	);
	console.log(
		runtimeOnly
			? 'Packed runtime qualification passed.'
			: 'Packed Bundler and NodeNext API qualification passed.'
	);
} finally {
	rmSync(qualificationRoot, { recursive: true, force: true });
}
