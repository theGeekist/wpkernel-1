import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
	inspectPipelineArchive,
	parsePipelineVersion,
	readPipelineReleaseMetadata,
	verifyPipelineArchive,
} from './pipeline-release-metadata.mjs';

const pipelineManifest = (version, tag) => ({
	name: '@wpkernel/pipeline',
	publishConfig: {
		access: 'public',
		registry: 'https://registry.npmjs.org/',
		tag,
	},
	version,
});

describe('Pipeline release metadata', () => {
	it('routes stable and prerelease versions independently of build metadata', () => {
		assert.deepEqual(parsePipelineVersion('2.0.0'), {
			distTag: 'latest',
			version: '2.0.0',
		});
		assert.deepEqual(parsePipelineVersion('2.0.0+build-x'), {
			distTag: 'latest',
			version: '2.0.0+build-x',
		});
		assert.deepEqual(parsePipelineVersion('2.1.0-beta.3+build-x'), {
			distTag: 'beta',
			version: '2.1.0-beta.3+build-x',
		});
	});

	it('rejects invalid numeric identifiers and incomplete versions', () => {
		for (const version of ['2.0.0-01', '02.0.0', '2.0', '2.0.0-']) {
			assert.throws(
				() => parsePipelineVersion(version),
				/not valid SemVer/u
			);
		}
	});

	it('binds the expected tag and detects archive replacement', () => {
		const root = mkdtempSync(join(tmpdir(), 'pipeline-release-metadata-'));
		try {
			const manifest = join(root, 'package.json');
			const archive = join(root, 'pipeline.tgz');
			const metadata = join(root, 'release-metadata.json');
			writeFileSync(
				manifest,
				JSON.stringify(pipelineManifest('2.0.0', 'latest'))
			);
			writeFileSync(archive, 'qualified archive');

			assert.deepEqual(
				readPipelineReleaseMetadata(manifest, 'pipeline-v2.0.0'),
				{
					distTag: 'latest',
					version: '2.0.0',
				}
			);
			assert.throws(
				() => readPipelineReleaseMetadata(manifest, 'pipeline-v2.0.1'),
				/does not match/u
			);

			writeFileSync(
				metadata,
				JSON.stringify({
					...parsePipelineVersion('2.0.0'),
					...inspectPipelineArchive(archive),
				})
			);
			assert.equal(
				verifyPipelineArchive(metadata, archive).version,
				'2.0.0'
			);
			writeFileSync(archive, 'replaced archive');
			assert.throws(
				() => verifyPipelineArchive(metadata, archive),
				/does not match/u
			);
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it('rejects incoherent package and recorded release channels', () => {
		const root = mkdtempSync(join(tmpdir(), 'pipeline-release-channel-'));
		try {
			const manifest = join(root, 'package.json');
			const archive = join(root, 'pipeline.tgz');
			const metadata = join(root, 'release-metadata.json');
			writeFileSync(archive, 'qualified archive');
			writeFileSync(
				manifest,
				JSON.stringify(pipelineManifest('2.1.0-beta.1', 'latest'))
			);
			assert.throws(
				() => readPipelineReleaseMetadata(manifest),
				/publishConfig\.tag must be beta/u
			);

			writeFileSync(
				metadata,
				JSON.stringify({
					...parsePipelineVersion('2.0.0'),
					...inspectPipelineArchive(archive),
					distTag: 'beta',
				})
			);
			assert.throws(
				() => verifyPipelineArchive(metadata, archive),
				/incoherent distribution tag/u
			);
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it('rejects a foreign package or publication target', () => {
		const root = mkdtempSync(join(tmpdir(), 'pipeline-release-target-'));
		try {
			const manifest = join(root, 'package.json');
			for (const [invalid, expected] of [
				[
					{
						...pipelineManifest('2.0.0', 'latest'),
						name: '@wpkernel/not-pipeline',
					},
					/not @wpkernel\/pipeline/u,
				],
				[
					{
						...pipelineManifest('2.0.0', 'latest'),
						publishConfig: {
							access: 'restricted',
							registry: 'https://registry.npmjs.org/',
							tag: 'latest',
						},
					},
					/public npm registry/u,
				],
				[
					{
						...pipelineManifest('2.0.0', 'latest'),
						publishConfig: {
							access: 'public',
							registry: 'https://registry.example.test/',
							tag: 'latest',
						},
					},
					/public npm registry/u,
				],
			]) {
				writeFileSync(manifest, JSON.stringify(invalid));
				assert.throws(
					() => readPipelineReleaseMetadata(manifest),
					expected
				);
			}
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});
