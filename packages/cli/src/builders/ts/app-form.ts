import path from 'path';
import { createHelper } from '../../runtime';
import type { BuilderApplyOptions } from '../../runtime/types';
import { resolveAdminPaths } from './admin-screen';
import { resolveAdminScreenComponentMetadata } from './admin-shared';
import type { CodeBlockWriter, SourceFile } from 'ts-morph';
import { buildTsMorphAccessor, type TsMorphAccessor } from './imports';
import type { ResourceDescriptor } from '../types';
import type { IRArtifactsPlan, IRResource, IRv1 } from '../../ir/publicTypes';
import { toPascalCase, toCamelCase } from '../../utils';

type AppFormDescriptor = ResourceDescriptor;

type WpPostStorage = NonNullable<IRResource['storage']> & {
	readonly mode: 'wp-post';
};

type PostMetaField = {
	readonly key: string;
	readonly descriptor: { readonly type?: string };
};

type PostTaxonomyField = {
	readonly key: string;
};

type PostFormFields = {
	readonly hasTitle: boolean;
	readonly hasContent: boolean;
	readonly hasExcerpt: boolean;
	readonly hasImplicitStatus: boolean;
	readonly meta: readonly PostMetaField[];
	readonly taxonomies: readonly PostTaxonomyField[];
};

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
							const storage = resource.storage;
							const fields = classifyPostFormFields(storage);

							if (fields.hasTitle) {
								writer.writeLine("title: '',");
							}
							if (fields.hasContent) {
								writer.writeLine("content: '',");
							}
							if (fields.hasExcerpt) {
								writer.writeLine("excerpt: '',");
							}
							if (fields.hasImplicitStatus) {
								writer.writeLine("status: 'publish',");
							}

							for (const field of fields.meta) {
								writer.writeLine(`${field.key}: undefined,`);
							}

							for (const field of fields.taxonomies) {
								writer.writeLine(`${field.key}: undefined,`);
							}
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
				const storage = resource.storage;
				const fields = classifyPostFormFields(storage);

				if (fields.hasTitle) {
					writer.writeLine(
						'if (input.title !== undefined) payload.title = input.title;'
					);
				}
				if (fields.hasContent) {
					writer.writeLine(
						'if (input.content !== undefined) payload.content = input.content;'
					);
				}
				if (fields.hasExcerpt) {
					writer.writeLine(
						'if (input.excerpt !== undefined) payload.excerpt = input.excerpt;'
					);
				}
				if (fields.hasImplicitStatus) {
					writer.writeLine(
						'if (input.status) payload.status = input.status;'
					);
				}

				for (const field of fields.meta) {
					writer.writeLine(
						`if (input.${field.key} !== undefined) meta.${field.key} = input.${field.key};`
					);
				}

				for (const field of fields.taxonomies) {
					writer.writeLine(
						`if (input.${field.key}) payload.${field.key} = [input.${field.key}];`
					);
				}
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

function addActionsBuilder(
	sourceFile: SourceFile,
	buildActionsName: string,
	entityType: string,
	resource: IRResource
): void {
	const canQuickEdit =
		hasItemRoute(resource, ['GET']) &&
		hasItemRoute(resource, ['POST', 'PUT', 'PATCH']);
	const canDelete = hasItemRoute(resource, ['DELETE']);

	sourceFile.addFunction({
		name: buildActionsName,
		isExported: true,
		parameters: [
			{
				name: 'controller',
				type:
					`ResourceDataViewController<${entityType}, Record<string, unknown>> | ` +
					`{ resource?: ResourceObject<${entityType}, Record<string, unknown>> }`,
			},
			{
				name: 'openQuickEdit',
				type: '(id: string | number) => void',
			},
		],
		returnType: `Array<ResourceDataViewActionConfig<${entityType}, unknown, unknown>>`,
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine('const { mutate } = controller.resource || {};');
			writer.writeLine('if (!mutate) return [];');
			writer.writeLine(
				`const actions: Array<ResourceDataViewActionConfig<${entityType}, unknown, unknown>> = [];`
			);

			if (canDelete) {
				writer.writeLine('if (mutate.remove) {');
				writer.indent(() => {
					writer.writeLine(
						'const deleteAction = defineAction<{ ids: Array<string | number> }, void>({'
					);
					writer.indent(() => {
						writer.writeLine("name: 'Delete',");
						writer.writeLine('handler: async (_ctx, { ids }) => {');
						writer.indent(() => {
							writer.writeLine('if (!ids?.length) return;');
							writer.writeLine(
								'await Promise.all(ids.map(id => mutate.remove(id).catch(() => undefined)));'
							);
						});
						writer.writeLine('},');
					});
					writer.writeLine('});');
					writer.writeLine(
						'actions.push({ id: "delete", label: "Delete", action: deleteAction, isDestructive: true, supportsBulk: true, getActionArgs: ({ selection }: any) => ({ ids: selection }) });'
					);
				});
				writer.writeLine('}');
			}

			if (canQuickEdit) {
				writer.writeLine('if (mutate.update) {');
				writer.indent(() => {
					writer.writeLine(
						'actions.push({ id: "quick-edit", label: "Quick Edit", action: defineAction<{id: string|number}, void>({ name: "Edit", handler: async (_c, {id}) => openQuickEdit(id), options: { scope: "tabLocal", bridged: false } }), getActionArgs: ({ selection }: any) => ({ id: selection[0] }) });'
					);
				});
				writer.writeLine('}');
			}

			writer.writeLine('return actions;');
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
				if (resource.storage?.mode !== 'wp-post') {
					return;
				}
				writePostFormInputFields(writer, resource.storage);
			});
			writer.write('}');
		},
	});
}

function writePostFormInputFields(
	writer: CodeBlockWriter,
	storage: WpPostStorage
): void {
	const fields = classifyPostFormFields(storage);
	if (fields.hasTitle) {
		writer.writeLine('title?: string;');
	}
	if (fields.hasContent) {
		writer.writeLine('content?: string;');
	}
	if (fields.hasExcerpt) {
		writer.writeLine('excerpt?: string;');
	}
	if (fields.hasImplicitStatus) {
		writer.writeLine('status?: string;');
	}
	writeMetaFields(writer, fields.meta);
	writeTaxonomyInputs(writer, fields.taxonomies);
}

function writeMetaFields(
	writer: CodeBlockWriter,
	fields: readonly PostMetaField[]
): void {
	for (const field of fields) {
		const metaType = mapMetaType(field.descriptor);
		writer.writeLine(`${field.key}?: ${metaType};`);
	}
}

function writeTaxonomyInputs(
	writer: CodeBlockWriter,
	fields: readonly PostTaxonomyField[]
): void {
	for (const field of fields) {
		writer.writeLine(`${field.key}?: number; // Single select for now`);
	}
}

function mapMetaType(desc: { type?: string }): 'number' | 'boolean' | 'string' {
	if (desc.type === 'number' || desc.type === 'integer') {
		return 'number';
	}
	if (desc.type === 'boolean') {
		return 'boolean';
	}
	return 'string';
}

/**
 * Assign each form key to one source. Identity and supported core post fields
 * are reserved; explicit metadata and taxonomy fields take precedence over
 * the implicit publish/draft status fallback.
 *
 * @param storage - WordPress post storage configuration to classify.
 * @returns Deduplicated form fields grouped by semantic source.
 */
function classifyPostFormFields(storage: WpPostStorage): PostFormFields {
	const hasTitle = storage.supports?.includes('title') ?? false;
	const hasContent = storage.supports?.includes('editor') ?? false;
	const hasExcerpt = storage.supports?.includes('excerpt') ?? false;
	const claimed = new Set<string>(['id']);
	if (hasTitle) {
		claimed.add('title');
	}
	if (hasContent) {
		claimed.add('content');
	}
	if (hasExcerpt) {
		claimed.add('excerpt');
	}

	const meta = collectPostMetaFields(storage, claimed);
	const taxonomies = collectPostTaxonomyFields(storage, claimed);
	const hasImplicitStatus = claimPostFormField(claimed, 'status');

	return {
		hasTitle,
		hasContent,
		hasExcerpt,
		hasImplicitStatus,
		meta,
		taxonomies,
	};
}

function collectPostMetaFields(
	storage: WpPostStorage,
	claimed: Set<string>
): PostMetaField[] {
	const meta: PostMetaField[] = [];
	for (const [key, descriptor] of Object.entries(storage.meta ?? {})) {
		if (!claimPostFormField(claimed, key)) {
			continue;
		}
		meta.push({ key, descriptor });
	}
	return meta;
}

function collectPostTaxonomyFields(
	storage: WpPostStorage,
	claimed: Set<string>
): PostTaxonomyField[] {
	const taxonomies: PostTaxonomyField[] = [];
	for (const [key, config] of Object.entries(storage.taxonomies ?? {})) {
		const taxonomy = (config as { taxonomy?: string }).taxonomy ?? key;
		if (!claimPostFormField(claimed, taxonomy)) {
			continue;
		}
		taxonomies.push({ key: taxonomy });
	}
	return taxonomies;
}

function claimPostFormField(claimed: Set<string>, key: string): boolean {
	if (claimed.has(key)) {
		return false;
	}
	claimed.add(key);
	return true;
}

type QuickFormParams = {
	sourceFile: SourceFile;
	quickFormName: string;
	pascalName: string;
	entityType: string;
	formInputType: string;
	resource: IRResource;
};

function writeQuickFormComponent({
	sourceFile,
	quickFormName,
	pascalName,
	entityType,
	formInputType,
	resource,
}: QuickFormParams): void {
	const fetchInfo = resolveFetchInfo(resource);

	sourceFile.addFunction({
		name: quickFormName,
		isExported: true,
		parameters: [{ name: 'props', type: `${pascalName}FormProps` }],
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine(
				'const { resource, runtime, editId, onClose, onRefresh } = props;'
			);
			writeTaxonomyHooks(writer, resource);
			writeStateHooks(writer);
			writeFieldsConfig(
				writer,
				resource,
				formInputType,
				entityType,
				pascalName
			);
			writeLoadEffect(writer, pascalName, entityType, fetchInfo);
			writeQuickFormReturn(writer);
		},
	});
}

function writeTaxonomyHooks(
	writer: CodeBlockWriter,
	resource: IRResource
): void {
	if (resource.storage?.mode !== 'wp-post') {
		return;
	}
	const fields = classifyPostFormFields(resource.storage);
	for (const field of fields.taxonomies) {
		const action = `${field.key.replace(/_/g, '-')}.list`;
		const hookName = `${toCamelCase(field.key)}Options`;
		writer.writeLine(
			`const ${hookName} = useTaxonomyOptions('${action}');`
		);
	}
}

function writeStateHooks(writer: CodeBlockWriter): void {
	writer.writeLine('const [isLoading, setIsLoading] = useState(false);');
	writer.writeLine(
		'const [error, setError] = useState<string | null>(null);'
	);
	writer.writeLine('const isEdit = editId !== null && editId !== undefined;');
}

function writeFieldsConfig(
	writer: CodeBlockWriter,
	resource: IRResource,
	formInputType: string,
	entityType: string,
	pascalName: string
): void {
	writer.writeLine('const fields = useMemo(() => [');
	writer.indent(() => {
		if (resource.storage?.mode !== 'wp-post') {
			return;
		}
		writeBaseFieldDefinitions(writer, resource.storage, formInputType);
	});
	writer.writeLine('], [');
	writeFieldDependencies(writer, resource);
	writer.writeLine(']);');
	writer.writeLine(
		"const { fields: formFields, form: formConfig } = useMemo(() => buildFormConfigFromFields(fields, { type: 'regular' }), [fields]);"
	);
	writer.writeLine('const form = formConfig as unknown as Form;');
	writer.writeLine(
		"const createAction = useMemo(() => buildMutationAction(resource.mutate, 'create'), [resource.mutate]);"
	);
	writer.writeLine(
		"const updateAction = useMemo(() => buildMutationAction(resource.mutate, 'update'), [resource.mutate]);"
	);
	writer.writeLine(
		`const { Form, submit, reset, setData, state } = useDataFormHelper<${entityType}, ${formInputType}, Record<string, unknown>>({`
	);
	writer.indent(() => {
		writer.writeLine(
			'resource, runtime, resourceName: resource.name, fields: formFields, form,'
		);
		writer.writeLine('action: isEdit ? updateAction : createAction,');
		writer.writeLine(
			`buildInput: (data) => ({ ...default${pascalName}Form, ...data, id: editId ?? undefined }),`
		);
		writer.writeLine('onSuccess: () => { onClose(); onRefresh(); },');
	});
	writer.writeLine('});');
	writer.writeLine(
		`useEffect(() => { setData({ ...default${pascalName}Form }); }, []);`
	);
}

function writeBaseFieldDefinitions(
	writer: CodeBlockWriter,
	storage: WpPostStorage,
	formInputType: string
): void {
	const fields = classifyPostFormFields(storage);
	if (fields.hasTitle) {
		writer.writeLine(
			`textField<${formInputType}>('title', { label: 'Title', form: { required: true } }),`
		);
	}
	if (fields.hasContent) {
		writer.writeLine(
			`textField<${formInputType}>('content', { label: 'Content', edit: 'text' }),`
		);
	}
	if (fields.hasExcerpt) {
		writer.writeLine(
			`textField<${formInputType}>('excerpt', { label: 'Excerpt', edit: 'text' }),`
		);
	}
	if (fields.hasImplicitStatus) {
		writer.writeLine(
			`statusField<${formInputType}>('status', [{ label: 'Publish', value: 'publish' }, { label: 'Draft', value: 'draft' }], { label: 'Status', form: { required: true } }),`
		);
	}
	addMetaFieldDefinitions(writer, fields.meta, formInputType);
	addTaxonomyFieldDefinitions(writer, fields.taxonomies, formInputType);
}

function addMetaFieldDefinitions(
	writer: CodeBlockWriter,
	fields: readonly PostMetaField[],
	formInputType: string
): void {
	for (const field of fields) {
		const label = toTitleCase(field.key);
		const isNumber =
			field.descriptor.type === 'number' ||
			field.descriptor.type === 'integer';
		const fieldWriter = isNumber ? 'numberField' : 'textField';
		const edit = isNumber ? 'integer' : 'text';
		writer.writeLine(
			`${fieldWriter}<${formInputType}>('${field.key}', { label: '${label}', edit: '${edit}' }),`
		);
	}
}

function addTaxonomyFieldDefinitions(
	writer: CodeBlockWriter,
	fields: readonly PostTaxonomyField[],
	formInputType: string
): void {
	for (const field of fields) {
		const label = toTitleCase(field.key);
		const hookName = `${toCamelCase(field.key)}Options`;
		writer.writeLine(
			`selectField<${formInputType}>('${field.key}', ${hookName}.options, { label: '${label}', edit: 'select' }),`
		);
	}
}

function writeFieldDependencies(
	writer: CodeBlockWriter,
	resource: IRResource
): void {
	if (resource.storage?.mode !== 'wp-post') {
		return;
	}
	const fields = classifyPostFormFields(resource.storage);
	for (const field of fields.taxonomies) {
		writer.writeLine(`${toCamelCase(field.key)}Options.options,`);
	}
}

type FetchInfo = {
	pathTemplate: string;
};

function hasItemRoute(
	resource: IRResource,
	methods: readonly string[]
): boolean {
	const identityParam = resource.identity?.param ?? 'id';
	const placeholders = [`:${identityParam}`, `{${identityParam}}`];
	return (resource.routes ?? []).some(
		(route) =>
			methods.includes(route.method.toUpperCase()) &&
			placeholders.some((placeholder) => route.path.includes(placeholder))
	);
}

function resolveFetchInfo(resource: IRResource): FetchInfo | undefined {
	const identityParam = resource.identity?.param ?? 'id';
	const placeholders = [`:${identityParam}`, `{${identityParam}}`];
	const getRoute = (resource.routes ?? []).find(
		(route) =>
			route.method.toUpperCase() === 'GET' &&
			placeholders.some((placeholder) => route.path.includes(placeholder))
	);
	if (!getRoute) {
		return undefined;
	}
	const pathTemplate = placeholders.reduce(
		(candidatePath, placeholder) =>
			candidatePath.replace(placeholder, '${editId}'),
		getRoute.path
	);

	return { pathTemplate };
}

function writeLoadEffect(
	writer: CodeBlockWriter,
	pascalName: string,
	entityType: string,
	fetchInfo: FetchInfo | undefined
): void {
	writer.writeLine('useEffect(() => {');
	writer.indent(() => {
		writer.writeLine('let aborted = false;');
		writer.writeLine('async function load() {');
		writer.indent(() => {
			writer.writeLine(
				`if (!isEdit || !editId) { setData({ ...default${pascalName}Form }); return; }`
			);
			if (!fetchInfo) {
				writer.writeLine(
					`setData({ ...default${pascalName}Form }); setError('Editing is not available for this resource.'); return;`
				);
				return;
			}
			writer.writeLine('try {');
			writer.indent(() => {
				writer.writeLine('setIsLoading(true); setError(null);');
				writer.writeLine(
					`const fetchPath = \`${fetchInfo.pathTemplate}\`;`
				);
				writer.writeLine(
					`const { data } = await wpkFetch({ path: fetchPath, method: 'GET' }) as { data: Partial<${entityType}> };`
				);
				writer.writeLine('if (aborted) return;');
				writer.writeLine('const response = data;');
				writer.writeLine(
					`setData({ ...default${pascalName}Form, ...response, id: editId ?? response?.id } as Partial<${entityType}>);`
				);
			});
			writer.writeLine(
				'} catch (err) { if (!aborted) setError("Unable to load details."); } ' +
					'finally { if (!aborted) setIsLoading(false); }'
			);
		});
		writer.writeLine('}');
		writer.writeLine('void load();');
		writer.writeLine('return () => { aborted = true; };');
	});
	writer.writeLine('}, [editId, isEdit, setData]);');
}

function writeQuickFormReturn(writer: CodeBlockWriter): void {
	writer.writeLine('return (');
	writer.indent(() => {
		writer.writeLine(
			'<Modal title={isEdit ? "Edit" : "Create"} onRequestClose={onClose}>'
		);
		writer.indent(() => {
			writer.writeLine('<div className="wpk-quickform">');
			writer.indent(() => {
				writer.writeLine('{isLoading && <Spinner />}');
				writer.writeLine(
					'{error && <Notice status="error">{error}</Notice>}'
				);
				writer.writeLine('{Form}');
				writer.writeLine(
					'<div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>'
				);
				writer.writeLine(
					'<Button variant="primary" onClick={() => void submit()} disabled={state.status === "running" || isLoading}>Save</Button>'
				);
				writer.writeLine(
					'<Button variant="secondary" onClick={onClose}>Cancel</Button>'
				);
				writer.writeLine('</div>');
			});
			writer.writeLine('</div>');
		});
		writer.writeLine('</Modal>');
	});
	writer.writeLine(');');
}

function toTitleCase(value: string): string {
	return value
		.split(/[-_:]/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(' ');
}
