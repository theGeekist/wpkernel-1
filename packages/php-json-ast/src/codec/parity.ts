export interface PhpJsonAstPropertySchema {
	readonly type: string;
}

export interface PhpJsonAstNodeSchema {
	readonly nodeType: string;
	readonly properties: Readonly<Record<string, PhpJsonAstPropertySchema>>;
}

export interface PhpJsonAstSchema {
	readonly source: string;
	readonly version: string;
	readonly nodes: Readonly<Record<string, PhpJsonAstNodeSchema>>;
}

export type PhpJsonAstSchemaParityIssueCode =
	| 'NODE_MISSING_IN_TYPESCRIPT'
	| 'NODE_MISSING_IN_PHP'
	| 'PROPERTY_MISSING_IN_TYPESCRIPT'
	| 'PROPERTY_MISSING_IN_PHP'
	| 'PROPERTY_TYPE_MISMATCH';

export interface PhpJsonAstSchemaParityIssue {
	readonly code: PhpJsonAstSchemaParityIssueCode;
	readonly nodeType: string;
	readonly property?: string;
	readonly typescriptType?: string;
	readonly phpType?: string;
}

export interface PhpJsonAstSchemaParityResult {
	readonly compatible: boolean;
	readonly issues: readonly PhpJsonAstSchemaParityIssue[];
}

/**
 * Compare canonical TypeScript and PhpParser schemas in both directions.
 *
 * @param typescriptSchema - Canonical schema derived from TypeScript contracts.
 * @param phpSchema        - Canonical schema derived from installed PhpParser assets.
 */
export function comparePhpJsonAstSchemas(
	typescriptSchema: PhpJsonAstSchema,
	phpSchema: PhpJsonAstSchema
): PhpJsonAstSchemaParityResult {
	const issues: PhpJsonAstSchemaParityIssue[] = [];
	const nodeTypes = sortedUnique([
		...Object.keys(typescriptSchema.nodes),
		...Object.keys(phpSchema.nodes),
	]);

	for (const nodeType of nodeTypes) {
		const typescriptNode = typescriptSchema.nodes[nodeType];
		const phpNode = phpSchema.nodes[nodeType];

		if (!typescriptNode) {
			issues.push({ code: 'NODE_MISSING_IN_TYPESCRIPT', nodeType });
			continue;
		}
		if (!phpNode) {
			issues.push({ code: 'NODE_MISSING_IN_PHP', nodeType });
			continue;
		}

		compareNodeProperties(typescriptNode, phpNode, issues);
	}

	return {
		compatible: issues.length === 0,
		issues,
	};
}

/**
 * Canonicalize a union-like schema type. Nested generic unions are preserved.
 *
 * @param type - Schema type expression.
 */
export function canonicalizePhpJsonAstSchemaType(type: string): string {
	const members = splitTopLevel(type, '|')
		.map((member) => canonicalizeTypeMember(member))
		.filter((member) => member.length > 0)
		.sort(compareStrings)
		.filter((member, index, entries) => member !== entries[index - 1]);

	return collapseCoveredNodeTypes(members).join('|');
}

function compareNodeProperties(
	typescriptNode: PhpJsonAstNodeSchema,
	phpNode: PhpJsonAstNodeSchema,
	issues: PhpJsonAstSchemaParityIssue[]
): void {
	const properties = sortedUnique([
		...Object.keys(typescriptNode.properties),
		...Object.keys(phpNode.properties),
	]);

	for (const property of properties) {
		const typescriptProperty = typescriptNode.properties[property];
		const phpProperty = phpNode.properties[property];

		if (!typescriptProperty) {
			issues.push({
				code: 'PROPERTY_MISSING_IN_TYPESCRIPT',
				nodeType: typescriptNode.nodeType,
				property,
			});
			continue;
		}
		if (!phpProperty) {
			issues.push({
				code: 'PROPERTY_MISSING_IN_PHP',
				nodeType: typescriptNode.nodeType,
				property,
			});
			continue;
		}

		const typescriptType = canonicalizePhpJsonAstSchemaType(
			typescriptProperty.type
		);
		const phpType = canonicalizePhpJsonAstSchemaType(phpProperty.type);
		if (typescriptType !== phpType) {
			issues.push({
				code: 'PROPERTY_TYPE_MISMATCH',
				nodeType: typescriptNode.nodeType,
				property,
				typescriptType,
				phpType,
			});
		}
	}
}

function canonicalizeTypeMember(member: string): string {
	const trimmed = member.trim();
	const genericStart = trimmed.indexOf('<');
	if (genericStart < 0 || !trimmed.endsWith('>')) {
		return trimmed;
	}

	const container = trimmed.slice(0, genericStart).trim();
	const inner = trimmed.slice(genericStart + 1, -1);
	return `${container}<${canonicalizePhpJsonAstSchemaType(inner)}>`;
}

function collapseCoveredNodeTypes(members: readonly string[]): string[] {
	const coveredPrefixes = [
		['node:Node', 'node:'],
		['node:Expr', 'node:Expr_'],
		['node:Stmt', 'node:Stmt_'],
		['node:Name', 'node:Name_'],
	] as const;
	const collapsed = [...members];

	for (const [family, prefix] of coveredPrefixes) {
		if (!collapsed.includes(family)) {
			continue;
		}
		for (let index = collapsed.length - 1; index >= 0; index -= 1) {
			const member = collapsed[index];
			if (member !== family && member?.startsWith(prefix)) {
				collapsed.splice(index, 1);
			}
		}
	}

	if (collapsed.includes('node:Type')) {
		return collapsed.filter(
			(member) => member !== 'node:Identifier' && member !== 'node:Name'
		);
	}
	return collapsed;
}

function splitTopLevel(value: string, separator: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;

	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (character === '<' || character === '(' || character === '[') {
			depth += 1;
		} else if (
			character === '>' ||
			character === ')' ||
			character === ']'
		) {
			depth -= 1;
		} else if (character === separator && depth === 0) {
			parts.push(value.slice(start, index));
			start = index + 1;
		}
	}

	parts.push(value.slice(start));
	return parts;
}

function sortedUnique(values: readonly string[]): string[] {
	return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
	if (left < right) {
		return -1;
	}
	if (left > right) {
		return 1;
	}
	return 0;
}
