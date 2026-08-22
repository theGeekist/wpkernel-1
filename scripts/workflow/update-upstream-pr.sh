#!/usr/bin/env bash

set -euo pipefail

FORK_REMOTE=${FORK_REMOTE:-origin}
FORK_BRANCH=${FORK_BRANCH:-main}
PR_BRANCH=${PR_BRANCH:-}

SCRIPT_SOURCE=${BASH_SOURCE[0]}
while [[ -h $SCRIPT_SOURCE ]]; do
	SCRIPT_DIRECTORY=$(CDPATH= cd -P -- "$(dirname -- "$SCRIPT_SOURCE")" && pwd -P)
	SCRIPT_SOURCE=$(readlink "$SCRIPT_SOURCE")
	if [[ $SCRIPT_SOURCE != /* ]]; then
		SCRIPT_SOURCE="${SCRIPT_DIRECTORY}/${SCRIPT_SOURCE}"
	fi
done
SCRIPT_DIRECTORY=$(CDPATH= cd -P -- "$(dirname -- "$SCRIPT_SOURCE")" && pwd -P)
# shellcheck source=lib/authoring-remote-authority.sh
source "${SCRIPT_DIRECTORY}/lib/authoring-remote-authority.sh"

require_binary() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Error: missing required command '$1'." >&2
		exit 1
	fi
}

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

require_pr_branch() {
	if [[ -z $PR_BRANCH ]]; then
		echo 'Error: set PR_BRANCH to the existing pr/* branch to update.' >&2
		exit 1
	fi
	if [[ $PR_BRANCH != pr/* ]] || ! git check-ref-format --branch "$PR_BRANCH" >/dev/null 2>&1; then
		echo "Error: PR_BRANCH must be a valid pr/* branch, not '${PR_BRANCH}'." >&2
		exit 1
	fi
}

require_authoring_main_branch() {
	if [[ $FORK_BRANCH != main ]]; then
		echo "Error: FORK_BRANCH must be main, not '${FORK_BRANCH}'." >&2
		exit 1
	fi
}

fetch_required_branch() {
	local branch=$1
	if ! git fetch "$FORK_REMOTE" "$branch"; then
		echo "Error: missing ${FORK_REMOTE}/${branch} after fetch." >&2
		exit 1
	fi
	if ! git show-ref --verify --quiet "refs/remotes/${FORK_REMOTE}/${branch}"; then
		echo "Error: missing ${FORK_REMOTE}/${branch} after fetch." >&2
		exit 1
	fi
}

require_binary git
require_authoring_main_branch
require_clean_worktree
require_authoring_remote_contract "$FORK_REMOTE"
require_pr_branch

fetch_required_branch "$FORK_BRANCH"
fetch_required_branch "$PR_BRANCH"
main_sha=$(git rev-parse "refs/remotes/${FORK_REMOTE}/${FORK_BRANCH}")
pr_sha=$(git rev-parse "refs/remotes/${FORK_REMOTE}/${PR_BRANCH}")
if ! git merge-base --is-ancestor \
	"$pr_sha" \
	"$main_sha"; then
	cat >&2 <<EOF
Error: ${FORK_REMOTE}/${PR_BRANCH} is not an ancestor of ${FORK_REMOTE}/${FORK_BRANCH}.
Its history cannot be safely fast-forwarded from authoring main.
EOF
	exit 1
fi

git push \
	"--force-with-lease=refs/heads/${PR_BRANCH}:${pr_sha}" \
	"$validated_authoring_push_url" \
	"${main_sha}:refs/heads/${PR_BRANCH}"

echo "Updated ${PR_BRANCH} to the exact ${FORK_REMOTE}/${FORK_BRANCH} revision."
