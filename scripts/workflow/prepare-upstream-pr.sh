#!/usr/bin/env bash

set -euo pipefail

FORK_REMOTE=${FORK_REMOTE:-origin}
FORK_BRANCH=${FORK_BRANCH:-main}
UPSTREAM_REMOTE=${UPSTREAM_REMOTE:-upstream}
UPSTREAM_BRANCH=${UPSTREAM_BRANCH:-main}

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

require_remote_contracts() {
	local upstream_url
	if ! upstream_url=$(git remote get-url "$UPSTREAM_REMOTE"); then
		echo "Error: missing upstream remote '${UPSTREAM_REMOTE}'." >&2
		exit 1
	fi
	if ! upstream_slug=$(github_slug_from_url "$upstream_url"); then
		echo "Error: upstream remote '${UPSTREAM_REMOTE}' is not a canonical GitHub repository URL." >&2
		exit 1
	fi
	require_authoring_remote_contract "$FORK_REMOTE"
	fork_slug=theGeekist/wpkernel-1
	if [[ $upstream_slug != 'wpkernel/wpkernel' ]]; then
		echo "Error: upstream remote must resolve to wpkernel/wpkernel, not '${upstream_slug}'." >&2
		exit 1
	fi
}

require_branch_name() {
	if ! git check-ref-format --branch "$1" >/dev/null 2>&1; then
		echo "Error: invalid branch name '$1'." >&2
		exit 1
	fi
}

require_pr_branch_name() {
	if [[ $1 != pr/* ]] || ! git check-ref-format --branch "$1" >/dev/null 2>&1; then
		echo "Error: PR branch must be a valid pr/* branch, not '${1}'." >&2
		exit 1
	fi
}

require_authoring_main_branch() {
	if [[ $FORK_BRANCH != main ]]; then
		echo "Error: FORK_BRANCH must be main, not '${FORK_BRANCH}'." >&2
		exit 1
	fi
}

ensure_remote_branch() {
	local remote=$1
	local branch=$2
	if ! git show-ref --verify --quiet "refs/remotes/${remote}/${branch}"; then
		echo "Error: missing ${remote}/${branch}. Run 'git fetch ${remote} ${branch}' first." >&2
		exit 1
	fi
}

require_authoring_main_contains_upstream() {
	if ! git merge-base --is-ancestor \
		"${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}" \
		"${FORK_REMOTE}/${FORK_BRANCH}"; then
		cat >&2 <<EOF
Error: ${FORK_REMOTE}/${FORK_BRANCH} does not contain ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}.
Run scripts/workflow/sync-fork-main.sh before preparing an upstream PR.
EOF
		exit 1
	fi
}

require_binary git
require_binary date
require_authoring_main_branch
require_clean_worktree
require_remote_contracts
require_branch_name "$FORK_BRANCH"
require_branch_name "$UPSTREAM_BRANCH"

git fetch "${FORK_REMOTE}" "${FORK_BRANCH}"
git fetch "${UPSTREAM_REMOTE}" "${UPSTREAM_BRANCH}"
ensure_remote_branch "${FORK_REMOTE}" "${FORK_BRANCH}"
ensure_remote_branch "${UPSTREAM_REMOTE}" "${UPSTREAM_BRANCH}"
require_authoring_main_contains_upstream

echo "Commits on ${FORK_REMOTE}/${FORK_BRANCH} not in ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}:"
git log --oneline "${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}..${FORK_REMOTE}/${FORK_BRANCH}" || true

read -rp "Continue and create a PR branch at the exact authoring-main revision? [y/N]: " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
	echo "Aborted."
	exit 0
fi

default_branch="pr/$(date +%Y%m%d)-${FORK_BRANCH}"
read -rp "Name for the new PR branch [${default_branch}]: " pr_branch
pr_branch=${pr_branch:-$default_branch}
require_pr_branch_name "$pr_branch"

if git show-ref --verify --quiet "refs/heads/${pr_branch}"; then
	echo "Error: branch '${pr_branch}' already exists. Choose another name." >&2
	exit 1
fi

echo "Creating branch '${pr_branch}' from ${FORK_REMOTE}/${FORK_BRANCH}..."
git checkout -b "${pr_branch}" "${FORK_REMOTE}/${FORK_BRANCH}" >/dev/null

echo "PR branch preserves the exact authoring-main commit for documentation promotion."
git status -sb

read -rp "Push '${pr_branch}' to ${FORK_REMOTE}? [y/N]: " push_choice
if [[ $push_choice =~ ^[Yy]$ ]]; then
	git push -u "${FORK_REMOTE}" "${pr_branch}"
	pushed=true
else
	pushed=false
fi

if [[ $pushed == true ]]; then
	if command -v gh >/dev/null 2>&1; then
		read -rp "Open PR on ${upstream_slug} via GitHub CLI now? [y/N]: " pr_choice
		if [[ $pr_choice =~ ^[Yy]$ ]]; then
			gh pr create \
				--repo "${upstream_slug}" \
				--base "${UPSTREAM_BRANCH}" \
				--head "${fork_slug%/*}:${pr_branch}" \
				--fill
		fi
	else
		echo "Push complete. Create the PR in ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH} when ready."
	fi
else
	cat <<EOF
Branch '${pr_branch}' is ready locally.
Push it with:
  git push -u ${FORK_REMOTE} ${pr_branch}
Then open your PR targeting ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}.
EOF
fi
