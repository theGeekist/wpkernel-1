import { defineCapability } from "@wpkernel/core/capability";
import type { CapabilityHelpers } from "@wpkernel/core/capability";

export type CapabilityConfig = {
        'application.create': void;
        'application.get': unknown;
        'application.list': void;
        'application.update': unknown;
        'job.create': void;
        'job.get': void;
        'job.list': void;
        'job.remove': unknown;
        'job.update': unknown;
        'jobCategory.get': void;
        'jobCategory.list': void;
        'settings.get': void;
        'settings.update': void;
        'statusCache.get': void;
        'statusCache.update': void;
    };
export type CapabilityKey = keyof CapabilityConfig;
export type CapabilityRuntime = CapabilityHelpers<CapabilityConfig>;

export const capabilities = defineCapability<CapabilityConfig>({
        map: {
            'application.create': (ctx) => {
                // PHP enforces 'read' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'application.get': (ctx, uuid) => {
                // PHP enforces 'read_application' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'application.list': (ctx) => {
                // PHP enforces 'list_applications' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'application.update': (ctx, uuid) => {
                // PHP enforces 'edit_application' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'job.create': (ctx) => {
                // PHP enforces 'edit_posts' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'job.get': (ctx) => {
                // PHP enforces 'read' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'job.list': (ctx) => {
                // PHP enforces 'read' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'job.remove': (ctx, id) => {
                // PHP enforces 'delete_posts' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'job.update': (ctx, id) => {
                // PHP enforces 'edit_posts' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'jobCategory.get': (ctx) => {
                // PHP enforces 'manage_categories' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'jobCategory.list': (ctx) => {
                // PHP enforces 'manage_categories' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'settings.get': (ctx) => {
                // PHP enforces 'manage_options' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'settings.update': (ctx) => {
                // PHP enforces 'manage_options' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'statusCache.get': (ctx) => {
                // PHP enforces 'manage_options' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
            'statusCache.update': (ctx) => {
                // PHP enforces 'manage_options' via REST controller
                // Frontend matches server behavior via wp.data
                return true; // Optimistic - server will enforce
            },
        },
    });

import type { WPKernelUIRuntime } from '@wpkernel/core/data';

let runtime: WPKernelUIRuntime | undefined;

export const adminScreenRuntime = {
	setUIRuntime(next: WPKernelUIRuntime) {
		runtime = next;
	},
	getUIRuntime() {
		return runtime;
	},
};
