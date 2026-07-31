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

type JobFormInput = {
		id?: string | number;
		title?: string;
		status?: string;
		salary_min?: number;
		salary_max?: number;
		location?: string;
		external_url?: string;
		acme_job_department?: number; // Single select for now
		acme_job_location?: number; // Single select for now
	};
export type JobEntity = JobFormInput & { [key: string]: unknown; };

const defaultJobForm: JobFormInput = {
		title: '',
		status: 'publish',
		salary_min: undefined,
		salary_max: undefined,
		location: undefined,
		external_url: undefined,
		acme_job_department: undefined,
		acme_job_location: undefined,
	};

export type JobFormProps = {
		resource: ResourceObject<JobEntity, Record<string, unknown>>;
		runtime: DataViewsRuntimeContext;
		editId: string | number | null;
		onClose: () => void;
		onRefresh: () => void;
	};

function buildJobPayload(input: JobFormInput): Record<string, unknown> {
	const payload: Record<string, unknown> = {};
	const meta: Record<string, unknown> = {};
	if (input.title) payload.title = input.title;
	if (input.status) payload.status = input.status;
	if (input.salary_min !== undefined) meta.salary_min = input.salary_min;
	if (input.salary_max !== undefined) meta.salary_max = input.salary_max;
	if (input.location !== undefined) meta.location = input.location;
	if (input.external_url !== undefined) meta.external_url = input.external_url;
	if (input.acme_job_department) payload.acme_job_department = [input.acme_job_department];
	if (input.acme_job_location) payload.acme_job_location = [input.acme_job_location];
	if (Object.keys(meta).length > 0) { payload.meta = meta; }
	return payload;
}

function buildMutationAction(mutate: ResourceObject<JobEntity, Record<string, unknown>>['mutate'] | undefined, mode: 'create' | 'update') {
	return defineAction<JobFormInput, JobEntity>({
		name: mode === 'create' ? 'Create' : 'Update',
		handler: async (_ctx, input) => {
			if (!mutate) throw new WPKernelError('DeveloperError', { message: `${mode} mutation not available.` });
			if (mode === 'update' && !input.id) throw new WPKernelError('DeveloperError', { message: 'Missing id for update.' });
			const payload = buildJobPayload(input);
			return mode === 'create' ? mutate.create?.(payload as never) : mutate.update?.(input.id as string | number, payload as never);
		},
	});
}

export function JobQuickForm(props: JobFormProps) {
	const { resource, runtime, editId, onClose, onRefresh } = props;
	const acmeJobDepartmentOptions = useTaxonomyOptions('acme-job-department.list');
	const acmeJobLocationOptions = useTaxonomyOptions('acme-job-location.list');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const isEdit = editId !== null && editId !== undefined;
	const fields = useMemo(() => [
		textField<JobFormInput>('title', { label: 'Title', form: { required: true } }),
		statusField<JobFormInput>('status', [{ label: 'Publish', value: 'publish' }, { label: 'Draft', value: 'draft' }], { label: 'Status', form: { required: true } }),
		numberField<JobFormInput>('salary_min', { label: 'Salary Min', edit: 'integer' }),
		numberField<JobFormInput>('salary_max', { label: 'Salary Max', edit: 'integer' }),
		textField<JobFormInput>('location', { label: 'Location', edit: 'text' }),
		textField<JobFormInput>('external_url', { label: 'External Url', edit: 'text' }),
		selectField<JobFormInput>('acme_job_department', acmeJobDepartmentOptions.options, { label: 'Acme Job Department', edit: 'select' }),
		selectField<JobFormInput>('acme_job_location', acmeJobLocationOptions.options, { label: 'Acme Job Location', edit: 'select' }),
	], [
	acmeJobDepartmentOptions.options,
	acmeJobLocationOptions.options,
	]);
	const { fields: formFields, form: formConfig } = useMemo(() => buildFormConfigFromFields(fields, { type: 'regular' }), [fields]);
	const form = formConfig as unknown as Form;
	const createAction = useMemo(() => buildMutationAction(resource.mutate, 'create'), [resource.mutate]);
	const updateAction = useMemo(() => buildMutationAction(resource.mutate, 'update'), [resource.mutate]);
	const { Form, submit, reset, setData, state } = useDataFormHelper<JobEntity, JobFormInput, Record<string, unknown>>({
		resource, runtime, resourceName: resource.name, fields: formFields, form,
		action: isEdit ? updateAction : createAction,
		buildInput: (data) => ({ ...defaultJobForm, ...data, id: editId ?? undefined }),
		onSuccess: () => { onClose(); onRefresh(); },
	});
	useEffect(() => { setData({ ...defaultJobForm }); }, []);
	useEffect(() => {
		let aborted = false;
		async function load() {
			if (!isEdit || !editId) { setData({ ...defaultJobForm }); return; }
			try {
				setIsLoading(true); setError(null);
				const fetchPath = `//v1/${editId}`;
				const { data } = await wpkFetch({ path: fetchPath, method: 'GET' }) as { data: Partial<JobEntity> };
				if (aborted) return;
				const response = data;
				setData({ ...defaultJobForm, ...response, id: editId ?? response?.id } as Partial<JobEntity>);
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

export function buildJobActions(controller: ResourceDataViewController<JobEntity, Record<string, unknown>> | { resource?: ResourceObject<JobEntity, Record<string, unknown>> }, openQuickEdit: (id: string | number) => void): Array<ResourceDataViewActionConfig<JobEntity, unknown, unknown>> {
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
