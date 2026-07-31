import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import {
	canonicalizePhpJsonAstSchemaType,
	comparePhpJsonAstSchemas,
	type PhpJsonAstNodeSchema,
	type PhpJsonAstPropertySchema,
	type PhpJsonAstSchema,
} from '../parity';

const PACKAGE_ROOT = path.resolve(__dirname, '../../..');
const NODES_ROOT = path.resolve(PACKAGE_ROOT, 'src/nodes');
const PHP_SCHEMA_HELPER = path.resolve(__dirname, 'php-schema.php');
const PHP_VENDOR_AUTOLOAD = path.resolve(PACKAGE_ROOT, 'vendor/autoload.php');
const PHP_NODE_DIRECTORY = path.resolve(
	PACKAGE_ROOT,
	'vendor/nikic/php-parser/lib/PhpParser/Node'
);
const EXPECTED_PHP_PARSER_VERSION = 'v5.6.2';

type InterfaceMetadata = {
	readonly name: string;
	readonly extends: readonly string[];
	readonly nodeTypes: readonly string[];
	readonly ownProperties: ReadonlyMap<string, ts.TypeNode>;
};

type PhpSchemaPayload = {
	readonly phpParserVersion: string;
	readonly classToNodeType: Readonly<Record<string, string>>;
	readonly nodes: Readonly<
		Record<
			string,
			{
				readonly class: string;
				readonly properties: Readonly<
					Record<
						string,
						{
							readonly docType: string | null;
							readonly reflectionType: string | null;
						}
					>
				>;
			}
		>
	>;
};

const familyTypes = new Map<string, string>([
	['PhpNode', 'node:Node'],
	['PhpNodeLike', 'node:Node'],
	['PhpExpr', 'node:Expr'],
	['PhpExprCastScalar', 'node:Expr'],
	['PhpStmt', 'node:Stmt'],
	['PhpClassStmt', 'node:Stmt'],
	['PhpName', 'node:Name'],
	['PhpScalar', 'node:Scalar'],
	['PhpType', 'node:Type'],
]);

const ignoredCanonicalProperties = new Set(['namespacedName']);

const EXPECTED_CURRENT_TYPE_GAPS = [
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'Attribute',
		property: 'name',
		typescriptType: 'node:Identifier|node:Name',
		phpType: 'node:Name',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'Expr_FuncCall',
		property: 'args',
		typescriptType: 'array<node:Arg>',
		phpType: 'array<node:Arg|node:VariadicPlaceholder>',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'Expr_MethodCall',
		property: 'args',
		typescriptType: 'array<node:Arg>',
		phpType: 'array<node:Arg|node:VariadicPlaceholder>',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'Expr_New',
		property: 'args',
		typescriptType: 'array<node:Arg>',
		phpType: 'array<node:Arg|node:VariadicPlaceholder>',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'Expr_New',
		property: 'class',
		typescriptType: 'node:Expr|node:Name',
		phpType: 'node:Expr|node:Name|node:Stmt_Class',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'Expr_NullsafeMethodCall',
		property: 'args',
		typescriptType: 'array<node:Arg>',
		phpType: 'array<node:Arg|node:VariadicPlaceholder>',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'Expr_StaticCall',
		property: 'args',
		typescriptType: 'array<node:Arg>',
		phpType: 'array<node:Arg|node:VariadicPlaceholder>',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'IntersectionType',
		property: 'types',
		typescriptType: 'array<node:Type>',
		phpType: 'array<node:Identifier|node:Name>',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'NullableType',
		property: 'type',
		typescriptType: 'node:Type',
		phpType: 'node:Identifier|node:Name',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'Param',
		property: 'var',
		typescriptType: 'node:Expr',
		phpType: 'node:Expr_Error|node:Expr_Variable',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'Stmt_TraitUse',
		property: 'adaptations',
		typescriptType: 'array<node:Node>',
		phpType: 'array<node:TraitUseAdaptation>',
	},
	{
		code: 'PROPERTY_TYPE_MISMATCH',
		nodeType: 'UnionType',
		property: 'types',
		typescriptType: 'array<node:Type>',
		phpType: 'array<node:Identifier|node:IntersectionType|node:Name>',
	},
] as const;

describe('canonical PhpParser schema parity', () => {
	it('compares nodes, properties, and union types in both directions', () => {
		const typescriptSchema: PhpJsonAstSchema = {
			source: 'typescript',
			version: 'test',
			nodes: {
				Stmt_Return: {
					nodeType: 'Stmt_Return',
					properties: {
						expr: { type: 'null|node:Expr' },
						extra: { type: 'string' },
					},
				},
				Stmt_TypescriptOnly: {
					nodeType: 'Stmt_TypescriptOnly',
					properties: {},
				},
			},
		};
		const phpSchema: PhpJsonAstSchema = {
			source: 'php',
			version: 'test',
			nodes: {
				Stmt_Return: {
					nodeType: 'Stmt_Return',
					properties: {
						expr: { type: 'node:Expr|null' },
						missing: { type: 'number' },
					},
				},
				Stmt_PhpOnly: {
					nodeType: 'Stmt_PhpOnly',
					properties: {},
				},
			},
		};

		expect(comparePhpJsonAstSchemas(typescriptSchema, phpSchema)).toEqual({
			compatible: false,
			issues: [
				{
					code: 'NODE_MISSING_IN_TYPESCRIPT',
					nodeType: 'Stmt_PhpOnly',
				},
				{
					code: 'PROPERTY_MISSING_IN_PHP',
					nodeType: 'Stmt_Return',
					property: 'extra',
				},
				{
					code: 'PROPERTY_MISSING_IN_TYPESCRIPT',
					nodeType: 'Stmt_Return',
					property: 'missing',
				},
				{
					code: 'NODE_MISSING_IN_PHP',
					nodeType: 'Stmt_TypescriptOnly',
				},
			],
		});
	});

	it('detects type mismatches while treating union order as irrelevant', () => {
		expect(
			canonicalizePhpJsonAstSchemaType('array<node:Name|null>|boolean')
		).toBe('array<node:Name|null>|boolean');

		const result = comparePhpJsonAstSchemas(
			schemaWithProperty('string|node:Identifier'),
			schemaWithProperty('node:Identifier|number')
		);

		expect(result).toEqual({
			compatible: false,
			issues: [
				{
					code: 'PROPERTY_TYPE_MISMATCH',
					nodeType: 'Identifier',
					property: 'name',
					typescriptType: 'node:Identifier|string',
					phpType: 'node:Identifier|number',
				},
			],
		});
	});

	it('fails closed when a required Composer/schema asset is absent', () => {
		expect(() =>
			assertRequiredAssets({
				autoloadPath: path.resolve(
					PACKAGE_ROOT,
					'missing/autoload.php'
				),
				nodeDirectory: PHP_NODE_DIRECTORY,
				helperPath: PHP_SCHEMA_HELPER,
			})
		).toThrow(/Missing required Composer autoload asset/u);
	});

	it('reports the installed PhpParser parity baseline exactly', () => {
		assertRequiredAssets({
			autoloadPath: PHP_VENDOR_AUTOLOAD,
			nodeDirectory: PHP_NODE_DIRECTORY,
			helperPath: PHP_SCHEMA_HELPER,
		});

		const typescript = collectTypeScriptSchema();
		const phpPayload = fetchPhpSchema(Object.keys(typescript.nodes));
		expect(phpPayload.phpParserVersion).toBe(EXPECTED_PHP_PARSER_VERSION);

		const php = normalizePhpSchema(phpPayload);
		const parity = comparePhpJsonAstSchemas(typescript, php);

		expect(parity.issues).toEqual(EXPECTED_CURRENT_TYPE_GAPS);
		expect(parity.compatible).toBe(false);
	});
});

function schemaWithProperty(type: string): PhpJsonAstSchema {
	return {
		source: 'test',
		version: 'test',
		nodes: {
			Identifier: {
				nodeType: 'Identifier',
				properties: { name: { type } },
			},
		},
	};
}

function assertRequiredAssets(options: {
	readonly autoloadPath: string;
	readonly nodeDirectory: string;
	readonly helperPath: string;
}): void {
	if (!fs.existsSync(options.autoloadPath)) {
		throw new Error(
			`Missing required Composer autoload asset: ${options.autoloadPath}`
		);
	}
	if (
		!fs
			.statSync(options.nodeDirectory, { throwIfNoEntry: false })
			?.isDirectory()
	) {
		throw new Error(
			`Missing required PhpParser schema directory: ${options.nodeDirectory}`
		);
	}
	if (!fs.existsSync(options.helperPath)) {
		throw new Error(
			`Missing required parity helper: ${options.helperPath}`
		);
	}
}

function collectTypeScriptSchema(): PhpJsonAstSchema {
	const interfaces = collectInterfaceMetadata();
	const nodes: Record<string, PhpJsonAstNodeSchema> = {};

	for (const metadata of interfaces.values()) {
		const nodeTypes = metadata.nodeTypes
			.map(canonicalNodeType)
			.filter((nodeType) => !nodeType.startsWith('Comment'));
		if (nodeTypes.length === 0) {
			continue;
		}

		const properties = collectInterfaceProperties(
			metadata,
			interfaces,
			new Set()
		);
		const normalizedProperties: Record<string, PhpJsonAstPropertySchema> =
			{};
		for (const [property, typeNode] of properties) {
			if (ignoredCanonicalProperties.has(property)) {
				continue;
			}
			normalizedProperties[property] = {
				type: normalizeTypeScriptType(typeNode, interfaces),
			};
		}

		for (const nodeType of nodeTypes) {
			nodes[nodeType] = {
				nodeType,
				properties: normalizedProperties,
			};
		}
	}

	return {
		source: 'typescript',
		version: ts.version,
		nodes: sortRecord(nodes),
	};
}

function collectInterfaceMetadata(): Map<string, InterfaceMetadata> {
	const interfaces = new Map<string, InterfaceMetadata>();

	for (const filePath of collectTypeScriptFiles(NODES_ROOT)) {
		const source = ts.createSourceFile(
			filePath,
			fs.readFileSync(filePath, 'utf8'),
			ts.ScriptTarget.ESNext,
			true
		);

		source.forEachChild((node) => {
			if (!ts.isInterfaceDeclaration(node)) {
				return;
			}

			const properties = new Map<string, ts.TypeNode>();
			let nodeTypes: string[] = [];
			for (const member of node.members) {
				if (!ts.isPropertySignature(member) || !member.type) {
					continue;
				}
				const property = getPropertyName(member.name, source);
				if (property === 'nodeType') {
					nodeTypes = extractStringLiterals(member.type);
				} else if (property !== 'attributes') {
					properties.set(property, member.type);
				}
			}

			interfaces.set(node.name.text, {
				name: node.name.text,
				extends: extractExtendsNames(node),
				nodeTypes,
				ownProperties: properties,
			});
		});
	}

	return interfaces;
}

function collectInterfaceProperties(
	metadata: InterfaceMetadata,
	interfaces: ReadonlyMap<string, InterfaceMetadata>,
	seen: Set<string>
): Map<string, ts.TypeNode> {
	if (seen.has(metadata.name)) {
		return new Map();
	}
	seen.add(metadata.name);

	const properties = new Map<string, ts.TypeNode>();
	for (const parentName of metadata.extends) {
		const parent = interfaces.get(parentName);
		if (!parent) {
			continue;
		}
		for (const [name, type] of collectInterfaceProperties(
			parent,
			interfaces,
			seen
		)) {
			properties.set(name, type);
		}
	}
	for (const [name, type] of metadata.ownProperties) {
		properties.set(name, type);
	}

	return properties;
}

function normalizeTypeScriptType(
	node: ts.TypeNode,
	interfaces: ReadonlyMap<string, InterfaceMetadata>
): string {
	if (ts.isUnionTypeNode(node)) {
		return canonicalizePhpJsonAstSchemaType(
			node.types
				.map((member) => normalizeTypeScriptType(member, interfaces))
				.join('|')
		);
	}
	if (ts.isArrayTypeNode(node)) {
		return `array<${normalizeTypeScriptType(node.elementType, interfaces)}>`;
	}
	if (ts.isParenthesizedTypeNode(node)) {
		return normalizeTypeScriptType(node.type, interfaces);
	}
	if (ts.isTypeReferenceNode(node)) {
		return normalizeTypeScriptReference(node, interfaces);
	}

	switch (node.kind) {
		case ts.SyntaxKind.StringKeyword:
			return 'string';
		case ts.SyntaxKind.NumberKeyword:
			return 'number';
		case ts.SyntaxKind.BooleanKeyword:
			return 'boolean';
		case ts.SyntaxKind.NullKeyword:
			return 'null';
		case ts.SyntaxKind.UndefinedKeyword:
			return 'undefined';
		case ts.SyntaxKind.AnyKeyword:
		case ts.SyntaxKind.UnknownKeyword:
			return 'unknown';
		default:
			return normalizeLiteralType(node);
	}
}

function normalizeTypeScriptReference(
	node: ts.TypeReferenceNode,
	interfaces: ReadonlyMap<string, InterfaceMetadata>
): string {
	const typeName = node.typeName.getText();
	if (
		(typeName === 'Array' || typeName === 'ReadonlyArray') &&
		node.typeArguments?.[0]
	) {
		return `array<${normalizeTypeScriptType(node.typeArguments[0], interfaces)}>`;
	}

	const family = familyTypes.get(typeName);
	if (family) {
		return family;
	}

	const referenced = interfaces.get(typeName);
	const nodeTypes = referenced
		? [...new Set(referenced.nodeTypes.map(canonicalNodeType))]
		: [];
	return nodeTypes.length > 0
		? canonicalizePhpJsonAstSchemaType(
				nodeTypes.map((nodeType) => `node:${nodeType}`).join('|')
			)
		: 'unknown';
}

function normalizeLiteralType(node: ts.TypeNode): string {
	if (!ts.isLiteralTypeNode(node)) {
		return 'unknown';
	}
	if (node.literal.kind === ts.SyntaxKind.NullKeyword) {
		return 'null';
	}
	if (ts.isStringLiteral(node.literal)) {
		return 'string';
	}
	if (ts.isNumericLiteral(node.literal)) {
		return 'number';
	}
	if (
		node.literal.kind === ts.SyntaxKind.TrueKeyword ||
		node.literal.kind === ts.SyntaxKind.FalseKeyword
	) {
		return 'boolean';
	}
	return 'unknown';
}

function normalizePhpSchema(payload: PhpSchemaPayload): PhpJsonAstSchema {
	const nodes: Record<string, PhpJsonAstNodeSchema> = {};

	for (const [rawNodeType, rawNode] of Object.entries(payload.nodes)) {
		const nodeType = canonicalNodeType(rawNodeType);
		const properties: Record<string, PhpJsonAstPropertySchema> = {};
		for (const [rawProperty, rawSchema] of Object.entries(
			rawNode.properties
		)) {
			const property =
				isNameNode(nodeType) && rawProperty === 'name'
					? 'parts'
					: rawProperty;
			const rawType = rawSchema.docType ?? rawSchema.reflectionType;
			if (!rawType) {
				throw new Error(
					`Missing type metadata for ${nodeType}.${property} (${rawNode.class}).`
				);
			}
			properties[property] = {
				type:
					isNameNode(nodeType) && rawProperty === 'name'
						? 'array<string>'
						: normalizePhpType(rawType, payload.classToNodeType),
			};
		}

		nodes[nodeType] = {
			nodeType,
			properties: sortRecord(properties),
		};
	}

	return {
		source: 'nikic/php-parser',
		version: payload.phpParserVersion,
		nodes: sortRecord(nodes),
	};
}

function normalizePhpType(
	rawType: string,
	classToNodeType: Readonly<Record<string, string>>
): string {
	const trimmed = stripOuterParentheses(rawType.trim());
	if (trimmed.startsWith('?')) {
		return canonicalizePhpJsonAstSchemaType(
			`${normalizePhpType(trimmed.slice(1), classToNodeType)}|null`
		);
	}

	const union = splitTopLevel(trimmed, '|');
	if (union.length > 1) {
		return canonicalizePhpJsonAstSchemaType(
			union
				.map((member) => normalizePhpType(member, classToNodeType))
				.join('|')
		);
	}

	if (trimmed.endsWith('[]')) {
		return `array<${normalizePhpType(trimmed.slice(0, -2), classToNodeType)}>`;
	}

	const generic = /^(?:array|list)<(.+)>$/u.exec(trimmed);
	if (generic?.[1]) {
		const parameters = splitTopLevel(generic[1], ',');
		const element = parameters.at(-1);
		return `array<${
			element ? normalizePhpType(element, classToNodeType) : 'unknown'
		}>`;
	}

	const primitive = normalizePhpPrimitive(trimmed);
	if (primitive) {
		return primitive;
	}
	if (trimmed.includes('::')) {
		return 'number';
	}

	return normalizePhpNodeReference(trimmed, classToNodeType);
}

function normalizePhpPrimitive(type: string): string | null {
	if (
		type === 'string' ||
		type === 'non-empty-string' ||
		type === 'class-string'
	) {
		return 'string';
	}
	if (type === 'int' || type === 'positive-int' || type === 'float') {
		return 'number';
	}
	if (type === 'bool' || type === 'true' || type === 'false') {
		return 'boolean';
	}
	if (type === 'null') {
		return 'null';
	}
	if (type === 'array' || type === 'list') {
		return 'array<unknown>';
	}
	if (type === 'mixed' || type === 'object') {
		return 'unknown';
	}
	return null;
}

function normalizePhpNodeReference(
	type: string,
	classToNodeType: Readonly<Record<string, string>>
): string {
	const normalized = type.replace(/^\\/u, '');
	const family = normalizePhpNodeFamily(normalized);
	if (family) {
		return family;
	}

	const candidates = [
		normalized,
		normalized.startsWith('Node\\')
			? `PhpParser\\${normalized}`
			: `PhpParser\\Node\\${normalized}`,
	];
	for (const candidate of candidates) {
		const nodeType = classToNodeType[candidate];
		if (nodeType) {
			return `node:${canonicalNodeType(nodeType)}`;
		}
	}

	const suffix = `\\${normalized}`;
	const suffixMatches = Object.entries(classToNodeType).filter(
		([className]) => className.endsWith(suffix)
	);
	if (suffixMatches.length === 1 && suffixMatches[0]?.[1]) {
		return `node:${canonicalNodeType(suffixMatches[0][1])}`;
	}

	return `node:${normalized.split('\\').at(-1) ?? normalized}`;
}

function stripOuterParentheses(value: string): string {
	let normalized = value;
	while (
		normalized.startsWith('(') &&
		normalized.endsWith(')') &&
		isSingleOuterGroup(normalized)
	) {
		normalized = normalized.slice(1, -1).trim();
	}
	return normalized;
}

function isSingleOuterGroup(value: string): boolean {
	let depth = 0;
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (character === '(') {
			depth += 1;
		} else if (character === ')') {
			depth -= 1;
			if (depth === 0 && index < value.length - 1) {
				return false;
			}
		}
	}
	return depth === 0;
}

function normalizePhpNodeFamily(type: string): string | null {
	const normalized = type.replace(/^PhpParser\\/u, '');
	switch (normalized) {
		case 'Node':
			return 'node:Node';
		case 'Node\\Expr':
		case 'Expr':
			return 'node:Expr';
		case 'Node\\Stmt':
		case 'Stmt':
			return 'node:Stmt';
		case 'Node\\Name':
		case 'Name':
			return 'node:Name';
		case 'Node\\Scalar':
		case 'Scalar':
			return 'node:Scalar';
		case 'Node\\ComplexType':
		case 'ComplexType':
			return 'node:Type';
		default:
			return null;
	}
}

function fetchPhpSchema(nodeTypes: readonly string[]): PhpSchemaPayload {
	const result = spawnSync('php', [PHP_SCHEMA_HELPER], {
		input: JSON.stringify(nodeTypes),
		encoding: 'utf8',
	});
	if (result.error || result.status !== 0) {
		throw new Error(
			[
				'Failed to extract PhpParser schema.',
				`status=${result.status ?? 'unknown'}`,
				result.error ? `error=${result.error.message}` : '',
				result.stderr ? `stderr=${result.stderr.trim()}` : '',
			]
				.filter(Boolean)
				.join(' ')
		);
	}
	if (!result.stdout.trim()) {
		throw new Error('PhpParser schema helper returned no output.');
	}

	const payload = JSON.parse(result.stdout) as unknown;
	if (!isPhpSchemaPayload(payload)) {
		throw new Error(
			'PhpParser schema helper returned a malformed payload.'
		);
	}
	return payload;
}

function isPhpSchemaPayload(value: unknown): value is PhpSchemaPayload {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}
	const candidate = value as Partial<PhpSchemaPayload>;
	return (
		typeof candidate.phpParserVersion === 'string' &&
		isRecord(candidate.classToNodeType) &&
		isRecord(candidate.nodes)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractStringLiterals(node: ts.TypeNode): string[] {
	if (ts.isUnionTypeNode(node)) {
		return node.types.flatMap(extractStringLiterals);
	}
	if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) {
		return [node.literal.text];
	}
	return [];
}

function extractExtendsNames(node: ts.InterfaceDeclaration): string[] {
	const names: string[] = [];
	for (const clause of node.heritageClauses ?? []) {
		if (clause.token !== ts.SyntaxKind.ExtendsKeyword) {
			continue;
		}
		for (const type of clause.types) {
			names.push(type.expression.getText());
		}
	}
	return names;
}

function getPropertyName(name: ts.PropertyName, source: ts.SourceFile): string {
	if (
		ts.isIdentifier(name) ||
		ts.isStringLiteral(name) ||
		ts.isNumericLiteral(name)
	) {
		return name.text;
	}
	return name.getText(source);
}

function collectTypeScriptFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const resolved = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectTypeScriptFiles(resolved));
		} else if (entry.isFile() && resolved.endsWith('.ts')) {
			files.push(resolved);
		}
	}
	return files.sort(compareStrings);
}

function canonicalNodeType(nodeType: string): string {
	if (nodeType === 'Expr_ClosureUse' || nodeType === 'VarLikeIdentifier') {
		return nodeType === 'Expr_ClosureUse' ? 'ClosureUse' : 'Identifier';
	}
	return nodeType;
}

function isNameNode(nodeType: string): boolean {
	return (
		nodeType === 'Name' ||
		nodeType === 'Name_FullyQualified' ||
		nodeType === 'Name_Relative'
	);
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
			parts.push(value.slice(start, index).trim());
			start = index + 1;
		}
	}
	parts.push(value.slice(start).trim());
	return parts;
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
	return Object.fromEntries(
		Object.entries(record).sort(([left], [right]) =>
			compareStrings(left, right)
		)
	);
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
