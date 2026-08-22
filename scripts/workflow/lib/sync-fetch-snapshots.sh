#!/usr/bin/env bash

# shellcheck source=sync-git-object-id.sh
source "$(dirname "${BASH_SOURCE[0]}")/sync-git-object-id.sh"

FETCH_FORK_REF=
FETCH_UPSTREAM_REF=
fetched_fork_sha=
fetched_upstream_sha=

cleanup_fetch_snapshots() {
	local result=$?
	trap - EXIT INT TERM
	if [[ -n $fetched_fork_sha || -n $fetched_upstream_sha ]]; then
		if ! {
			printf 'start\n'
			if [[ -n $fetched_fork_sha ]]; then
				printf 'delete %s %s\n' "$FETCH_FORK_REF" "$fetched_fork_sha"
			fi
			if [[ -n $fetched_upstream_sha ]]; then
				printf 'delete %s %s\n' \
					"$FETCH_UPSTREAM_REF" \
					"$fetched_upstream_sha"
			fi
			printf 'prepare\ncommit\n'
		} | git update-ref --stdin >/dev/null; then
			echo "Error: private fetch snapshots changed concurrently; preserving them." >&2
			if [[ $result -eq 0 ]]; then
				result=1
			fi
		fi
	fi
	return "$result"
}

trap cleanup_fetch_snapshots EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

reserve_fetch_snapshots() {
	local initial_sha=$1
	local attempt
	local token
	for attempt in {1..8}; do
		token="$$-${RANDOM}-${RANDOM}"
		FETCH_FORK_REF="refs/wpkernel-sync/fetch-${token}-fork"
		FETCH_UPSTREAM_REF="refs/wpkernel-sync/fetch-${token}-upstream"
		if git update-ref --stdin >/dev/null 2>&1 <<EOF
start
create ${FETCH_FORK_REF} ${initial_sha}
create ${FETCH_UPSTREAM_REF} ${initial_sha}
prepare
commit
EOF
		then
			fetched_fork_sha=$initial_sha
			fetched_upstream_sha=$initial_sha
			return
		fi
	done
	echo "Error: unable to reserve private fetch snapshot refs." >&2
	exit 1
}

remote_branch_sha() {
	local url=$1
	local branch=$2
	local output
	local sha
	local ref
	local extra
	local null_oid
	if ! output=$(git ls-remote --exit-code "$url" "refs/heads/${branch}"); then
		echo "Error: unable to resolve ${url} branch ${branch}." >&2
		exit 1
	fi
	IFS=$'\t' read -r sha ref extra <<<"$output"
	null_oid=$(null_object_id)
	if [[ -n $extra || $ref != "refs/heads/${branch}" || \
		${#sha} -ne ${#null_oid} || ! $sha =~ ^[0-9a-fA-F]+$ || \
		$output == *$'\n'* ]]; then
		echo "Error: remote branch authority was not one exact object ID." >&2
		exit 1
	fi
	printf '%s\n' "$sha"
}

bind_fetch_snapshots() {
	local initial_sha=$1
	local fork_sha=$2
	local upstream_sha=$3
	if ! git cat-file -e "${fork_sha}^{commit}" || \
		! git cat-file -e "${upstream_sha}^{commit}"; then
		echo "Error: a validated remote SHA was not fetched as a commit." >&2
		exit 1
	fi
	if ! git update-ref --stdin >/dev/null <<EOF
start
update ${FETCH_FORK_REF} ${fork_sha} ${initial_sha}
update ${FETCH_UPSTREAM_REF} ${upstream_sha} ${initial_sha}
prepare
commit
EOF
	then
		echo "Error: private fetch snapshot authority changed concurrently." >&2
		exit 1
	fi
	fetched_fork_sha=$fork_sha
	fetched_upstream_sha=$upstream_sha
}
