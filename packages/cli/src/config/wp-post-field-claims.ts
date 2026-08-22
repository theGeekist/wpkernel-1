import type { ResourceConfig } from '@wpkernel/core/resource';

const RESERVED_ENTITY_FIELDS = [
	'id',
	'title',
	'content',
	'excerpt',
	'status',
	'date',
	'date_gmt',
	'modified',
	'modified_gmt',
	'slug',
	'link',
	'author',
	'featured_media',
] as const;

const RESERVED_QUERY_FIELDS = [
	'page',
	'per_page',
	'search',
	'orderby',
	'order',
	'_fields',
] as const;

type WpPostClaimInput = Pick<ResourceConfig, 'identity' | 'routes' | 'storage'>;

type Claim = {
	readonly key: string;
	readonly claimant: string;
};

export type WpPostFieldClaimConflict = Claim & {
	readonly existing: string;
};

/**
 * Return the first conflicting authoritative field claim for a wp-post
 * resource. The result depends only on the supplied resource configuration.
 *
 * @param resource - Declarative resource fields that can claim wp-post keys.
 */
export function findWpPostFieldClaimConflict(
	resource: WpPostClaimInput
): WpPostFieldClaimConflict | undefined {
	if (resource.storage?.mode !== 'wp-post') {
		return undefined;
	}

	const claims = buildClaims(resource);
	const claimedBy = new Map<string, string>();
	for (const claim of claims) {
		const existing = claimedBy.get(claim.key);
		if (existing) {
			return { ...claim, existing };
		}
		claimedBy.set(claim.key, claim.claimant);
	}

	return undefined;
}

function buildClaims(resource: WpPostClaimInput): Claim[] {
	const storage = resource.storage;
	if (storage?.mode !== 'wp-post') {
		return [];
	}

	const claims: Claim[] = [];
	appendReservedClaims(
		claims,
		RESERVED_ENTITY_FIELDS,
		'the wp-post entity contract'
	);
	appendReservedClaims(
		claims,
		RESERVED_QUERY_FIELDS,
		'the wp-post query contract'
	);

	const identityParam = resolveIdentityParam(resource);
	if (identityParam && identityParam !== 'id' && identityParam !== 'slug') {
		claims.push({
			key: identityParam,
			claimant: 'the resource identity',
		});
	}

	appendRecordClaims(claims, storage.meta, 'storage.meta');
	appendRecordClaims(claims, storage.taxonomies, 'storage.taxonomies');
	return claims;
}

function appendReservedClaims(
	claims: Claim[],
	keys: readonly string[],
	claimant: string
): void {
	for (const key of keys) {
		claims.push({ key, claimant });
	}
}

function appendRecordClaims(
	claims: Claim[],
	record: Record<string, unknown> | undefined,
	claimant: string
): void {
	for (const key of Object.keys(record ?? {})) {
		claims.push({ key, claimant });
	}
}

function resolveIdentityParam(resource: WpPostClaimInput): string | undefined {
	if (resource.identity) {
		return resource.identity.param ?? 'id';
	}

	const placeholders = new Set<string>();
	for (const route of Object.values(resource.routes)) {
		if (!route) {
			continue;
		}
		for (const match of route.path.matchAll(/:([a-zA-Z0-9_]+)/gu)) {
			const placeholder = match[1]?.toLowerCase();
			if (placeholder) {
				placeholders.add(placeholder);
			}
		}
	}

	for (const candidate of ['id', 'slug', 'uuid']) {
		if (placeholders.has(candidate)) {
			return candidate;
		}
	}
	return undefined;
}
