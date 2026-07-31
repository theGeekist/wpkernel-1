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
import { application } from "../../../.wpk/generate/src/app/application/resource";
import { adminScreenRuntime } from "../../../.wpk/generate/src/runtime/index";
import { ApplicationQuickForm, buildApplicationActions, type ApplicationEntity } from "./form";
import { applicationDataViewConfig } from "./config";

export const applicationsAdminScreenRoute = "acme-applications";

function ApplicationsAdminScreenList() {
	const runtime = useWPKernelUI();
	const reporter = getWPKernelReporter();
	const maybeRuntime = runtime as unknown as Partial<DataViewsRuntimeContext>;
	if (!maybeRuntime.dataviews) {
		throw new WPKernelError('DeveloperError', { message: 'DataViews runtime unavailable.' });
	}
	const dataViewsRuntime = maybeRuntime as DataViewsRuntimeContext;
	const controller = dataViewsRuntime.dataviews.controllers.get('application') as ResourceDataViewController<ApplicationEntity, Record<string, unknown>> | undefined;
	const resource: ResourceObject<ApplicationEntity, Record<string, unknown>> = (controller?.resource as ResourceObject<ApplicationEntity, Record<string, unknown>>) ?? (application as unknown as ResourceObject<ApplicationEntity, Record<string, unknown>>);

	const [isFormOpen, setFormOpen] = useState(false);
	const [editId, setEditId] = useState<string | number | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);

	const actions = useMemo(() =>
		buildApplicationActions(controller ?? { resource }, (id) => {
			setEditId(id);
			setFormOpen(true);
		}),
	[controller, resource]);

	const fetchList = async (query: Record<string, unknown>): Promise<ListResponse<ApplicationEntity>> => {
		const apiQuery = { status: "any", ...query };
		const path = addQueryArgs('/acme/v1/applications', apiQuery);
		try {
			const { data } = (await wpkFetch({
				path,
				method: 'GET',
				meta: { namespace: "acme-jobs", resourceName: "application" },
			})) as { data: { items?: unknown[]; total?: number } | undefined };
			reporter?.debug('[ApplicationsAdminScreenList] fetchList response:', JSON.stringify(data));
			const items = Array.isArray(data?.items) ? (data!.items as ApplicationEntity[]) : [];
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
				<h1 className="wp-heading-inline">Applications</h1>
				<Button variant="primary" onClick={() => { setEditId(null); setFormOpen(true); }}>
					Create application
				</Button>
			</div>
			<hr className="wp-header-end" />

			<ResourceDataView
				resource={resource}
				config={{ ...applicationDataViewConfig, actions } as unknown as ResourceDataViewConfig<ApplicationEntity, Record<string, unknown>>}
				runtime={dataViewsRuntime}
				key={refreshKey}
				controller={controller ? ({ ...controller, config: { ...controller.config, actions } } as ResourceDataViewController<ApplicationEntity, Record<string, unknown>>) : undefined}
				fetchList={fetchList}
			/>
			{isFormOpen && resource ? (
				<ApplicationQuickForm
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

export const applicationsAdminScreenInteractivityFeature = "admin-screen";
export const applicationsAdminScreenInteractivityContext = "{\"feature\":\"admin-screen\",\"resource\":\"application\"}";

function normalizeApplicationsAdminScreenInteractivitySegment(value: string, fallback: string): string {
	const cleaned = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '')
	return cleaned.length > 0 ? cleaned : fallback;
}

export function getApplicationsAdminScreenInteractivityNamespace(): string {
	const resource = application as { storeKey?: string; name?: string };
	const storeKey = typeof resource.storeKey === 'string' ? resource.storeKey : '';
	const rawSegment = storeKey.split('/').pop() || '';
	const resourceName = typeof resource.name === 'string' && resource.name.length > 0 ? resource.name : "application";
	const resourceSegment = normalizeApplicationsAdminScreenInteractivitySegment(rawSegment.length > 0 ? rawSegment : resourceName, 'resource');
	const featureSegment = normalizeApplicationsAdminScreenInteractivitySegment(applicationsAdminScreenInteractivityFeature, 'feature');
	const runtimeNamespace = typeof WPK_NAMESPACE === "string" ? WPK_NAMESPACE : "";
	return `${runtimeNamespace}/${resourceSegment}/${featureSegment}`;
}

export function ApplicationsAdminScreen() {
	const runtime = adminScreenRuntime.getUIRuntime();
	if (!runtime) {
		return null;
	}

	return (
		<WPKernelScreen resource={application} feature="admin-screen" runtime={runtime}>
			<ApplicationsAdminScreenList />
		</WPKernelScreen>
	);
}
