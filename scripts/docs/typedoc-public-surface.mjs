import {
	ArrayType,
	Converter,
	IntrinsicType,
	ReferenceType,
	ReflectionKind,
	TypeOperatorType,
} from 'typedoc';

const pipelineProjectName = '@wpkernel/pipeline';
const createOptionsParameters = [
	'TInputs',
	'TNodes',
	'TEdges',
	'TEffects',
	'TProjection',
	'TCapabilities',
	'TExtensions',
	'TParticipants',
	'TMiddleware',
];
const pipelineParameters = [
	'TInputs',
	'TNodes',
	'TEdges',
	'TEffects',
	'TProjection',
	'TCapabilities',
];
const projectedTupleOwners = new Map([
	['CreatePipelineOptions', createOptionsParameters],
	['PipelineEdges', ['TEdges', 'TExtensions']],
	['PipelineNodes', ['TNodes', 'TExtensions']],
	['PipelineProjection', ['TNodes', 'TProjection', 'TExtensions']],
]);

const referenceShape = (name, typeArguments = [], typeParameter = false) => ({
	type: 'reference',
	name,
	typeArguments,
	typeParameter,
});
const parameterShape = (name) => referenceShape(name, [], true);
const intrinsicShape = (name) => ({ type: 'intrinsic', name });
const inferredShape = (name) => ({ type: 'inferred', name });
const conditionalShape = (checkType, extendsType, trueType, falseType) => ({
	type: 'conditional',
	checkType,
	extendsType,
	trueType,
	falseType,
});
const arrayShape = (elementType) => ({ type: 'array', elementType });
const readonlyShape = (target) => ({
	type: 'typeOperator',
	operator: 'readonly',
	target,
});
const readonlyRegistrationConstraint = (name) =>
	readonlyShape(arrayShape(referenceShape(name)));
const noInferShape = (name) =>
	referenceShape('NoInfer', [parameterShape(name)]);
const extensionNodesShape = () =>
	referenceShape('ExtensionNodes', [
		parameterShape('TNodes'),
		parameterShape('TExtensions'),
	]);
const extensionEdgesShape = () =>
	referenceShape('ExtensionEdges', [
		parameterShape('TEdges'),
		parameterShape('TExtensions'),
	]);
const closedProjectionShape = () =>
	referenceShape('ClosedOutputProjection', [parameterShape('TAccumulated')]);

const checkedTupleProperties = new Map([
	[
		'extensions',
		{
			publicType: parameterShape('TExtensions'),
			checkedType: referenceShape('CheckedGraphExtensionRegistrations', [
				parameterShape('TInputs'),
				parameterShape('TNodes'),
				parameterShape('TEdges'),
				parameterShape('TEffects'),
				parameterShape('TCapabilities'),
				noInferShape('TExtensions'),
			]),
		},
	],
	[
		'middleware',
		{
			publicType: parameterShape('TMiddleware'),
			checkedType: referenceShape('CheckedNodeMiddlewareRegistrations', [
				parameterShape('TInputs'),
				extensionNodesShape(),
				extensionEdgesShape(),
				parameterShape('TEffects'),
				parameterShape('TCapabilities'),
				noInferShape('TMiddleware'),
			]),
		},
	],
]);

const originalAliasTypes = new Map([
	['PipelineNodes', extensionNodesShape()],
	['PipelineEdges', extensionEdgesShape()],
	[
		'PipelineProjection',
		conditionalShape(
			referenceShape('ExtensionProjection', [
				parameterShape('TProjection'),
				parameterShape('TExtensions'),
			]),
			inferredShape('TAccumulated'),
			conditionalShape(
				closedProjectionShape(),
				referenceShape('OutputProjection', [extensionNodesShape()]),
				closedProjectionShape(),
				intrinsicShape('never')
			),
			intrinsicShape('never')
		),
	],
]);

const originalProjectedConstraints = new Map([
	[
		'CreatePipelineOptions',
		new Map([
			[
				'TExtensions',
				readonlyRegistrationConstraint(
					'GraphExtensionRegistrationShape'
				),
			],
			[
				'TMiddleware',
				readonlyRegistrationConstraint('NodeMiddlewareRegistration'),
			],
		]),
	],
	[
		'PipelineNodes',
		new Map([
			[
				'TExtensions',
				readonlyRegistrationConstraint(
					'GraphExtensionRegistrationShape'
				),
			],
		]),
	],
	[
		'PipelineEdges',
		new Map([
			[
				'TExtensions',
				readonlyRegistrationConstraint(
					'GraphExtensionRegistrationShape'
				),
			],
		]),
	],
	[
		'PipelineProjection',
		new Map([
			[
				'TExtensions',
				readonlyRegistrationConstraint(
					'GraphExtensionRegistrationShape'
				),
			],
		]),
	],
]);

const readonlyArray = (elementType) =>
	new TypeOperatorType(new ArrayType(elementType), 'readonly');

const typeParameterReference = (project, name) => {
	const reference = ReferenceType.createBrokenReference(
		name,
		project,
		undefined
	);
	reference.refersToTypeParameter = true;
	return reference;
};

const projectionError = (detail) =>
	new Error(`TypeDoc public Pipeline projection failed: ${detail}`);

const requireExactlyOne = (reflections, name, kindLabel) => {
	const matches = reflections.filter(
		(reflection) => reflection.name === name
	);
	if (matches.length !== 1) {
		throw projectionError(
			`expected exactly one ${kindLabel} named ${name}, found ${matches.length}.`
		);
	}

	return matches[0];
};

const assertTypeParameters = (reflection, expected) => {
	const actual = (reflection.typeParameters ?? []).map(
		(parameter) => parameter.name
	);
	if (
		actual.length !== expected.length ||
		actual.some((name, index) => name !== expected[index])
	) {
		throw projectionError(
			`${reflection.name} type parameters must remain ${expected.join(', ')} in that order; found ${actual.join(', ') || 'none'}.`
		);
	}
};

const matchesTypeList = (actual = [], expected = []) =>
	actual.length === expected.length &&
	actual.every((type, index) => matchesSemanticType(type, expected[index]));

const matchesReference = (actual, expected) =>
	actual.name === expected.name &&
	Boolean(actual.refersToTypeParameter) === expected.typeParameter &&
	matchesTypeList(actual.typeArguments, expected.typeArguments);

const matchesConditional = (actual, expected) =>
	matchesSemanticType(actual.checkType, expected.checkType) &&
	matchesSemanticType(actual.extendsType, expected.extendsType) &&
	matchesSemanticType(actual.trueType, expected.trueType) &&
	matchesSemanticType(actual.falseType, expected.falseType);

const matchesArray = (actual, expected) =>
	matchesSemanticType(actual.elementType, expected.elementType);

const matchesTypeOperator = (actual, expected) =>
	actual.operator === expected.operator &&
	matchesSemanticType(actual.target, expected.target);

const semanticMatchers = {
	array: matchesArray,
	conditional: matchesConditional,
	inferred: (actual, expected) => actual.name === expected.name,
	intrinsic: (actual, expected) => actual.name === expected.name,
	reference: matchesReference,
	typeOperator: matchesTypeOperator,
};

function matchesSemanticType(actual, expected) {
	if (!actual || !expected || actual.type !== expected.type) {
		return false;
	}

	return semanticMatchers[expected.type]?.(actual, expected) ?? false;
}

const requireCheckedTupleProperty = (createOptions, propertyName, expected) => {
	const property = requireExactlyOne(
		createOptions.children ?? [],
		propertyName,
		'CreatePipelineOptions property'
	);
	if (property.type?.type !== 'intersection') {
		throw projectionError(
			`CreatePipelineOptions.${propertyName} must remain a two-member intersection.`
		);
	}

	const members = property.type.types;
	if (
		members.length !== 2 ||
		!matchesSemanticType(members[0], expected.publicType) ||
		!matchesSemanticType(members[1], expected.checkedType)
	) {
		throw projectionError(
			`CreatePipelineOptions.${propertyName} must retain its exact public tuple and checked-helper generic argument tree.`
		);
	}

	return property;
};

const assertOriginalAliasType = (reflection, expected) => {
	if (!matchesSemanticType(reflection.type, expected)) {
		throw projectionError(
			`${reflection.name} must retain its exact compiler-derived right-hand side before projection.`
		);
	}
};

const assertOriginalProjectedConstraints = (reflection, expected) => {
	for (const [parameterName, expectedConstraint] of expected) {
		const parameter = reflection.typeParameters.find(
			(candidate) => candidate.name === parameterName
		);
		if (!matchesSemanticType(parameter?.type, expectedConstraint)) {
			throw projectionError(
				`${reflection.name}.${parameterName} must retain its exact original constraint before projection.`
			);
		}
	}
};

const projectPublicTupleConstraints = (owners) => {
	for (const reflection of owners.values()) {
		for (const parameter of reflection.typeParameters ?? []) {
			if (
				parameter.name === 'TExtensions' ||
				parameter.name === 'TMiddleware'
			) {
				parameter.type = readonlyArray(new IntrinsicType('object'));
			}
		}
	}
};

/**
 * Keeps exact checker-only tuple validation in declarations while projecting
 * a self-contained public vocabulary in generated API signatures.
 *
 * The projection is deliberately fail-closed. It runs only for the Pipeline
 * package project, then verifies every source shape it rewrites before making
 * any change. Renaming, removing or reordering a target therefore fails docs
 * generation instead of silently publishing a partial or misleading surface.
 *
 * @param {import('typedoc').ProjectReflection} project - Fully resolved
 *                                                      TypeDoc project reflection.
 */
export function projectPublicSurface(project) {
	if (project.name !== pipelineProjectName) {
		return;
	}

	const interfaces = project.getReflectionsByKind(ReflectionKind.Interface);
	const aliases = project.getReflectionsByKind(ReflectionKind.TypeAlias);
	const pipeline = requireExactlyOne(interfaces, 'Pipeline', 'interface');
	assertTypeParameters(pipeline, pipelineParameters);

	const createOptions = requireExactlyOne(
		interfaces,
		'CreatePipelineOptions',
		'interface'
	);
	assertTypeParameters(createOptions, createOptionsParameters);
	const tupleProperties = new Map();
	for (const [propertyName, expected] of checkedTupleProperties) {
		tupleProperties.set(
			propertyName,
			requireCheckedTupleProperty(createOptions, propertyName, expected)
		);
	}

	const owners = new Map();
	for (const [name, parameters] of projectedTupleOwners) {
		const reflection =
			name === 'CreatePipelineOptions'
				? createOptions
				: requireExactlyOne(aliases, name, 'type alias');
		assertTypeParameters(reflection, parameters);
		owners.set(name, reflection);
	}
	for (const [name, expected] of originalAliasTypes) {
		assertOriginalAliasType(owners.get(name), expected);
	}
	for (const [name, expected] of originalProjectedConstraints) {
		assertOriginalProjectedConstraints(owners.get(name), expected);
	}

	const nodeRegistry = requireExactlyOne(
		aliases,
		'NodeRegistry',
		'type alias'
	);
	const outputProjection = requireExactlyOne(
		aliases,
		'OutputProjection',
		'type alias'
	);
	assertTypeParameters(outputProjection, ['TNodes']);
	const edge = requireExactlyOne(interfaces, 'Edge', 'interface');
	assertTypeParameters(edge, ['TFrom', 'TTo']);

	for (const property of tupleProperties.values()) {
		property.type = property.type.types[0];
	}
	projectPublicTupleConstraints(owners);

	const pipelineNodes = owners.get('PipelineNodes');
	const pipelineEdges = owners.get('PipelineEdges');
	const pipelineProjection = owners.get('PipelineProjection');
	pipelineNodes.type = ReferenceType.createResolvedReference(
		'NodeRegistry',
		nodeRegistry,
		project
	);
	pipelineEdges.type = readonlyArray(
		ReferenceType.createResolvedReference('Edge', edge, project)
	);

	const resolvedNodes = ReferenceType.createResolvedReference(
		'PipelineNodes',
		pipelineNodes,
		project
	);
	resolvedNodes.typeArguments = [
		typeParameterReference(project, 'TNodes'),
		typeParameterReference(project, 'TExtensions'),
	];
	const projection = ReferenceType.createResolvedReference(
		'OutputProjection',
		outputProjection,
		project
	);
	projection.typeArguments = [resolvedNodes];
	pipelineProjection.type = projection;
}

export function load(app) {
	app.converter.on(Converter.EVENT_RESOLVE_END, ({ project }) => {
		projectPublicSurface(project);
	});
}
