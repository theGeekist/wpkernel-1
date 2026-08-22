export interface PipelineReleaseMetadata {
	readonly distTag: 'beta' | 'latest';
	readonly version: string;
}

export interface PipelineArchiveIdentity {
	readonly integrity: string;
	readonly shasum: string;
	readonly sha512: string;
}

export declare const parsePipelineVersion: (
	version: unknown
) => PipelineReleaseMetadata;

export declare const readPipelineReleaseMetadata: (
	manifestPath: string,
	expectedTag?: string
) => PipelineReleaseMetadata;

export declare const inspectPipelineArchive: (
	archivePath: string
) => PipelineArchiveIdentity;

export declare const verifyPipelineArchive: (
	metadataPath: string,
	archivePath: string
) => PipelineReleaseMetadata & PipelineArchiveIdentity;
