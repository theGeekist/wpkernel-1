import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Notice, Spinner } from "@wordpress/components";
import { fetch as wpkFetch } from "@wpkernel/core/http";
import { type ResourceObject } from "@wpkernel/core/resource";
import { WPKernelError } from "@wpkernel/core/contracts";
import { defineAction } from "@wpkernel/core/actions";
import { useDataFormHelper, textField, statusField, selectField, numberField, type ResourceDataViewActionConfig, type ResourceDataViewController, buildFormConfigFromFields, DataFormDebugPanel, type DataViewsRuntimeContext } from "@wpkernel/ui/dataviews";
import { useTaxonomyOptions } from "@wpkernel/ui";
import { addQueryArgs } from "@wordpress/url";
import { type Form } from "@wordpress/dataviews/wp";

type ApplicationFormInput = {
		id?: string | number;
		job_id?: number;
		cv_attachment_id?: number;
		status?: string;
	};
export type ApplicationEntity = ApplicationFormInput & { [key: string]: unknown; };

const defaultApplicationForm: ApplicationFormInput = {
		job_id: undefined,
		cv_attachment_id: undefined,
		status: undefined,
	};

export type ApplicationFormProps = {
		resource: ResourceObject<ApplicationEntity, Record<string, unknown>>;
		runtime: DataViewsRuntimeContext;
		editId: string | number | null;
		onClose: () => void;
		onRefresh: () => void;
	};

function buildApplicationPayload(input: ApplicationFormInput): Record<string, unknown> {
	const payload: Record<string, unknown> = {};
	const meta: Record<string, unknown> = {};
	if (input.job_id !== undefined) meta.job_id = input.job_id;
	if (input.cv_attachment_id !== undefined) meta.cv_attachment_id = input.cv_attachment_id;
	if (input.status !== undefined) meta.status = input.status;
	if (Object.keys(meta).length > 0) { payload.meta = meta; }
	return payload;
}

function buildMutationAction(mutate: ResourceObject<ApplicationEntity, Record<string, unknown>>['mutate'] | undefined, mode: 'create' | 'update') {
	return defineAction<ApplicationFormInput, ApplicationEntity>({
		name: mode === 'create' ? 'Create' : 'Update',
		handler: async (_ctx, input) => {
			if (!mutate) throw new WPKernelError('DeveloperError', { message: `${mode} mutation not available.` });
			if (mode === 'update' && !input.id) throw new WPKernelError('DeveloperError', { message: 'Missing id for update.' });
			const payload = buildApplicationPayload(input);
			return mode === 'create' ? mutate.create?.(payload as never) : mutate.update?.(input.id as string | number, payload as never);
		},
	});
}

export function ApplicationQuickForm(props: ApplicationFormProps) {
	const { resource, runtime, editId, onClose, onRefresh } = props;
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const isEdit = editId !== null && editId !== undefined;
	const fields = useMemo(() => [
		numberField<ApplicationFormInput>('job_id', { label: 'Job Id', edit: 'integer' }),
		numberField<ApplicationFormInput>('cv_attachment_id', { label: 'Cv Attachment Id', edit: 'integer' }),
		textField<ApplicationFormInput>('status', { label: 'Status', edit: 'text' }),
	], [
	]);
	const { fields: formFields, form: formConfig } = useMemo(() => buildFormConfigFromFields(fields, { type: 'regular' }), [fields]);
	const form = formConfig as unknown as Form;
	const createAction = useMemo(() => buildMutationAction(resource.mutate, 'create'), [resource.mutate]);
	const updateAction = useMemo(() => buildMutationAction(resource.mutate, 'update'), [resource.mutate]);
	const { Form, submit, reset, setData, state } = useDataFormHelper<ApplicationEntity, ApplicationFormInput, Record<string, unknown>>({
		resource, runtime, resourceName: resource.name, fields: formFields, form,
		action: isEdit ? updateAction : createAction,
		buildInput: (data) => ({ ...defaultApplicationForm, ...data, id: editId ?? undefined }),
		onSuccess: () => { onClose(); onRefresh(); },
	});
	useEffect(() => { setData({ ...defaultApplicationForm }); }, []);
	useEffect(() => {
		let aborted = false;
		async function load() {
			if (!isEdit || !editId) { setData({ ...defaultApplicationForm }); return; }
			try {
				setIsLoading(true); setError(null);
				const fetchPath = `//v1/${editId}`;
				const { data } = await wpkFetch({ path: fetchPath, method: 'GET' }) as { data: Partial<ApplicationEntity> };
				if (aborted) return;
				const response = data;
				setData({ ...defaultApplicationForm, ...response, id: editId ?? response?.id } as Partial<ApplicationEntity>);
			} catch (err) { if (!aborted) setError("Unable to load details."); } finally { if (!aborted) setIsLoading(false); }
		}
		void load();
		return () => { aborted = true; };
	}, [editId, isEdit, setData]);
	return (
		<Modal title={isEdit ? "Edit" : "Create"} onRequestClose={onClose}>
			<div className="wpk-quickform">
				{isLoading && <Spinner />}
				{error && <Notice status="error">{error}</Notice>}
				{Form}
				<div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
				<Button variant="primary" onClick={() => void submit()} disabled={state.status === "running" || isLoading}>Save</Button>
				<Button variant="secondary" onClick={onClose}>Cancel</Button>
				</div>
			</div>
		</Modal>
	);
}

export function buildApplicationActions(controller: ResourceDataViewController<ApplicationEntity, Record<string, unknown>> | { resource?: ResourceObject<ApplicationEntity, Record<string, unknown>> }, openQuickEdit: (id: string | number) => void): Array<ResourceDataViewActionConfig<ApplicationEntity, unknown, unknown>> {
	const { mutate } = controller.resource || {};
	if (!mutate) return [];
	const deleteAction = defineAction<{ ids: Array<string | number> }, void>({
		name: 'Delete',
		handler: async (_ctx, { ids }) => {
			if (!ids?.length) return;
			await Promise.all(ids.map(id => mutate.remove?.(id).catch(() => undefined)));
		},
	});
	return [
		{ id: "delete", label: "Delete", action: deleteAction, isDestructive: true, supportsBulk: true, getActionArgs: ({ selection }: any) => ({ ids: selection }) },
		{ id: "quick-edit", label: "Quick Edit", action: defineAction<{id: string|number}, void>({ name: "Edit", handler: async (_c, {id}) => openQuickEdit(id), options: { scope: "tabLocal", bridged: false } }), getActionArgs: ({ selection }: any) => ({ id: selection[0] }) },
	];
}
