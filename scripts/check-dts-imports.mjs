#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import {
	findDeclarationImportOffenders,
	normaliseDeclarationImports,
} from './declaration-imports.mjs';

const mode = process.argv.includes('--fix') ? 'fix' : 'check';
const stripMaps = process.argv.includes('--strip-maps');
const distGlobs = [
	'packages/*/dist/**/*.d.ts',
	'packages/*/dist/**/*.d.mts',
	'packages/*/dist/**/*.d.cts',
];
const offenders = [];

function readSource(file) {
	return fs.readFile(file, 'utf8');
}

async function processFile(file, declarationFiles) {
	const contents = await readSource(file);
	const result = normaliseDeclarationImports(
		contents,
		file,
		declarationFiles
	);
	if (mode === 'fix' && result.changed) {
		await fs.writeFile(file, result.text, 'utf8');
		await fs.rm(`${file}.map`, { force: true });
	}

	if (mode === 'check') {
		const fileOffenders = findDeclarationImportOffenders(
			contents,
			file,
			declarationFiles
		);
		if (fileOffenders.length > 0) {
			offenders.push({ file, entries: fileOffenders });
		}
	}
}

async function main() {
	const files = await glob(distGlobs, { posix: true });
	for (const file of files) {
		await processFile(file, files);
	}

	if (mode === 'fix' && stripMaps) {
		const mapGlobs = distGlobs.map((pattern) => `${pattern}.map`);
		const maps = await glob(mapGlobs, { posix: true });
		await Promise.all(maps.map((file) => fs.rm(file, { force: true })));
	}

	if (mode === 'check' && offenders.length > 0) {
		console.error(
			`Found declaration imports that are not publishable under NodeNext:\n` +
				offenders
					.map(({ file, entries }) =>
						entries
							.map(
								({ reason, specifier, line, column }) =>
									` - ${path.posix.normalize(file)}:${line}:${column} ${reason}: ${specifier}`
							)
							.join('\n')
					)
					.join('\n')
		);
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
