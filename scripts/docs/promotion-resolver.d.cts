export type PublicApiResponse = {
	readonly bodyText: string;
	readonly headers?: Readonly<Record<string, string>>;
	readonly status: number | string;
	readonly url: string;
};

export function assertPromotionPullSource(
	repository: string,
	pull:
		| {
				readonly head?: {
					readonly repo?: { readonly full_name?: string };
					readonly ref?: string;
				};
		  }
		| undefined,
	paths: readonly string[]
): void;

export function promotionPullPaths(
	pull: { readonly changed_files: number },
	files: readonly {
		readonly filename: string;
		readonly previous_filename?: string;
	}[]
): string[];

export function parsePublicApiResponse(response: PublicApiResponse): unknown;

export function associatedPullPageState(
	page: readonly unknown[],
	pageNumber: number
): 'complete' | 'continue';

export function findPromotionSourceSha(
	upstreamSha: string,
	pullsPages: readonly unknown[]
): string;

export function resolvePromotion(input: {
	readonly pullsPages: readonly unknown[];
	readonly sourceCommit: unknown;
	readonly upstreamCommit: unknown;
	readonly upstreamSha: string;
}): { readonly sourceSha: string; readonly sourceTree: string };

export function selectAuthoringCI(input: {
	readonly sourceSha: string;
	readonly workflowRuns: unknown;
}): {
	readonly state: 'failure' | 'pending' | 'success';
	readonly runId: string;
	readonly runUrl: string;
};
