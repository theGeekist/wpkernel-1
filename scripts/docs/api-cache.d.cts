export function documentationGeneratorInputs(
	repositoryRoot: string
): readonly string[];

export function collectDocumentationInputs(
	repositoryRoot: string,
	packages: readonly string[]
): Promise<string[]>;

export function computeSignature(
	inputFiles: readonly string[]
): Promise<string>;
