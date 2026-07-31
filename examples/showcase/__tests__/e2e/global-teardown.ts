import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export default async function globalTeardown(): Promise<void> {
	if ((process.env.TEST_ENV ?? 'wp-env') !== 'wp-env') {
		return;
	}

	await execFileAsync('pnpm', ['exec', 'wp-env', 'stop'], {
		cwd: process.cwd(),
		maxBuffer: 2 * 1024 * 1024,
		timeout: 30_000,
	});
}
