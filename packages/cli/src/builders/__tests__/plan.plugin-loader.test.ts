import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {
	addPluginLoaderInstruction,
	emitPluginLoader,
} from '../plan.plugin-loader';
import type { PlanInstruction } from '../types';
import { makeIr } from '@cli-tests/ir.test-support';
import { buildPhpPrettyPrinter } from '@wpkernel/php-json-ast/php-driver';
import { buildEmptyGenerationState } from '../../apply/manifest';
import { createReporterMock } from '@cli-tests/reporter';
import { buildWorkspace } from '../../workspace';

function makeOptions(root: string, ir = makeIr()) {
	const workspace = buildWorkspace(root);
	const reporter = createReporterMock();
	return {
		reporter,
		context: {
			workspace,
			reporter,
			phase: 'generate' as const,
			generationState: buildEmptyGenerationState(),
		},
		input: {
			phase: 'generate' as const,
			options: {
				namespace: ir.meta.namespace,
				origin: ir.meta.origin,
				sourcePath: path.join(root, 'wpk.config.ts'),
			},
			ir,
		},
		output: { actions: [], queueWrite: jest.fn() },
	};
}

describe('plan.plugin-loader', () => {
	it('emits loader instruction using IR artifact paths', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wpk-loader-'));
		try {
			const ir = makeIr({
				namespace: 'Acme\\Jobs',
				resources: [
					{
						id: 'job',
						name: 'job',
						schemaKey: 'job',
						schemaProvenance: 'manual',
						routes: [],
						hash: {
							algo: 'sha256',
							inputs: ['resource'],
							value: 'job-hash',
						},
						warnings: [],
					},
				],
			});
			ir.php.outputDir = '.custom/generated-php';
			ir.artifacts.php.controllers = {
				job: {
					className: 'JobController',
					namespace: 'Acme\\Jobs\\Rest',
					appliedPath: 'inc/Rest/JobController.php',
					generatedPath:
						'.custom/generated-php/Rest/JobController.php',
				},
			};
			const { plan, php } = ir.artifacts;
			const options = makeOptions(root, ir);
			const prettyPrinter = buildPhpPrettyPrinter({
				workspace: options.context.workspace,
			});
			const instructions: PlanInstruction[] = [];
			await addPluginLoaderInstruction({
				options,
				prettyPrinter,
				instructions,
			});
			const [instr] = instructions;
			expect(instr).toMatchObject({
				file: php.pluginLoaderPath,
				base: path.posix.join(plan.planBaseDir, php.pluginLoaderPath),
				incoming: path.posix.join(
					plan.planIncomingDir,
					php.pluginLoaderPath
				),
			});
			if (!instr || instr.action !== 'write') {
				throw new Error('Expected a plugin loader write instruction.');
			}
			const code = await options.context.workspace.readText(
				instr.incoming
			);
			const loaderCode = code ?? '';
			expect(loaderCode).toContain(
				"plugin_dir_path(__FILE__) . '.custom/generated-php/index.php'"
			);
			expect(loaderCode).toContain(
				"require_once __DIR__ . '/inc/Rest/JobController.php';"
			);
			expect(loaderCode).toContain(
				'return [new \\Acme\\Jobs\\Rest\\JobController()]'
			);
			expect(loaderCode.indexOf('$classmapPath')).toBeLessThan(
				loaderCode.indexOf(
					"require_once __DIR__ . '/inc/Rest/JobController.php';"
				)
			);
			expect(
				loaderCode.indexOf(
					"require_once __DIR__ . '/inc/Rest/JobController.php';"
				)
			).toBeLessThan(
				loaderCode.indexOf(
					'return [new \\Acme\\Jobs\\Rest\\JobController()]'
				)
			);
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it('skips loader when plugin.php is user-owned', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wpk-loader-'));
		try {
			await fs.writeFile(
				path.join(root, 'plugin.php'),
				'<?php // custom'
			);
			const instr = await emitPluginLoader({
				options: makeOptions(root),
				prettyPrinter: buildPhpPrettyPrinter({
					workspace: buildWorkspace(root),
				}),
			});
			expect(instr).not.toBeNull();
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});
});
