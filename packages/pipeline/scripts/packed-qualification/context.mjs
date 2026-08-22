import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..'
);
export const repositoryRoot = resolve(packageRoot, '..', '..');
export const sourceManifest = JSON.parse(
	readFileSync(join(packageRoot, 'package.json'), 'utf8')
);

export const typescriptModule = join(
	repositoryRoot,
	'node_modules',
	'typescript',
	'lib',
	'typescript.js'
);

export const typescriptBin = join(
	repositoryRoot,
	'node_modules',
	'typescript',
	'bin',
	'tsc'
);
