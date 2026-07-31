import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import {
	buildDeclare,
	buildDeclareItem,
	buildName,
	buildNamespace,
	buildPhpPrettyPrinter,
	buildReturn,
	buildScalarInt,
	buildScalarString,
	type PhpProgram,
	type PhpStmt,
} from '@wpkernel/php-json-ast';

const bootstrapModule = jest.requireActual('../../plugin/bootstrap') as {
	buildBootstrapFunction: (config: unknown) => PhpStmt;
	buildBootstrapInvocation: () => PhpStmt;
};
const restControllerModule = jest.requireActual(
	'../../rest-controller/module'
) as {
	buildRestControllerModule: (config: unknown) => {
		readonly files: ReadonlyArray<{
			readonly fileName: string;
			readonly program: PhpProgram;
		}>;
	};
};

const PACKAGE_ROOT = path.resolve(__dirname, '../../../../php-json-ast');

const workspace = {
	root: PACKAGE_ROOT,
	resolve: (...parts: string[]) => path.resolve(PACKAGE_ROOT, ...parts),
	exists: async (target: string) => {
		try {
			await access(target);
			return true;
		} catch {
			return false;
		}
	},
};

const prettyPrinter = buildPhpPrettyPrinter({ workspace });

function normalizeAst(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(normalizeAst);
	}

	if (value === null || typeof value !== 'object') {
		return value;
	}

	const normalized: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		if (key === 'attributes') {
			const attributes = child as Record<string, unknown> | undefined;
			if (attributes?.comments) {
				normalized.attributes = {
					comments: normalizeAst(attributes.comments),
				};
			}
			continue;
		}

		normalized[key] = normalizeAst(child);
	}

	return normalized;
}

async function captureContract(filePath: string, program: PhpProgram) {
	const result = await prettyPrinter.prettyPrint({ filePath, program });
	const lint = spawnSync('php', ['-l'], {
		input: result.code,
		encoding: 'utf8',
	});

	expect(lint.status).toBe(0);

	return {
		normalizedAst: normalizeAst(program),
		printedPhp: result.code,
	};
}

describe('current WordPress generation contracts', () => {
	it('preserves the plugin bootstrap AST and printed PHP', async () => {
		const bootstrapFunction = bootstrapModule.buildBootstrapFunction({
			origin: 'wpk.config.ts',
			namespace: 'Demo\\Plugin',
			sanitizedNamespace: 'demo-plugin',
			plugin: {
				name: 'Demo Plugin',
				description: 'Golden contract fixture.',
				version: '1.0.0',
				requiresAtLeast: '6.6',
				requiresPhp: '8.2',
				textDomain: 'demo-plugin',
				author: 'WP Kernel',
				license: 'GPL-2.0-or-later',
			},
			phpGeneratedPath: 'generated',
			resourceClassNames: ['Demo\\Plugin\\Rest\\BookController'],
			contentModel: {
				statuses: [],
				postTypes: [
					{
						slug: 'book',
						labels: { name: 'Books' },
					},
				],
				taxonomies: [],
			},
			ui: {
				handle: 'demo-plugin-admin',
				assetPath: 'assets',
				scriptPath: 'admin.js',
				localizationObject: 'demoPlugin',
				namespace: 'Demo\\Plugin',
				resources: [
					{
						resource: 'book',
						menu: {
							slug: 'demo-books',
							title: 'Books',
						},
					},
				],
			},
		});
		const program: PhpProgram = [
			buildDeclare([buildDeclareItem('strict_types', buildScalarInt(1))]),
			buildNamespace(buildName(['Demo', 'Plugin']), [
				bootstrapFunction,
				bootstrapModule.buildBootstrapInvocation(),
			]),
		];

		await expect(
			captureContract('plugin-bootstrap.php', program)
		).resolves.toMatchSnapshot();
	});

	it('preserves a representative REST registration AST and printed PHP', async () => {
		const controller = {
			className: 'BookController',
			resourceName: 'book',
			schemaKey: 'book',
			schemaProvenance: 'manual',
			restArgsExpression: buildScalarString('args'),
			identity: { type: 'string', param: 'slug' },
			routes: [
				{
					methodName: 'get_item',
					metadata: {
						method: 'GET',
						path: '/demo/v1/books/:slug',
						kind: 'get',
					},
					statements: [buildReturn(buildScalarString('ok'))],
				},
			],
			helperMethods: [],
			capabilityClass: 'Demo\\Plugin\\Capability\\Capability',
			fileName: 'Rest/BookController.php',
		};
		const module = restControllerModule.buildRestControllerModule({
			origin: 'wpk.config.ts',
			sanitizedNamespace: 'demo-plugin',
			namespace: 'Demo\\Plugin\\Rest',
			controllers: [controller],
			additionalIndexEntries: [
				{
					className: 'Demo\\Plugin\\Capability\\Capability',
					path: 'Capability/Capability.php',
				},
			],
		});
		const controllerFile = module.files.find(
			(file) => file.fileName === 'Rest/BookController.php'
		);

		if (!controllerFile) {
			throw new Error('Expected the representative controller file.');
		}

		await expect(
			captureContract(controllerFile.fileName, controllerFile.program)
		).resolves.toMatchSnapshot();
	});
});
