import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = path.resolve('scripts/normalize-punctuation.js');
const fixtureRoots: string[] = [];

async function createFixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-punctuation-'));
	fixtureRoots.push(root);
	const source = path.join(root, 'packages', 'example', 'README.md');
	const generated = path.join(root, 'docs', 'api', 'generated.md');
	const nonMarkdown = path.join(root, 'notes.txt');

	await mkdir(path.dirname(source), { recursive: true });
	await mkdir(path.dirname(generated), { recursive: true });
	await writeFile(source, 'source =&gt; result\n', 'utf8');
	await writeFile(generated, 'generated =&gt; projection\n', 'utf8');
	await writeFile(nonMarkdown, 'plain =&gt; text\n', 'utf8');

	return { root, source, generated, nonMarkdown };
}

describe('normalize-punctuation', () => {
	afterEach(async () => {
		await Promise.all(
			fixtureRoots.splice(0).map((root) => rm(root, { recursive: true }))
		);
	});

	it('normalises only explicit Markdown files', async () => {
		const fixture = await createFixture();

		await execFileAsync(
			process.execPath,
			[
				script,
				fixture.source,
				fixture.source,
				fixture.nonMarkdown,
				path.join(fixture.root, 'missing.md'),
			],
			{ cwd: fixture.root }
		);

		await expect(readFile(fixture.source, 'utf8')).resolves.toBe(
			'source => result\n'
		);
		await expect(readFile(fixture.generated, 'utf8')).resolves.toBe(
			'generated =&gt; projection\n'
		);
		await expect(readFile(fixture.nonMarkdown, 'utf8')).resolves.toBe(
			'plain =&gt; text\n'
		);
	});

	it('retains repository-wide discovery when no paths are supplied', async () => {
		const fixture = await createFixture();

		await execFileAsync(process.execPath, [script], { cwd: fixture.root });

		await expect(readFile(fixture.source, 'utf8')).resolves.toBe(
			'source => result\n'
		);
		await expect(readFile(fixture.generated, 'utf8')).resolves.toBe(
			'generated => projection\n'
		);
		await expect(readFile(fixture.nonMarkdown, 'utf8')).resolves.toBe(
			'plain =&gt; text\n'
		);
	});
});
