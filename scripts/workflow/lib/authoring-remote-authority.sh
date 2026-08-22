#!/usr/bin/env bash

# Intentional sourced-library outputs set by require_authoring_remote_contract.
# shellcheck disable=SC2034
declare validated_authoring_fetch_url=''
# shellcheck disable=SC2034
declare validated_authoring_push_url=''

github_slug_from_url() {
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

require_authoring_remote_contract() {
	local remote=$1
	local fetch_output
	local push_output
	local fetch_slug
	local push_slug
	local url
	local -a fetch_urls=()
	local -a push_urls=()
	if ! fetch_output=$(git remote get-url --all "$remote") || \
		! push_output=$(git remote get-url --push --all "$remote"); then
		echo "Error: missing authoring remote '${remote}'." >&2
		exit 1
	fi
	while IFS= read -r url; do
		[[ -n $url ]] && fetch_urls+=("$url")
	done <<<"$fetch_output"
	while IFS= read -r url; do
		[[ -n $url ]] && push_urls+=("$url")
	done <<<"$push_output"
	if [[ ${#fetch_urls[@]} -ne 1 || ${#push_urls[@]} -ne 1 ]]; then
		echo "Error: authoring remote '${remote}' must have exactly one fetch URL and one push URL." >&2
		exit 1
	fi
	if ! fetch_slug=$(github_slug_from_url "${fetch_urls[0]}") || \
		! push_slug=$(github_slug_from_url "${push_urls[0]}"); then
		echo "Error: authoring remote '${remote}' must use canonical GitHub URLs." >&2
		exit 1
	fi
	if [[ $fetch_slug != 'theGeekist/wpkernel-1' || $push_slug != 'theGeekist/wpkernel-1' ]]; then
		echo "Error: authoring remote '${remote}' must fetch from and push to theGeekist/wpkernel-1." >&2
		exit 1
	fi
	validated_authoring_fetch_url=${fetch_urls[0]}
	validated_authoring_push_url=${push_urls[0]}
}
