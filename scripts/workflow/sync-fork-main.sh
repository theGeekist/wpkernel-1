#!/usr/bin/env bash

set -euo pipefail

FORK_REMOTE=${FORK_REMOTE:-origin}
FORK_BRANCH=${FORK_BRANCH:-main}
UPSTREAM_REMOTE=${UPSTREAM_REMOTE:-upstream}
UPSTREAM_BRANCH=${UPSTREAM_BRANCH:-main}
SYNC_RECOVERY=${SYNC_RECOVERY:-}
RECOVERY_BRANCH=wpkernel-sync-candidate
EXPECTED_MAIN_REF=refs/wpkernel-sync/expected-main
EXPECTED_FORK_REF=refs/wpkernel-sync/expected-fork
EXPECTED_UPSTREAM_REF=refs/wpkernel-sync/expected-upstream
COMPLETED_REF=refs/wpkernel-sync/completed

require_binary() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Error: missing required command '$1'." >&2
		exit 1
	fi
}

null_object_id() {
	case "$(git rev-parse --show-object-format)" in
		sha1) printf '%040d\n' 0 ;;
		sha256) printf '%064d\n' 0 ;;
		*)
			echo "Error: unsupported Git object format." >&2
			exit 1
			;;
	esac
}

SCRIPT_SOURCE=${BASH_SOURCE[0]}
while [[ -h $SCRIPT_SOURCE ]]; do
	SCRIPT_DIRECTORY=$(
		CDPATH= cd -P -- "$(dirname -- "$SCRIPT_SOURCE")" && pwd -P
	)
	SCRIPT_SOURCE=$(readlink "$SCRIPT_SOURCE")
	if [[ $SCRIPT_SOURCE != /* ]]; then
		SCRIPT_SOURCE="${SCRIPT_DIRECTORY}/${SCRIPT_SOURCE}"
	fi
done
SCRIPT_DIRECTORY=$(
	CDPATH= cd -P -- "$(dirname -- "$SCRIPT_SOURCE")" && pwd -P
)
# shellcheck source=lib/sync-fetch-snapshots.sh
source "${SCRIPT_DIRECTORY}/lib/sync-fetch-snapshots.sh"
# shellcheck source=lib/sync-recovery-state.sh
source "${SCRIPT_DIRECTORY}/lib/sync-recovery-state.sh"

require_clean_worktree() {
	local status
	if ! status=$(git status --porcelain=v1 --untracked-files=all --ignore-submodules=none); then
		echo "Error: unable to inspect the working tree." >&2
		exit 1
	fi
	if [[ -n $status ]]; then
		echo "Error: working tree has changes. Commit or stash before continuing." >&2
		exit 1
	fi
}

parse_github_slug() {
	local slug
	case "$1" in
		git@github.com:*) slug=${1#git@github.com:} ;;
		https://github.com/*) slug=${1#https://github.com/} ;;
		ssh://git@github.com/*) slug=${1#ssh://git@github.com/} ;;
		*) return 1 ;;
	esac
	slug=${slug%.git}
	if [[ ! $slug =~ ^[^/]+/[^/]+$ ]]; then
		return 1
	fi
	printf '%s\n' "$slug"
}

require_remote_contracts() {
	local fork_fetch_output
	local fork_push_output
	local upstream_output
	local -a fork_fetch_urls=()
	local -a fork_push_urls=()
	local -a upstream_urls=()
	local fork_fetch_slug
	local fork_push_slug
	local upstream_slug
	local url
	if ! fork_fetch_output=$(git remote get-url --all "$FORK_REMOTE") || \
		! fork_push_output=$(git remote get-url --push --all "$FORK_REMOTE"); then
		echo "Error: missing working remote '${FORK_REMOTE}'." >&2
		exit 1
	fi
	if ! upstream_output=$(git remote get-url --all "$UPSTREAM_REMOTE"); then
		echo "Error: missing release remote '${UPSTREAM_REMOTE}'." >&2
		exit 1
	fi
	while IFS= read -r url; do
		[[ -n $url ]] && fork_fetch_urls+=("$url")
	done <<<"$fork_fetch_output"
	while IFS= read -r url; do
		[[ -n $url ]] && fork_push_urls+=("$url")
	done <<<"$fork_push_output"
	while IFS= read -r url; do
		[[ -n $url ]] && upstream_urls+=("$url")
	done <<<"$upstream_output"
	if [[ ${#fork_fetch_urls[@]} -ne 1 || ${#fork_push_urls[@]} -ne 1 ]]; then
		echo "Error: working remote must have exactly one fetch URL and one push URL." >&2
		exit 1
	fi
	if [[ ${#upstream_urls[@]} -ne 1 ]]; then
		echo "Error: release remote must have exactly one fetch URL." >&2
		exit 1
	fi
	if ! fork_fetch_slug=$(parse_github_slug "${fork_fetch_urls[0]}") || \
		! fork_push_slug=$(parse_github_slug "${fork_push_urls[0]}"); then
		echo "Error: working remote '${FORK_REMOTE}' must use canonical GitHub URLs." >&2
		exit 1
	fi
	if ! upstream_slug=$(parse_github_slug "${upstream_urls[0]}"); then
		echo "Error: release remote '${UPSTREAM_REMOTE}' must use a canonical GitHub URL." >&2
		exit 1
	fi
	if [[ $fork_fetch_slug != 'theGeekist/wpkernel-1' || \
		$fork_push_slug != 'theGeekist/wpkernel-1' ]]; then
		echo "Error: working remote must fetch from and push to theGeekist/wpkernel-1." >&2
		exit 1
	fi
	if [[ $upstream_slug != 'wpkernel/wpkernel' ]]; then
		echo "Error: release remote must resolve to wpkernel/wpkernel." >&2
		exit 1
	fi
	validated_fork_fetch_url=${fork_fetch_urls[0]}
	validated_fork_push_url=${fork_push_urls[0]}
	validated_upstream_fetch_url=${upstream_urls[0]}
}

require_branch_name() {
	if ! git check-ref-format --branch "$1" >/dev/null 2>&1; then
		echo "Error: invalid branch name '$1'." >&2
		exit 1
	fi
}

ensure_branch_exists() {
	if ! git show-ref --verify --quiet "refs/heads/${FORK_BRANCH}"; then
		echo "Error: local branch '${FORK_BRANCH}' does not exist." >&2
		exit 1
	fi
}

ensure_no_unpublished_local_commits() {
	local fork_authority_sha=$1
	local unpublished
	if ! unpublished=$(
		git rev-list --oneline "${fork_authority_sha}..refs/heads/${FORK_BRANCH}"
	); then
		echo "Error: unable to compare local and working-repository history." >&2
		exit 1
	fi
	if [[ -n $unpublished ]]; then
		echo "Error: local ${FORK_BRANCH} contains commits not published to ${FORK_REMOTE}/${FORK_BRANCH}:" >&2
		echo "$unpublished" >&2
		echo "Publish or preserve those commits before synchronising." >&2
		exit 1
	fi
}

require_candidate_state() {
	local expected_sha=$1
	local current_branch
	local current_sha
	if ! current_branch=$(git symbolic-ref --quiet --short HEAD) || \
		[[ $current_branch != "$FORK_BRANCH" ]]; then
		echo "Error: expected checked-out branch '${FORK_BRANCH}'; synchronisation aborted." >&2
		exit 1
	fi
	require_clean_worktree
	current_sha=$(git rev-parse HEAD)
	if [[ $current_sha != "$expected_sha" ]]; then
		echo "Error: ${FORK_BRANCH} changed during synchronisation; preserving the new state." >&2
		exit 1
	fi
}

adopt_detached_candidate() {
	local expected_main_sha=$1
	local candidate_sha=$2
	require_clean_worktree
	if [[ $(git rev-parse HEAD) != "$candidate_sha" ]]; then
		echo "Error: detached candidate changed before adoption." >&2
		exit 1
	fi
	if ! git update-ref \
		"refs/heads/${FORK_BRANCH}" \
		"$candidate_sha" \
		"$expected_main_sha"; then
		git checkout "$FORK_BRANCH" >/dev/null 2>&1 || true
		echo "Error: ${FORK_BRANCH} changed concurrently; preserving the newer state." >&2
		exit 1
	fi
	git checkout "$FORK_BRANCH"
	require_candidate_state "$candidate_sha"
}


require_binary git
require_branch_name "$FORK_BRANCH"
require_branch_name "$UPSTREAM_BRANCH"
if [[ $SYNC_RECOVERY == abort ]]; then
	ensure_branch_exists
	abort_recovery
	exit 0
fi
require_clean_worktree
ensure_branch_exists
require_remote_contracts
local_main_sha=$(git rev-parse "refs/heads/${FORK_BRANCH}")
reserve_fetch_snapshots "$local_main_sha"

fork_sha=$(remote_branch_sha "$validated_fork_fetch_url" "$FORK_BRANCH")
upstream_sha=$(remote_branch_sha "$validated_upstream_fetch_url" "$UPSTREAM_BRANCH")
git fetch "$validated_fork_fetch_url" "$fork_sha"
git fetch "$validated_upstream_fetch_url" "$upstream_sha"
bind_fetch_snapshots "$local_main_sha" "$fork_sha" "$upstream_sha"
ensure_no_unpublished_local_commits "$fork_sha"

case "$SYNC_RECOVERY" in
	resume)
		resume_recovery
		;;
	complete)
		complete_recovery
		resume_recovery
		;;
	abort) exit 0 ;;
	'')
		if recovery_state_exists; then
			echo "Error: synchronisation recovery state exists." >&2
			echo "Use SYNC_RECOVERY=resume after rebase completion, or SYNC_RECOVERY=abort." >&2
			exit 1
		fi
		if ! git merge-base --is-ancestor "$local_main_sha" "$fork_sha"; then
			echo "Error: local ${FORK_BRANCH} diverged from ${FORK_REMOTE}/${FORK_BRANCH}; preserving it unchanged." >&2
			exit 1
		fi

		echo "Preparing ${FORK_BRANCH} from exact working-repository SHA ${fork_sha}..."
		git checkout --detach "$fork_sha"
		adopt_detached_candidate "$local_main_sha" "$fork_sha"
		candidate_sha=$fork_sha

		ahead=$(git rev-list --oneline "${upstream_sha}..${candidate_sha}" || true)
		if [[ -z $ahead ]]; then
			if ! git merge-base --is-ancestor "$candidate_sha" "$upstream_sha"; then
				echo "Error: release history does not contain the working candidate." >&2
				exit 1
			fi
			echo "No extra commits to preserve. Adopting exact release SHA ${upstream_sha}."
			git checkout --detach "$upstream_sha"
			adopt_detached_candidate "$candidate_sha" "$upstream_sha"
			candidate_sha=$upstream_sha
		else
			echo "Commits on ${FORK_BRANCH} not yet in ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}:"
			echo "${ahead}"
			read -rp "Run interactive rebase to replay only the commits you still need? [Y/n]: " choice
			if [[ $choice =~ ^[Nn]$ ]]; then
				echo "Aborted."
				exit 0
			fi
			require_candidate_state "$candidate_sha"
			record_recovery_state "$candidate_sha" "$fork_sha" "$upstream_sha"
			git checkout "$RECOVERY_BRANCH"
			if ! git rebase -i "$upstream_sha"; then
				print_recovery_guidance
				exit 1
			fi
			if rebase_in_progress; then
				print_recovery_guidance
				exit 1
			fi
			recovery_sha=$(git rev-parse "refs/heads/${RECOVERY_BRANCH}")
			if ! git merge-base --is-ancestor "$upstream_sha" "$recovery_sha"; then
				echo "Error: recovery candidate is not based on the recorded release SHA." >&2
				exit 1
			fi
			record_completion_witness "$recovery_sha"
			adopt_recovery_candidate \
				"$recovery_sha" \
				"$candidate_sha" \
				"$fork_sha" \
				"$upstream_sha" \
				"$recovery_sha"
			candidate_sha=$recovery_sha
		fi
		;;
	*)
		echo "Error: SYNC_RECOVERY must be 'complete', 'resume', 'abort', or unset." >&2
		exit 1
		;;
esac

require_candidate_state "$candidate_sha"

echo "Local ${FORK_BRANCH} is now based on ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}."
git status -sb

read -rp "Force-push ${FORK_BRANCH} to ${FORK_REMOTE}? [y/N]: " push_choice
if [[ $push_choice =~ ^[Yy]$ ]]; then
	require_candidate_state "$candidate_sha"
	git push "$validated_fork_push_url" "${candidate_sha}:refs/heads/${FORK_BRANCH}" \
		--force-with-lease="refs/heads/${FORK_BRANCH}:${fork_sha}"
else
	printf -v deferred_push \
		'git push %q %q %q' \
		"$validated_fork_push_url" \
		"${candidate_sha}:refs/heads/${FORK_BRANCH}" \
		"--force-with-lease=refs/heads/${FORK_BRANCH}:${fork_sha}"
	cat <<EOF
Skipping push. When ready, sync the fork manually:
  ${deferred_push}
EOF
fi

echo "Sync complete."
