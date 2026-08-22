const { createHash } = require('node:crypto');
const { promises: fs } = require('node:fs');
const path = require('node:path');
const { glob } = require('glob');

/**
 * @param {string} repositoryRoot
 * @returns {string[]}
 */
function documentationGeneratorInputs(repositoryRoot) {
	return [
		path.join(repositoryRoot, 'scripts', 'docs', 'api-cache.cjs'),
		path.join(repositoryRoot, 'scripts', 'docs', 'api-cache.d.cts'),
		path.join(repositoryRoot, 'scripts', 'docs', 'build-api.ts'),
		path.join(
			repositoryRoot,
			'scripts',
			'docs',
			'typedoc-public-surface.mjs'
		),
		path.join(repositoryRoot, 'scripts', 'postprocess-typedoc.mjs'),
	];
}

/**
 * @param {string}   repositoryRoot
 * @param {string[]} packages
 * @returns {Promise<string[]>}
 */
async function collectDocumentationInputs(repositoryRoot, packages) {
	const patterns = packages.map((pkg) =>
		path.join(
			repositoryRoot,
			'packages',
			pkg,
			'src',
			'**',
			'*.{ts,tsx,js,jsx,d.ts}'
		)
	);
	const results = await Promise.all(
		patterns.map((pattern) => glob(pattern, { nodir: true }))
	);
	const files = new Set();

	for (const list of results) {
		for (const file of list) {
			files.add(path.resolve(file));
		}
	}

	files.add(path.join(repositoryRoot, 'typedoc.json'));
	files.add(path.join(repositoryRoot, 'tsconfig.docs.json'));
	for (const generator of documentationGeneratorInputs(repositoryRoot)) {
		files.add(generator);
	}
	for (const pkg of packages) {
		files.add(path.join(repositoryRoot, 'packages', pkg, 'package.json'));
		files.add(path.join(repositoryRoot, 'packages', pkg, 'tsconfig.json'));
	}

	return Array.from(files).sort();
}

/**
 * @param {string[]} inputFiles
 * @returns {Promise<string>}
 */
async function computeSignature(inputFiles) {
	const hash = createHash('sha256');
	const files = [...inputFiles].sort();

	for (const file of files) {
		hash.update(file);
		try {
			const content = await fs.readFile(file);
			hash.update(content);
		} catch (error) {
			if (error?.code === 'ENOENT') {
				continue;
			}

			throw error;
		}
	}

	return hash.digest('hex');
}

module.exports = {
	collectDocumentationInputs,
	computeSignature,
	documentationGeneratorInputs,
};
