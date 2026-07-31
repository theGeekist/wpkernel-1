import "@wpkernel/core";
import { useMemo, useState } from "react";
import { Button } from "@wordpress/components";
import { fetch as wpkFetch } from "@wpkernel/core/http";
import { getWPKernelReporter } from "@wpkernel/core/reporter";
import { addQueryArgs } from "@wordpress/url";
import { type ListResponse, type ResourceObject } from "@wpkernel/core/resource";
import { WPKernelError, WPK_NAMESPACE } from "@wpkernel/core/contracts";
import { type DataViewsRuntimeContext, type ResourceDataViewController, type ResourceDataViewConfig, ResourceDataView } from "@wpkernel/ui/dataviews";
import { useWPKernelUI, WPKernelScreen } from "@wpkernel/ui";
import { job } from "../../../../../.wpk/generate/src/app/job/resource";
import { adminScreenRuntime } from "../../../../../.wpk/generate/src/runtime/index";
import { JobQuickForm, buildJobActions, type JobEntity } from "./form";
import { jobDataViewConfig } from "./config";

export const jobListScreenRoute = "acme-jobs";

function JobListScreenList() {
	const runtime = useWPKernelUI();
	const reporter = getWPKernelReporter();
	const maybeRuntime = runtime as unknown as Partial<DataViewsRuntimeContext>;
	if (!maybeRuntime.dataviews) {
		throw new WPKernelError('DeveloperError', { message: 'DataViews runtime unavailable.' });
	}
	const dataViewsRuntime = maybeRuntime as DataViewsRuntimeContext;
	const controller = dataViewsRuntime.dataviews.controllers.get('job') as ResourceDataViewController<JobEntity, Record<string, unknown>> | undefined;
	const resource: ResourceObject<JobEntity, Record<string, unknown>> = (controller?.resource as ResourceObject<JobEntity, Record<string, unknown>>) ?? (job as unknown as ResourceObject<JobEntity, Record<string, unknown>>);

	const [isFormOpen, setFormOpen] = useState(false);
	const [editId, setEditId] = useState<string | number | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);

	const actions = useMemo(() =>
		buildJobActions(controller ?? { resource }, (id) => {
			setEditId(id);
			setFormOpen(true);
		}),
	[controller, resource]);

	const fetchList = async (query: Record<string, unknown>): Promise<ListResponse<JobEntity>> => {
		const apiQuery = { status: "any", ...query };
		const path = addQueryArgs('/acme/v1/jobs', apiQuery);
		try {
			const { data } = (await wpkFetch({
				path,
				method: 'GET',
				meta: { namespace: "acme-jobs", resourceName: "job" },
			})) as { data: { items?: unknown[]; total?: number } | undefined };
			reporter?.debug('[JobListScreenList] fetchList response:', JSON.stringify(data));
			const items = Array.isArray(data?.items) ? (data!.items as JobEntity[]) : [];
			const total = typeof data?.total === 'number' ? data!.total : items.length;
			return { items, total };
		} catch (error) {
			const code = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code ? String((error as { code?: unknown }).code) : '';
			if (code.includes('forbidden')) {
				return { items: [], total: 0 };
			}
			throw error;
		}
	};
	return (
		<div className="wrap">
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
				<h1 className="wp-heading-inline">Jobs</h1>
				<Button variant="primary" onClick={() => { setEditId(null); setFormOpen(true); }}>
					Create job
				</Button>
			</div>
			<hr className="wp-header-end" />

			<ResourceDataView
				resource={resource}
				config={{ ...jobDataViewConfig, actions } as unknown as ResourceDataViewConfig<JobEntity, Record<string, unknown>>}
				runtime={dataViewsRuntime}
				key={refreshKey}
				controller={controller ? ({ ...controller, config: { ...controller.config, actions } } as ResourceDataViewController<JobEntity, Record<string, unknown>>) : undefined}
				fetchList={fetchList}
			/>
			{isFormOpen && resource ? (
				<JobQuickForm
					resource={resource}
					runtime={dataViewsRuntime}
					onRefresh={() => setRefreshKey((value) => value + 1)}
					onClose={() => { setFormOpen(false); setEditId(null); }}
					editId={editId}
				/>
			) : null}
		</div>
	);
}

export const jobListScreenInteractivityFeature = "admin-screen";
export const jobListScreenInteractivityContext = "{\"feature\":\"admin-screen\",\"resource\":\"job\"}";

function normalizeJobListScreenInteractivitySegment(value: string, fallback: string): string {
	const cleaned = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '')
	return cleaned.length > 0 ? cleaned : fallback;
}

export function getJobListScreenInteractivityNamespace(): string {
	const resource = job as { storeKey?: string; name?: string };
	const storeKey = typeof resource.storeKey === 'string' ? resource.storeKey : '';
	const rawSegment = storeKey.split('/').pop() || '';
	const resourceName = typeof resource.name === 'string' && resource.name.length > 0 ? resource.name : "job";
	const resourceSegment = normalizeJobListScreenInteractivitySegment(rawSegment.length > 0 ? rawSegment : resourceName, 'resource');
	const featureSegment = normalizeJobListScreenInteractivitySegment(jobListScreenInteractivityFeature, 'feature');
	const runtimeNamespace = typeof WPK_NAMESPACE === "string" ? WPK_NAMESPACE : "";
	return `${runtimeNamespace}/${resourceSegment}/${featureSegment}`;
}

export function JobListScreen() {
	const runtime = adminScreenRuntime.getUIRuntime();
	if (!runtime) {
		return null;
	}

	return (
		<WPKernelScreen resource={job} feature="admin-screen" runtime={runtime}>
			<JobListScreenList />
		</WPKernelScreen>
	);
}
