import path from 'path';
import { createHelper } from '../../runtime';
import type { BuilderApplyOptions } from '../../runtime/types';
import { resolveAdminPaths } from './admin-screen';
import { resolveAdminScreenComponentMetadata } from './admin-shared';
import type { CodeBlockWriter, SourceFile } from 'ts-morph';
import { buildTsMorphAccessor, type TsMorphAccessor } from './imports';
import type { ResourceDescriptor } from '../types';
import type { IRArtifactsPlan, IRResource, IRv1 } from '../../ir/publicTypes';
import { toPascalCase } from '../../utils';
import {
	addActionsBuilder,
	writeQuickFormComponent,
} from './app-form-quick-form';
import { buildWpPostFormPolicy } from './wp-post-form-policy';

type AppFormDescriptor = ResourceDescriptor;

function hasAppFormContext({
	input,
	reporter,
	irArtifacts,
}: {
	input: BuilderApplyOptions['input'];
	reporter: BuilderApplyOptions['reporter'];
	irArtifacts?: NonNullable<BuilderApplyOptions['input']['ir']>['artifacts'];
}): boolean {
	if (input.phase !== 'generate' || !input.ir) {
		reporter.debug('AppFormBuilder: skipping (non-generate phase)');
		return false;
	}

	if (!irArtifacts?.surfaces) {
		reporter.debug('AppFormBuilder: missing artifact plan');
		return false;
	}

	return true;
}

async function runAppFormBuilder(options: BuilderApplyOptions): Promise<void> {
	const { input, context, output, reporter } = options;

	const irWithArtifacts = input.ir as
		| (IRv1 & { artifacts?: IRArtifactsPlan })
		| null;
	const irArtifacts = irWithArtifacts?.artifacts;

	if (
		!hasAppFormContext({
			input,
			reporter,
			irArtifacts,
		})
	) {
		return;
	}

	const ir = input.ir!;
	const artifacts = irArtifacts!;
	const { createSourceFile, VariableDeclarationKind } =
		await buildTsMorphAccessor({ workspace: context.workspace });

	for (const resource of ir.resources) {
		const descriptor = resource as unknown as AppFormDescriptor;
		reporter.info(`AppFormBuilder: processing ${descriptor.name}`);

		const uiPlan = artifacts.surfaces[resource.id];
		if (!uiPlan) {
			reporter.debug(
				`AppFormBuilder: missing ui plan for ${descriptor.name}`
			);
			continue;
		}
		if (!uiPlan.generatedAppDir) {
			reporter.debug(
				`AppFormBuilder: missing ui dir for ${descriptor.name}`
			);
			continue;
		}

		const componentMeta = resolveAdminScreenComponentMetadata(descriptor);
		const { generatedScreenPath } = resolveAdminPaths(
			uiPlan,
			componentMeta
		);

		reporter.info(
			`AppFormBuilder: generatedScreenPath for ${descriptor.name} is ${generatedScreenPath}`
		);

		const formPath = path.join(
			path.dirname(generatedScreenPath),
			'form.tsx'
		);

		reporter.info(
			`AppFormBuilder: formPath for ${descriptor.name} is ${formPath}`
		);

		const sourceFile = createSourceFile(formPath);

		const pascalName = toPascalCase(descriptor.name);
		const formInputType = `${pascalName}FormInput`;
		const entityType = `${pascalName}Entity`;
		const quickFormName = `${pascalName}QuickForm`;
		const buildActionsName = `build${pascalName}Actions`;

		populateAppFormSourceFile({
			sourceFile,
			resource,
			pascalName,
			formInputType,
			entityType,
			quickFormName,
			buildActionsName,
			variableDeclarationKind: VariableDeclarationKind,
		});

		const fileText = sourceFile.getFullText();

		await context.workspace.write(formPath, fileText, {
			ensureDir: true,
		});

		output.queueWrite({
			file: formPath,
			contents: fileText,
		});
	}
}

export function createAppFormBuilder() {
	return createHelper({
		key: 'builder.generate.ts.appForm.core',
		kind: 'builder',
		// We depend on the IR being present so we can look up the matching resource.
		dependsOn: ['ir.resources.core', 'ir.ui.core', 'ir.artifacts.plan'],
		async apply(options: BuilderApplyOptions) {
			await runAppFormBuilder(options);
		},
	});
}

type PopulateAppFormParams = {
	sourceFile: SourceFile;
	resource: IRResource;
	pascalName: string;
	formInputType: string;
	entityType: string;
	quickFormName: string;
	buildActionsName: string;
	variableDeclarationKind: TsMorphAccessor['VariableDeclarationKind'];
};

function populateAppFormSourceFile({
	sourceFile,
	resource,
	pascalName,
	formInputType,
	entityType,
	quickFormName,
	buildActionsName,
	variableDeclarationKind,
}: PopulateAppFormParams): void {
	addAppFormImports(sourceFile);
	writeFormInputType(sourceFile, formInputType, resource);
	addEntityTypeAlias(sourceFile, entityType, formInputType);
	addDefaultForm(
		sourceFile,
		pascalName,
		formInputType,
		resource,
		variableDeclarationKind
	);
	addFormPropsType(sourceFile, pascalName, entityType);
	addPayloadBuilder(sourceFile, pascalName, formInputType, resource);
	addMutationActionBuilder(sourceFile, pascalName, formInputType, entityType);
	writeQuickFormComponent({
		sourceFile,
		quickFormName,
		pascalName,
		entityType,
		formInputType,
		resource,
	});
	addActionsBuilder(sourceFile, buildActionsName, entityType, resource);
}

function addAppFormImports(sourceFile: SourceFile): void {
	sourceFile.addImportDeclaration({
		moduleSpecifier: 'react',
		namedImports: ['useEffect', 'useMemo', 'useState'],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@wordpress/components',
		namedImports: ['Button', 'Modal', 'Notice', 'Spinner'],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@wpkernel/core/http',
		namedImports: [{ name: 'fetch', alias: 'wpkFetch' }],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@wpkernel/core/resource',
		namedImports: [{ name: 'ResourceObject', isTypeOnly: true }],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@wpkernel/core/contracts',
		namedImports: ['WPKernelError'],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@wpkernel/core/actions',
		namedImports: ['defineAction'],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@wpkernel/ui/dataviews',
		namedImports: [
			'useDataFormHelper',
			'textField',
			'statusField',
			'selectField',
			'numberField',
			{ name: 'ResourceDataViewActionConfig', isTypeOnly: true },
			{ name: 'ResourceDataViewController', isTypeOnly: true },
			'buildFormConfigFromFields',
			'DataFormDebugPanel',
			{ name: 'DataViewsRuntimeContext', isTypeOnly: true },
		],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@wpkernel/ui',
		namedImports: ['useTaxonomyOptions'],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@wordpress/url',
		namedImports: ['addQueryArgs'],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@wordpress/dataviews/wp',
		namedImports: [{ name: 'Form', isTypeOnly: true }],
	});
}

function addEntityTypeAlias(
	sourceFile: SourceFile,
	entityType: string,
	formInputType: string
): void {
	sourceFile.addTypeAlias({
		name: entityType,
		isExported: true,
		type: `${formInputType} & { [key: string]: unknown; }`,
	});
}

function addDefaultForm(
	sourceFile: SourceFile,
	pascalName: string,
	formInputType: string,
	resource: IRResource,
	variableDeclarationKind: TsMorphAccessor['VariableDeclarationKind']
): void {
	sourceFile.addVariableStatement({
		declarationKind: variableDeclarationKind.Const,
		declarations: [
			{
				name: `default${pascalName}Form`,
				type: formInputType,
				initializer: (writer: CodeBlockWriter) => {
					writer.writeLine('{');
					writer.indent(() => {
						if (resource.storage?.mode === 'wp-post') {
							writeLines(
								writer,
								buildWpPostFormPolicy(
									resource.storage,
									formInputType
								).defaultValueLines
							);
						}
					});
					writer.write('}');
				},
			},
		],
	});
}

function addFormPropsType(
	sourceFile: SourceFile,
	pascalName: string,
	entityType: string
): void {
	sourceFile.addTypeAlias({
		name: `${pascalName}FormProps`,
		isExported: true,
		type: (writer: CodeBlockWriter) => {
			writer.writeLine('{');
			writer.indent(() => {
				writer.writeLine(
					`resource: ResourceObject<${entityType}, Record<string, unknown>>;`
				);
				writer.writeLine('runtime: DataViewsRuntimeContext;');
				writer.writeLine('editId: string | number | null;');
				writer.writeLine('onClose: () => void;');
				writer.writeLine('onRefresh: () => void;');
			});
			writer.write('}');
		},
	});
}

function addPayloadBuilder(
	sourceFile: SourceFile,
	pascalName: string,
	formInputType: string,
	resource: IRResource
): void {
	sourceFile.addFunction({
		name: `build${pascalName}Payload`,
		parameters: [{ name: 'input', type: formInputType }],
		returnType: 'Record<string, unknown>',
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine('const payload: Record<string, unknown> = {};');
			writer.writeLine('const meta: Record<string, unknown> = {};');

			if (resource.storage?.mode === 'wp-post') {
				writeLines(
					writer,
					buildWpPostFormPolicy(resource.storage, formInputType)
						.payloadLines
				);
			}

			writer.writeLine(
				'if (Object.keys(meta).length > 0) { payload.meta = meta; }'
			);
			writer.writeLine('return payload;');
		},
	});
}

function addMutationActionBuilder(
	sourceFile: SourceFile,
	pascalName: string,
	formInputType: string,
	entityType: string
): void {
	sourceFile.addFunction({
		name: 'buildMutationAction',
		parameters: [
			{
				name: 'mutate',
				type: `ResourceObject<${entityType}, Record<string, unknown>>['mutate'] | undefined`,
			},
			{ name: 'mode', type: "'create' | 'update'" },
		],
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine(
				`return defineAction<${formInputType}, ${entityType}>({`
			);
			writer.indent(() => {
				writer.writeLine(
					"name: mode === 'create' ? 'Create' : 'Update',"
				);
				writer.writeLine('handler: async (_ctx, input) => {');
				writer.indent(() => {
					writer.writeLine(
						"if (!mutate) throw new WPKernelError('DeveloperError', { message: `${mode} mutation not available.` });"
					);
					writer.writeLine(
						"if (mode === 'create' && !mutate.create) throw new WPKernelError('DeveloperError', { message: 'create mutation not available.' });"
					);
					writer.writeLine(
						"if (mode === 'update' && !mutate.update) throw new WPKernelError('DeveloperError', { message: 'update mutation not available.' });"
					);
					writer.writeLine(
						"if (mode === 'update' && !input.id) throw new WPKernelError('DeveloperError', { message: 'Missing id for update.' });"
					);
					writer.writeLine(
						`const payload = build${pascalName}Payload(input);`
					);
					writer.writeLine(
						"return mode === 'create' ? mutate.create(payload as never) : mutate.update(input.id as string | number, payload as never);"
					);
				});
				writer.writeLine('},');
			});
			writer.writeLine('});');
		},
	});
}

function writeFormInputType(
	sourceFile: SourceFile,
	formInputType: string,
	resource: IRResource
): void {
	sourceFile.addTypeAlias({
		name: formInputType,
		isExported: false,
		type: (writer: CodeBlockWriter) => {
			writer.writeLine('{');
			writer.indent(() => {
				writer.writeLine('id?: string | number;');
				if (resource.storage?.mode === 'wp-post') {
					writeLines(
						writer,
						buildWpPostFormPolicy(resource.storage, formInputType)
							.inputFieldLines
					);
				}
			});
			writer.write('}');
		},
	});
}

function writeLines(writer: CodeBlockWriter, lines: readonly string[]): void {
	for (const line of lines) {
		writer.writeLine(line);
	}
}
