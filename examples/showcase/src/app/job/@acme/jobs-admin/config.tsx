import { __ } from "@wordpress/i18n";
import { type ResourceDataViewConfig } from "@wpkernel/ui/dataviews";
import { type Job, type JobQuery } from "@/types/job";

export const jobDataViewConfig: ResourceDataViewConfig<Job, JobQuery> = {
	fields: [
		{
			id: 'id',
			label: __('ID', 'acme-jobs'),
			type: 'integer',
			enableSorting: true,
			enableHiding: true,
		},
		{
			id: 'title',
			label: __('Title', 'acme-jobs'),
			type: 'text',
			enableSorting: true,
			enableHiding: false,
			getValue: ({ item }) => item.title || '',
		},
		{
			id: 'status',
			label: __('Status', 'acme-jobs'),
			type: 'text',
			enableSorting: true,
			enableHiding: false,
		},
		{
			id: 'date',
			label: __('Date', 'acme-jobs'),
			type: 'datetime',
			enableSorting: true,
			enableHiding: true,
		},
		{
			id: 'salary_min',
			label: __('Salary Min', 'acme-jobs'),
			type: 'integer',
			enableSorting: true,
			enableHiding: true,
		},
		{
			id: 'salary_max',
			label: __('Salary Max', 'acme-jobs'),
			type: 'integer',
			enableSorting: true,
			enableHiding: true,
		},
		{
			id: 'location',
			label: __('Location', 'acme-jobs'),
			type: 'text',
			enableSorting: true,
			enableHiding: true,
		},
		{
			id: 'external_url',
			label: __('External Url', 'acme-jobs'),
			type: 'text',
			enableSorting: true,
			enableHiding: true,
		},
		{
			id: 'acme_job_department',
			label: __('Job Department', 'acme-jobs'),
			type: 'text',
			enableSorting: false,
			enableHiding: true,
			getValue: ({ item }: { item: Record<string, unknown> }) => Array.isArray(item['acme_job_department']) ? item['acme_job_department'].join(', ') : '',
		},
		{
			id: 'acme_job_location',
			label: __('Job Location', 'acme-jobs'),
			type: 'text',
			enableSorting: false,
			enableHiding: true,
			getValue: ({ item }: { item: Record<string, unknown> }) => Array.isArray(item['acme_job_location']) ? item['acme_job_location'].join(', ') : '',
		},
	],
	defaultView: {
		type: 'table',
		fields: ['title', 'status', 'salary_min', 'salary_max', 'location', 'acme_job_department', 'acme_job_location', 'date',
		],
	},
	mapQuery: (view): JobQuery => {
		const query: JobQuery = {};
		if (view.search) { query.search = view.search; }
		if (view.sort) {
			query.orderby = view.sort.field as keyof Job;
			query.order = view.sort.direction;
		}
		return query;
	},
};
