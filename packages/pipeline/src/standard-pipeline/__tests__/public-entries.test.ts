import * as pipeline from '../../index.js';
import * as pipelineV1 from '../../v1.js';
import type {
	SerialNativeOutcome,
	SerialPipeline,
	SerialPipelineLifecycle,
} from '../../v1.js';

type NativeRuntimeKey = keyof typeof pipeline;
type CompatibilityRuntimeKey = keyof typeof pipelineV1;
type ExpectNever<T extends never> = T;
type ExpectPresent<T extends true> = T;
type ExpectFalse<T extends false> = T;

type NoV1HelperAtRoot = ExpectNever<Extract<'createHelper', NativeRuntimeKey>>;
type NoV1FactoryAtRoot = ExpectNever<
	Extract<'createSerialPipeline', NativeRuntimeKey>
>;
type V1FactoryIsPresent = ExpectPresent<
	'createSerialPipeline' extends CompatibilityRuntimeKey ? true : false
>;
type SerialCannotSuspend = ExpectNever<
	Extract<SerialNativeOutcome, { readonly kind: 'suspended' }>
>;
type NarrowOptions = { readonly kind: 'narrow' };
type WideOptions = { readonly kind: string };
type NarrowCannotWiden = ExpectFalse<
	SerialPipeline<NarrowOptions, string> extends SerialPipeline<
		WideOptions,
		string
	>
		? true
		: false
>;
type WideCannotNarrow = ExpectFalse<
	SerialPipeline<WideOptions, string> extends SerialPipeline<
		NarrowOptions,
		string
	>
		? true
		: false
>;
type ResultRemainsCovariant = ExpectPresent<
	SerialPipeline<NarrowOptions, 'result'> extends SerialPipeline<
		NarrowOptions,
		string
	>
		? true
		: false
>;
type ExactLifecycle = ExpectNever<
	Exclude<
		SerialPipelineLifecycle,
		'after-fragments' | 'before-builders' | 'after-builders' | 'finalize'
	>
>;

const typeBoundary: readonly [
	NoV1HelperAtRoot,
	NoV1FactoryAtRoot,
	V1FactoryIsPresent,
	SerialCannotSuspend,
	NarrowCannotWiden,
	WideCannotNarrow,
	ResultRemainsCovariant,
	ExactLifecycle,
] = [
	undefined as never,
	undefined as never,
	true,
	undefined as never,
	false,
	false,
	true,
	undefined as never,
];
void typeBoundary;

describe('public Pipeline entry points', () => {
	it('keeps the package root native v2', () => {
		expect(Object.keys(pipeline).sort()).toEqual([
			'abandon',
			'createPipeline',
			'resume',
			'runPipeline',
		]);
	});

	it('exposes only immutable serial authoring through v1', () => {
		expect(Object.keys(pipelineV1).sort()).toEqual([
			'createHelper',
			'createSerialPipeline',
			'runPipeline',
		]);
		expect(pipelineV1.runPipeline).not.toBe(pipeline.runPipeline);
	});

	it('does not leak rejected v1 authorities', () => {
		const compatibility = pipelineV1 as Record<string, unknown>;
		for (const name of [
			'createPipeline',
			'createPipelineExtension',
			'createPipelineRollback',
			'makePipeline',
			'makeResumablePipeline',
			'maybeThen',
		]) {
			expect(compatibility[name]).toBeUndefined();
		}
	});
});
