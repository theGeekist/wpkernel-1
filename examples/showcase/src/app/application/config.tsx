import { __ } from "@wordpress/i18n";
import { type ResourceDataViewConfig } from "@wpkernel/ui/dataviews";
import { type Application, type ApplicationQuery } from "@/types/application";

export const applicationDataViewConfig: ResourceDataViewConfig<Application, ApplicationQuery> = {
	fields: [
		{
			id: 'id',
			label: __('ID', 'acme-jobs'),
			type: 'integer',
			enableSorting: true,
			enableHiding: true,
		},
		{
			id: 'date',
			label: __('Date', 'acme-jobs'),
			type: 'datetime',
			enableSorting: true,
			enableHiding: true,
		},
		{
			id: 'job_id',
			label: __('Job Id', 'acme-jobs'),
			type: 'integer',
			enableSorting: true,
			enableHiding: true,
		},
		{
			id: 'cv_attachment_id',
			label: __('Cv Attachment Id', 'acme-jobs'),
			type: 'integer',
			enableSorting: true,
			enableHiding: true,
		},
		{
			id: 'status',
			label: __('Status', 'acme-jobs'),
			type: 'text',
			enableSorting: true,
			enableHiding: true,
		},
	],
	defaultView: {
		type: 'table',
		fields: ['job_id', 'cv_attachment_id', 'status', 'date',
		],
	},
	mapQuery: (view): ApplicationQuery => {
		const query: ApplicationQuery = {};
		if (view.search) { query.search = view.search; }
		if (view.sort) {
			query.orderby = view.sort.field as keyof Application;
			query.order = view.sort.direction;
		}
		return query;
	},
};
