import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
	collectDocumentationInputs,
	computeSignature,
	documentationGeneratorInputs,
} from '../../../scripts/docs/api-cache.cjs';

describe('API documentation cache inputs', () => {
	it('collects every generator implementation as a production cache input', async () => {
		const repositoryRoot = path.resolve('.');
		const files = await collectDocumentationInputs(repositoryRoot, [
			'pipeline',
		]);

		expect(files).toEqual(
			expect.arrayContaining([
				path.resolve('scripts/docs/api-cache.cjs'),
				path.resolve('scripts/docs/api-cache.d.cts'),
				path.resolve('scripts/docs/build-api.ts'),
				path.resolve('scripts/docs/typedoc-public-surface.mjs'),
				path.resolve('scripts/postprocess-typedoc.mjs'),
			])
		);
	});

	it('invalidates when any generator implementation changes', async () => {
		const fixture = await fs.mkdtemp(
			path.join(os.tmpdir(), 'wpkernel-docs-cache-')
		);
		try {
			const files = documentationGeneratorInputs(fixture);
			await Promise.all(
				files.map(async (file) => {
					await fs.mkdir(path.dirname(file), { recursive: true });
					await fs.writeFile(file, 'export const version = 1;\n');
				})
			);

			let signature = await computeSignature(files);
			for (const file of files) {
				await fs.writeFile(file, 'export const version = 2;\n');
				const changed = await computeSignature(files);
				expect(changed).not.toBe(signature);
				signature = changed;
			}
		} finally {
			await fs.rm(fixture, { force: true, recursive: true });
		}
	});
});
