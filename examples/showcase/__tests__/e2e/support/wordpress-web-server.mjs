import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const repositoryRoot = process.cwd();
const artifactDirectory = resolve(repositoryRoot, 'test-results', 'harness');
const startupLogPath = resolve(artifactDirectory, 'wordpress-startup.log');
const startupStatePath = resolve(artifactDirectory, 'wordpress-startup.json');
const readinessHost = '127.0.0.1';
const readinessPort = 8891;

mkdirSync(artifactDirectory, { recursive: true });
writeFileSync(startupLogPath, '', 'utf8');

function log(message) {
	const line = `[${new Date().toISOString()}] ${message}\n`;
	process.stdout.write(line);
	appendFileSync(startupLogPath, line, 'utf8');
}

function runCommand(label, arguments_, timeoutMilliseconds) {
	return new Promise((resolveCommand, rejectCommand) => {
		log(`${label}: pnpm ${arguments_.join(' ')}`);

		const child = spawn('pnpm', arguments_, {
			cwd: repositoryRoot,
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';
		let settled = false;

		const relay = (stream, chunk) => {
			const text = chunk.toString();
			stream.write(text);
			appendFileSync(startupLogPath, text, 'utf8');
			return text;
		};

		child.stdout.on('data', (chunk) => {
			stdout += relay(process.stdout, chunk);
		});
		child.stderr.on('data', (chunk) => {
			stderr += relay(process.stderr, chunk);
		});

		const timeout = setTimeout(() => {
			if (settled) {
				return;
			}
			settled = true;
			child.kill('SIGTERM');
			rejectCommand(
				new Error(`${label} timed out after ${timeoutMilliseconds}ms`)
			);
		}, timeoutMilliseconds);

		child.once('error', (error) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);
			rejectCommand(error);
		});
		child.once('exit', (code, signal) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);

			if (code === 0) {
				resolveCommand({ stderr, stdout });
				return;
			}

			rejectCommand(
				new Error(
					`${label} failed with code ${String(code)} and signal ${String(signal)}`
				)
			);
		});
	});
}

async function probe(url) {
	const response = await fetch(url, {
		headers: { accept: 'application/json, text/html;q=0.9' },
		redirect: 'follow',
		signal: AbortSignal.timeout(5_000),
	});

	return {
		body: (await response.text()).slice(0, 2_000),
		contentType: response.headers.get('content-type'),
		status: response.status,
		url: response.url,
	};
}

async function waitForRoot() {
	const deadline = Date.now() + 30_000;
	let latest;

	do {
		try {
			latest = await probe('http://localhost:8889/');
			if (latest.status >= 200 && latest.status < 300) {
				return latest;
			}
		} catch (error) {
			latest = { error: String(error) };
		}

		await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
	} while (Date.now() < deadline);

	throw new Error(
		`WordPress root did not become ready: ${JSON.stringify(latest)}`
	);
}

let server;

async function start() {
	const startedAt = new Date().toISOString();
	await runCommand('wp-env startup', ['exec', 'wp-env', 'start'], 240_000);
	const rootBeforeSeed = await waitForRoot();
	await runCommand('WordPress seed', ['wp:seed'], 180_000);

	const root = await waitForRoot();
	const plugin = await runCommand(
		'showcase activation check',
		[
			'exec',
			'wp-env',
			'run',
			'tests-cli',
			'wp',
			'plugin',
			'is-active',
			'showcase',
		],
		30_000
	);

	// Record product health without promoting it to harness readiness. The
	// Playwright fixture owns REST namespace assertions and their diagnostics.
	let rest;
	try {
		rest = await probe('http://localhost:8889/wp-json/');
	} catch (error) {
		rest = { error: String(error) };
	}

	const state = {
		pluginActive: true,
		pluginCommand: plugin.stdout.trim(),
		rest,
		root,
		rootBeforeSeed,
		seedComplete: true,
		startedAt,
		readyAt: new Date().toISOString(),
	};
	writeFileSync(startupStatePath, JSON.stringify(state, null, 2), 'utf8');

	server = createServer((request, response) => {
		if (request.url !== '/ready') {
			response.writeHead(404, { 'content-type': 'application/json' });
			response.end(JSON.stringify({ error: 'not_found' }));
			return;
		}

		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(JSON.stringify(state));
	});
	server.listen(readinessPort, readinessHost, () => {
		log(
			`Harness ready after seed completion at http://${readinessHost}:${readinessPort}/ready (REST status: ${'status' in rest ? rest.status : 'unavailable'})`
		);
	});
}

async function stopAfterStartupFailure(error) {
	log(`Harness startup failed: ${error.stack ?? String(error)}`);
	writeFileSync(
		startupStatePath,
		JSON.stringify(
			{
				error: error.stack ?? String(error),
				failedAt: new Date().toISOString(),
				seedComplete: false,
			},
			null,
			2
		),
		'utf8'
	);

	try {
		await runCommand(
			'wp-env cleanup after startup failure',
			['exec', 'wp-env', 'stop'],
			30_000
		);
	} catch (cleanupError) {
		log(
			`wp-env cleanup also failed: ${cleanupError.stack ?? String(cleanupError)}`
		);
	}
	process.exitCode = 1;
}

function closeServer(signal) {
	log(`Received ${signal}; closing readiness server.`);
	if (!server) {
		process.exit(0);
		return;
	}

	server.close(() => process.exit(0));
	setTimeout(() => process.exit(0), 5_000).unref();
}

process.once('SIGINT', () => closeServer('SIGINT'));
process.once('SIGTERM', () => closeServer('SIGTERM'));

start().catch(stopAfterStartupFailure);
