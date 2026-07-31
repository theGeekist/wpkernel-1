import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildPhpPrettyPrinter } from '@wpkernel/php-json-ast/php-driver';
import { makeIr } from '@cli-tests/ir.test-support';
import { collectResourceInstructions } from '../plan.shims';
import { buildWorkspace } from '../../workspace';

function makeOptions(root: string) {
	const workspace = buildWorkspace(root);
	const ir = makeIr({
		namespace: 'Acme\\Jobs',
		resources: [
			{
				name: 'jobs',
				schemaKey: 'jobs',
				schemaProvenance: 'manual',
				routes: [],
				hash: {
					algo: 'sha256',
					inputs: ['resource'],
					value: 'jobs-hash',
				},
				warnings: [],
			},
		],
	});
	const plan = ir.artifacts.plan;

	const builderOptions = {
		input: {
			phase: 'generate' as const,
			options: {
				namespace: ir.meta.namespace,
				origin: ir.meta.origin,
				sourcePath: path.join(root, 'wpk.config.ts'),
			},
			ir,
		},
		context: {
			workspace,
			reporter: {
				info: jest.fn(),
				debug: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			},
			phase: 'generate' as const,
			generationState: { shims: [], resources: [] },
		},
		output: { actions: [], queueWrite: jest.fn() },
		reporter: {
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		},
	};

	return {
		options: builderOptions as unknown as Parameters<
			typeof collectResourceInstructions
		>[0]['options'],
		prettyPrinter: buildPhpPrettyPrinter({ workspace }),
		plan,
		phpGenerated: ir.layout.resolve('php.generated'),
	};
}

describe('plan.shims', () => {
	it('emits shim instructions with layout paths and require guard', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wpk-shims-'));
		const { options, prettyPrinter, plan, phpGenerated } =
			makeOptions(root);
		try {
			// Deliberately model a shim written by the legacy layout.
			/* eslint-disable @wpkernel/no-hardcoded-layout-paths */
			const existingShim =
				"<?php\nrequire_once __DIR__ . '/../../.generated/php/Rest/JobsController.php';\n";
			/* eslint-enable @wpkernel/no-hardcoded-layout-paths */
			await options.context.workspace.write(
				'inc/Rest/JobsController.php',
				existingShim,
				{ ensureDir: true }
			);

			const instructions = await collectResourceInstructions({
				options,
				prettyPrinter,
			});

			const [shim] = instructions;
			expect(shim).toMatchObject({
				file: 'inc/Rest/JobsController.php',
				base: path.posix.join(
					plan.planBaseDir,
					'inc/Rest/JobsController.php'
				),
				incoming: path.posix.join(
					plan.planIncomingDir,
					'inc/Rest/JobsController.php'
				),
			});
			if (!shim || shim.action !== 'write') {
				throw new Error(
					'Expected a controller shim write instruction.'
				);
			}
			const code = await options.context.workspace.readText(
				shim.incoming
			);
			const base = await options.context.workspace.readText(shim.base);
			expect(base).toBe(existingShim);
			expect(code).toContain(
				'class JobsController extends \\Acme\\Jobs\\Generated\\Rest\\JobsController'
			);
			expect(code).toContain(
				'class_exists(\\Acme\\Jobs\\Generated\\Rest\\JobsController::class)'
			);
			expect(code).toContain(
				`require_once(__DIR__ . '/../../${phpGenerated}/Rest/JobsController.php')`
			);
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});
});
