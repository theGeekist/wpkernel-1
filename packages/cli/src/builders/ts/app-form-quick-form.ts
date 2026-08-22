import type { CodeBlockWriter, SourceFile } from 'ts-morph';
import type { IRResource } from '../../ir/publicTypes';
import {
	buildWpPostFormPolicy,
	type WpPostFormPolicy,
} from './wp-post-form-policy';
import { typeScriptStringLiteral } from './typescript-syntax';

export type QuickFormParams = {
	sourceFile: SourceFile;
	quickFormName: string;
	pascalName: string;
	entityType: string;
	formInputType: string;
	resource: IRResource;
};

export function addActionsBuilder(
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

export function writeQuickFormComponent({
	sourceFile,
	quickFormName,
	pascalName,
	entityType,
	formInputType,
	resource,
}: QuickFormParams): void {
	const fetchInfo = resolveFetchInfo(resource);
	const policy =
		resource.storage?.mode === 'wp-post'
			? buildWpPostFormPolicy(resource.storage, formInputType)
			: undefined;

	sourceFile.addFunction({
		name: quickFormName,
		isExported: true,
		parameters: [{ name: 'props', type: `${pascalName}FormProps` }],
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine(
				'const { resource, runtime, editId, onClose, onRefresh } = props;'
			);
			writeTaxonomyHooks(writer, policy);
			writeStateHooks(writer);
			writeFieldsConfig(
				writer,
				policy,
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
	policy: WpPostFormPolicy | undefined
): void {
	if (!policy) {
		return;
	}
	writeLines(writer, policy.taxonomyHookLines);
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
	policy: WpPostFormPolicy | undefined,
	formInputType: string,
	entityType: string,
	pascalName: string
): void {
	writer.writeLine('const fields = useMemo(() => [');
	writer.indent(() => {
		if (policy) {
			writeLines(writer, policy.fieldDefinitionLines);
		}
	});
	writer.writeLine('], [');
	if (policy) {
		writeLines(writer, policy.fieldDependencyLines);
	}
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
		typeScriptTemplateLiteralContent(getRoute.path)
	);
	return { pathTemplate };
}

function typeScriptTemplateLiteralContent(value: string): string {
	return typeScriptStringLiteral(value)
		.slice(1, -1)
		.replace(/`/gu, '\\`')
		.replace(/\$\{/gu, '\\${');
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
			if (fetchInfo) {
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
			} else {
				writer.writeLine(
					`setData({ ...default${pascalName}Form }); setError('Editing is not available for this resource.'); return;`
				);
			}
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

function writeLines(writer: CodeBlockWriter, lines: readonly string[]): void {
	for (const line of lines) {
		writer.writeLine(line);
	}
}
