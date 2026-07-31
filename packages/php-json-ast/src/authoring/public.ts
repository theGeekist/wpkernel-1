export { PhpAuthoringError } from './errors';
export type { PhpAuthoringErrorCode, PhpAuthoringErrorOptions } from './errors';
export {
	isPhpVariableValue,
	normalizePhpVariableReference,
	variable,
} from './references';
export type {
	NormalizedPhpVariableReference,
	PhpVariableValue,
} from './references';
export {
	arrayExpression,
	assignment,
	functionCall,
	methodCall,
} from './expressions';
export type {
	PhpArrayEntry,
	PhpCallSubject,
	PhpExpressionInput,
} from './expressions';
export {
	expressionStatement,
	foreachStatement,
	ifStatement,
	renderPhpStatement,
	renderPhpStatements,
	returnStatement,
} from './statements';
export type {
	PhpConditionalBranch,
	PhpForeachStatementOptions,
	PhpIfStatementOptions,
	PhpStatementValue,
} from './statements';
export { expression, renderPhpValue } from './values';
export type {
	PhpAuthoringValue,
	PhpExpressionValue,
	PhpValueRecord,
} from './values';
