import '@wordpress/dataviews/build-style/style.css';
import '@wordpress/components/build-style/style.css';
import '@wpkernel/core';
import { renderToString } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import { capabilities } from '../runtime/index';
import { configureWPKernel } from '@wpkernel/core/data';
import { WPKernelUIProvider, attachUIBindings } from '@wpkernel/ui';
import { adminScreenRuntime } from '../runtime/index';
import { application } from '../app/application/resource';
import { job } from '../app/job/resource';
import { ApplicationsAdminScreen, applicationsAdminScreenRoute } from '../../../../src/app/application/ApplicationsAdminScreen';
import { JobListScreen, jobListScreenRoute } from '../../../../src/app/job/@acme/jobs-admin/JobListScreen';

type WPKInstance = ReturnType<typeof configureWPKernel>;

interface KernelGlobal {
  __WP_KERNEL_ACTION_RUNTIME__?: { capability?: typeof capabilities; };
  getWPData?: () => unknown;
}

const adminScreens = {
  [applicationsAdminScreenRoute]: ApplicationsAdminScreen,
  [jobListScreenRoute]: JobListScreen,
} as const;

type AdminScreenName = keyof typeof adminScreens;

function mountAdminScreen() {
  const container = document.getElementById('wpkernel-admin-screen');
  if (!container) return;

  const dataset = container.dataset ?? {};
  const screenKey = (container.getAttribute('data-wpkernel-page') ?? dataset.wpkernelPage ?? '') as AdminScreenName;
  const capabilitiesJson = dataset.wpkernelCapabilities ?? '';
  const rawCapabilities = capabilitiesJson.length > 0 ? capabilitiesJson : undefined;
  const capability = rawCapabilities ? JSON.parse(rawCapabilities) : capabilities;
  const Component = adminScreens[screenKey];
  if (!Component) return;

  const bindingTarget = container.querySelector(`[data-wp-interactive='wpkernel/admin-screen']`);
  if (!bindingTarget) return;

  const bootstrap = async () => {
    const dataStore = (globalThis as KernelGlobal).__WP_KERNEL_ACTION_RUNTIME__ ?? configureWPKernel({ capability });
    const page = renderToString(<Component adminStore={dataStore} />);
    bindingTarget.innerHTML = `<div data-wp-interactive='wpkernel/admin-screen' data-wp-context='{"wpkernel/admin-screen": {}}'>${page}</div>`;
    await attachUIBindings(bindingTarget, { wpkernel: dataStore }, {});
  };

  if (typeof domReady === "function") {
    domReady(bootstrap);
  } else {
    bootstrap();
  }
}

export function renderRoot() {
  if (typeof document === 'undefined') return;
  mountAdminScreen();
}

const globalAny = globalThis as unknown as KernelGlobal;
globalAny.__WP_KERNEL_ACTION_RUNTIME__ ??= configureWPKernel({ capability: capabilities });
globalAny.__WP_KERNEL_ACTION_RUNTIME__.capability = capabilities;
renderRoot();
