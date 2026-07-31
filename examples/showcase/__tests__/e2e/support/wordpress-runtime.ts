import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repositoryRoot = process.cwd();

export interface HttpProbe {
	body: string;
	contentType: string | null;
	status: number;
	url: string;
}

export interface WordPressReadiness {
	namespace: string;
	pluginStatus: string;
	rest: HttpProbe;
	root: HttpProbe;
	routes: string[];
}

interface CommandResult {
	exitCode: number;
	stderr: string;
	stdout: string;
}

const delay = (milliseconds: number) =>
	new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function request(url: string): Promise<HttpProbe> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5_000);

	try {
		const response = await fetch(url, {
			headers: { accept: 'application/json, text/html;q=0.9' },
			redirect: 'follow',
			signal: controller.signal,
		});
		const body = await response.text();

		return {
			body,
			contentType: response.headers.get('content-type'),
			status: response.status,
			url: response.url,
		};
	} finally {
		clearTimeout(timeout);
	}
}

async function waitForHttp(
	url: string,
	timeoutMilliseconds = 15_000
): Promise<HttpProbe> {
	const deadline = Date.now() + timeoutMilliseconds;
	let latest: HttpProbe | undefined;
	let latestError: unknown;

	do {
		try {
			latest = await request(url);
			if (latest.status >= 200 && latest.status < 300) {
				return latest;
			}
		} catch (error) {
			latestError = error;
		}

		await delay(500);
	} while (Date.now() < deadline);

	if (latest) {
		throw new Error(
			`Readiness probe ${url} returned HTTP ${latest.status}: ${latest.body.slice(0, 500)}`
		);
	}

	throw new Error(
		`Readiness probe ${url} did not respond: ${String(latestError)}`
	);
}

async function runWpEnv(arguments_: string[]): Promise<CommandResult> {
	try {
		const { stdout, stderr } = await execFileAsync(
			'pnpm',
			['exec', 'wp-env', ...arguments_],
			{
				cwd: repositoryRoot,
				maxBuffer: 2 * 1024 * 1024,
				timeout: 30_000,
			}
		);

		return { exitCode: 0, stderr, stdout };
	} catch (error) {
		const commandError = error as {
			code?: number;
			stderr?: string;
			stdout?: string;
		};

		return {
			exitCode:
				typeof commandError.code === 'number' ? commandError.code : 1,
			stderr: commandError.stderr ?? String(error),
			stdout: commandError.stdout ?? '',
		};
	}
}

export async function waitForWordPress(
	baseURL: string
): Promise<WordPressReadiness> {
	const root = await waitForHttp(new URL('/', baseURL).toString());
	const rest = await waitForHttp(new URL('/wp-json/', baseURL).toString());
	const plugin = await runWpEnv([
		'run',
		'tests-cli',
		'wp',
		'plugin',
		'is-active',
		'showcase',
	]);

	if (plugin.exitCode !== 0) {
		throw new Error(
			`The showcase plugin is not active.\n${plugin.stdout}\n${plugin.stderr}`
		);
	}

	let restIndex: { namespaces?: unknown; routes?: unknown };
	try {
		restIndex = JSON.parse(rest.body) as {
			namespaces?: unknown;
			routes?: unknown;
		};
	} catch (error) {
		throw new Error(`The REST index is not JSON: ${String(error)}`);
	}

	const namespaces = Array.isArray(restIndex.namespaces)
		? restIndex.namespaces.filter(
				(namespace): namespace is string =>
					typeof namespace === 'string'
			)
		: [];
	const routes =
		restIndex.routes && typeof restIndex.routes === 'object'
			? Object.keys(restIndex.routes)
			: [];

	if (!namespaces.includes('acme/v1')) {
		throw new Error(
			`The REST index does not expose the acme/v1 namespace. Found: ${namespaces.join(', ')}`
		);
	}

	if (!routes.includes('/acme/v1/jobs')) {
		throw new Error('The REST index does not expose /acme/v1/jobs.');
	}

	return {
		namespace: 'acme/v1',
		pluginStatus: 'active',
		rest,
		root,
		routes,
	};
}

export async function collectWordPressDiagnostics(): Promise<string> {
	const [plugins, debugLog, containerLogs] = await Promise.all([
		runWpEnv([
			'run',
			'tests-cli',
			'wp',
			'plugin',
			'list',
			'--fields=name,status,version',
			'--format=json',
		]),
		runWpEnv([
			'run',
			'tests-cli',
			'sh',
			'-lc',
			'test ! -f /var/www/html/wp-content/debug.log || tail -n 120 /var/www/html/wp-content/debug.log',
		]),
		runWpEnv(['logs', 'tests', '--watch=false']),
	]);

	return JSON.stringify(
		{
			containerLogs,
			debugLog,
			plugins,
		},
		null,
		2
	);
}
