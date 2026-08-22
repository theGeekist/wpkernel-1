import type { IRResource } from '../../ir/publicTypes';
import { toCamelCase } from '../../utils';
import {
	typeScriptDataPropertyAssignment,
	typeScriptObjectPropertyName,
	typeScriptPropertyAccess,
	typeScriptPropertyName,
	typeScriptStringLiteral,
} from './typescript-syntax';

export type WpPostStorage = NonNullable<IRResource['storage']> & {
	readonly mode: 'wp-post';
};

type PostMetaField = {
	readonly key: string;
	readonly descriptor: { readonly type?: string };
};

type PostTaxonomyField = {
	readonly key: string;
	readonly taxonomy: string;
	readonly optionsBinding: string;
};

type PostFormFields = {
	readonly hasTitle: boolean;
	readonly hasContent: boolean;
	readonly hasExcerpt: boolean;
	readonly hasImplicitStatus: boolean;
	readonly meta: readonly PostMetaField[];
	readonly taxonomies: readonly PostTaxonomyField[];
};

export type WpPostFormPolicy = {
	readonly inputFieldLines: readonly string[];
	readonly defaultValueLines: readonly string[];
	readonly payloadLines: readonly string[];
	readonly taxonomyHookLines: readonly string[];
	readonly fieldDefinitionLines: readonly string[];
	readonly fieldDependencyLines: readonly string[];
};

/**
 * Derive every wp-post form snippet from storage metadata. The returned value
 * contains data only, so classification and rendering stay independent of
 * ts-morph and filesystem effects.
 *
 * @param storage       - WordPress post storage configuration.
 * @param formInputType - Generated TypeScript form input type name.
 */
export function buildWpPostFormPolicy(
	storage: WpPostStorage,
	formInputType: string
): WpPostFormPolicy {
	const fields = classifyPostFormFields(storage);
	return {
		inputFieldLines: renderInputFieldLines(fields),
		defaultValueLines: renderDefaultValueLines(fields),
		payloadLines: renderPayloadLines(fields),
		taxonomyHookLines: renderTaxonomyHookLines(fields),
		fieldDefinitionLines: renderFieldDefinitionLines(fields, formInputType),
		fieldDependencyLines: renderFieldDependencyLines(fields),
	};
}

function classifyPostFormFields(storage: WpPostStorage): PostFormFields {
	const hasTitle = storage.supports?.includes('title') ?? false;
	const hasContent = storage.supports?.includes('editor') ?? false;
	const hasExcerpt = storage.supports?.includes('excerpt') ?? false;
	const claimed = new Set<string>(['id']);
	if (hasTitle) {
		claimed.add('title');
	}
	if (hasContent) {
		claimed.add('content');
	}
	if (hasExcerpt) {
		claimed.add('excerpt');
	}

	const meta = collectPostMetaFields(storage, claimed);
	const taxonomies = collectPostTaxonomyFields(storage, claimed);
	const hasImplicitStatus = claimPostFormField(claimed, 'status');

	return {
		hasTitle,
		hasContent,
		hasExcerpt,
		hasImplicitStatus,
		meta,
		taxonomies,
	};
}

function collectPostMetaFields(
	storage: WpPostStorage,
	claimed: Set<string>
): PostMetaField[] {
	const meta: PostMetaField[] = [];
	for (const [key, descriptor] of Object.entries(storage.meta ?? {})) {
		if (claimPostFormField(claimed, key)) {
			meta.push({ key, descriptor });
		}
	}
	return meta;
}

function collectPostTaxonomyFields(
	storage: WpPostStorage,
	claimed: Set<string>
): PostTaxonomyField[] {
	const taxonomies: PostTaxonomyField[] = [];
	const claimedBindings = new Set<string>();
	for (const [key, config] of Object.entries(storage.taxonomies ?? {})) {
		if (!claimPostFormField(claimed, key)) {
			continue;
		}
		const taxonomy = (config as { taxonomy?: string }).taxonomy ?? key;
		taxonomies.push({
			key,
			taxonomy,
			optionsBinding: allocateTaxonomyOptionsBinding(
				key,
				claimedBindings
			),
		});
	}
	return taxonomies;
}

function allocateTaxonomyOptionsBinding(
	key: string,
	claimed: Set<string>
): string {
	const camelKey = toCamelCase(key).replace(/[^A-Za-z0-9_$]/gu, '');
	const safeKey = /^[A-Za-z_$]/u.test(camelKey)
		? camelKey
		: `taxonomy${camelKey}`;
	const base = `${safeKey}Options`;
	let binding = base;
	let suffix = 2;
	while (claimed.has(binding)) {
		binding = `${base}${suffix}`;
		suffix += 1;
	}
	claimed.add(binding);
	return binding;
}

function claimPostFormField(claimed: Set<string>, key: string): boolean {
	if (claimed.has(key)) {
		return false;
	}
	claimed.add(key);
	return true;
}

function renderInputFieldLines(fields: PostFormFields): string[] {
	const lines: string[] = [];
	if (fields.hasTitle) {
		lines.push('title?: string;');
	}
	if (fields.hasContent) {
		lines.push('content?: string;');
	}
	if (fields.hasExcerpt) {
		lines.push('excerpt?: string;');
	}
	if (fields.hasImplicitStatus) {
		lines.push('status?: string;');
	}
	for (const field of fields.meta) {
		lines.push(
			`${typeScriptPropertyName(field.key)}?: ${mapMetaType(field.descriptor)};`
		);
	}
	for (const field of fields.taxonomies) {
		lines.push(
			`${typeScriptPropertyName(field.key)}?: number; // Single select for now`
		);
	}
	return lines;
}

function renderDefaultValueLines(fields: PostFormFields): string[] {
	const lines: string[] = [];
	if (fields.hasTitle) {
		lines.push("title: '',");
	}
	if (fields.hasContent) {
		lines.push("content: '',");
	}
	if (fields.hasExcerpt) {
		lines.push("excerpt: '',");
	}
	if (fields.hasImplicitStatus) {
		lines.push("status: 'publish',");
	}
	for (const field of [...fields.meta, ...fields.taxonomies]) {
		lines.push(`${typeScriptObjectPropertyName(field.key)}: undefined,`);
	}
	return lines;
}

function renderPayloadLines(fields: PostFormFields): string[] {
	const lines: string[] = [];
	if (fields.hasTitle) {
		lines.push(
			'if (input.title !== undefined) payload.title = input.title;'
		);
	}
	if (fields.hasContent) {
		lines.push(
			'if (input.content !== undefined) payload.content = input.content;'
		);
	}
	if (fields.hasExcerpt) {
		lines.push(
			'if (input.excerpt !== undefined) payload.excerpt = input.excerpt;'
		);
	}
	if (fields.hasImplicitStatus) {
		lines.push('if (input.status) payload.status = input.status;');
	}
	for (const field of fields.meta) {
		const inputValue = typeScriptPropertyAccess('input', field.key);
		lines.push(
			`if (${inputValue} !== undefined) ${typeScriptDataPropertyAssignment('meta', field.key, inputValue)}`
		);
	}
	for (const field of fields.taxonomies) {
		const inputValue = typeScriptPropertyAccess('input', field.key);
		lines.push(
			`if (${inputValue}) ${typeScriptDataPropertyAssignment('payload', field.key, `[${inputValue}]`)}`
		);
	}
	return lines;
}

function renderTaxonomyHookLines(fields: PostFormFields): string[] {
	const lines: string[] = [];
	for (const field of fields.taxonomies) {
		const action = `${field.taxonomy.replace(/_/g, '-')}.list`;
		lines.push(
			`const ${field.optionsBinding} = useTaxonomyOptions(${typeScriptStringLiteral(action)});`
		);
	}
	return lines;
}

function renderFieldDefinitionLines(
	fields: PostFormFields,
	formInputType: string
): string[] {
	const lines: string[] = [];
	if (fields.hasTitle) {
		lines.push(
			`textField<${formInputType}>('title', { label: 'Title', form: { required: true } }),`
		);
	}
	if (fields.hasContent) {
		lines.push(
			`textField<${formInputType}>('content', { label: 'Content', edit: 'text' }),`
		);
	}
	if (fields.hasExcerpt) {
		lines.push(
			`textField<${formInputType}>('excerpt', { label: 'Excerpt', edit: 'text' }),`
		);
	}
	if (fields.hasImplicitStatus) {
		lines.push(
			`statusField<${formInputType}>('status', [{ label: 'Publish', value: 'publish' }, { label: 'Draft', value: 'draft' }], { label: 'Status', form: { required: true } }),`
		);
	}
	for (const field of fields.meta) {
		const isNumber =
			field.descriptor.type === 'number' ||
			field.descriptor.type === 'integer';
		const fieldWriter = isNumber ? 'numberField' : 'textField';
		const edit = isNumber ? 'integer' : 'text';
		lines.push(
			`${fieldWriter}<${formInputType}>(${typeScriptStringLiteral(field.key)}, { label: ${typeScriptStringLiteral(toTitleCase(field.key))}, edit: ${typeScriptStringLiteral(edit)} }),`
		);
	}
	for (const field of fields.taxonomies) {
		const label = toTitleCase(field.taxonomy.replace(/^(acme_|wpk_)/, ''));
		lines.push(
			`selectField<${formInputType}>(${typeScriptStringLiteral(field.key)}, ${field.optionsBinding}.options, { label: ${typeScriptStringLiteral(label)}, edit: 'select' }),`
		);
	}
	return lines;
}

function renderFieldDependencyLines(fields: PostFormFields): string[] {
	const lines: string[] = [];
	for (const field of fields.taxonomies) {
		lines.push(`${field.optionsBinding}.options,`);
	}
	return lines;
}

function mapMetaType(desc: {
	readonly type?: string;
}): 'number' | 'boolean' | 'string' {
	if (desc.type === 'number' || desc.type === 'integer') {
		return 'number';
	}
	if (desc.type === 'boolean') {
		return 'boolean';
	}
	return 'string';
}

function toTitleCase(value: string): string {
	return value
		.split(/[-_:]/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(' ');
}
