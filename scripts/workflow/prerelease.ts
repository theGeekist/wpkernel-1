#!/usr/bin/env node
import process from 'node:process';

process.stderr.write(
	[
		'prerelease.ts is retired and permanently quarantined.',
		'It does not read or mutate repository state, create commits or tags, push refs, publish packages, or stash or switch work.',
		'Use scripts/workflow/prepare-upstream-pr.sh to prepare an authoring PR.',
		'Use scripts/workflow/sync-fork-main.sh to synchronise the fork after the upstream merge.',
		'Use the trusted Pipeline release workflow for packed qualification and publication.',
	].join('\n') + '\n'
);
process.exitCode = 1;
