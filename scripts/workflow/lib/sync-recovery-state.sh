#!/usr/bin/env bash

recovery_state_exists() {
	git show-ref --verify --quiet "refs/heads/${RECOVERY_BRANCH}" || \
	git show-ref --verify --quiet "$EXPECTED_MAIN_REF" || \
		git show-ref --verify --quiet "$EXPECTED_FORK_REF" || \
		git show-ref --verify --quiet "$EXPECTED_UPSTREAM_REF" || \
		git show-ref --verify --quiet "$COMPLETED_REF"
}

recovery_state_complete() {
	git show-ref --verify --quiet "refs/heads/${RECOVERY_BRANCH}" && \
		git show-ref --verify --quiet "$EXPECTED_MAIN_REF" && \
		git show-ref --verify --quiet "$EXPECTED_FORK_REF" && \
		git show-ref --verify --quiet "$EXPECTED_UPSTREAM_REF"
}

require_complete_recovery_state() {
	if ! recovery_state_complete; then
		if recovery_state_exists; then
			echo "Error: synchronisation recovery metadata is incomplete; refusing to mutate it." >&2
		else
			echo "Error: no synchronisation recovery state exists." >&2
		fi
		exit 1
	fi
}

record_recovery_state() {
	local expected_main_sha=$1
	local expected_fork_sha=$2
	local expected_upstream_sha=$3
	if recovery_state_exists; then
		echo "Error: an earlier synchronisation recovery state already exists." >&2
		echo "Resume with SYNC_RECOVERY=resume or remove it with SYNC_RECOVERY=abort." >&2
		exit 1
	fi
	git update-ref --stdin >/dev/null <<EOF
start
create refs/heads/${RECOVERY_BRANCH} ${expected_main_sha}
create ${EXPECTED_MAIN_REF} ${expected_main_sha}
create ${EXPECTED_FORK_REF} ${expected_fork_sha}
create ${EXPECTED_UPSTREAM_REF} ${expected_upstream_sha}
prepare
commit
EOF
}

clear_recovery_state() {
	local candidate_sha=$1
	local expected_main_sha=$2
	local expected_fork_sha=$3
	local expected_upstream_sha=$4
	local completed_sha=$5
	local null_oid
	null_oid=$(null_object_id)
	if ! {
		printf 'start\n'
		printf 'delete refs/heads/%s %s\n' "$RECOVERY_BRANCH" "$candidate_sha"
		printf 'delete %s %s\n' "$EXPECTED_MAIN_REF" "$expected_main_sha"
		printf 'delete %s %s\n' "$EXPECTED_FORK_REF" "$expected_fork_sha"
		printf 'delete %s %s\n' "$EXPECTED_UPSTREAM_REF" "$expected_upstream_sha"
		if [[ -n $completed_sha ]]; then
			printf 'delete %s %s\n' "$COMPLETED_REF" "$completed_sha"
		else
			printf 'verify %s %s\n' \
				"$COMPLETED_REF" \
				"$null_oid"
		fi
		printf 'prepare\ncommit\n'
	} | git update-ref --stdin >/dev/null; then
		echo "Error: recovery state changed concurrently; preserving every recovery ref." >&2
		exit 1
	fi
}

rebase_in_progress() {
	[[ -d $(git rev-parse --git-path rebase-merge) || \
		-d $(git rev-parse --git-path rebase-apply) ]]
}

active_rebase_head() {
	local directory
	local head_file
	for directory in \
		"$(git rev-parse --git-path rebase-merge)" \
		"$(git rev-parse --git-path rebase-apply)"; do
		head_file="${directory}/head-name"
		if [[ -f $head_file ]]; then
			<"$head_file" read -r rebase_head
			printf '%s\n' "$rebase_head"
			return
		fi
	done
	return 1
}

record_completion_witness() {
	local recovery_sha=$1
	if ! git update-ref --stdin >/dev/null <<EOF
start
verify refs/heads/${RECOVERY_BRANCH} ${recovery_sha}
create ${COMPLETED_REF} ${recovery_sha}
prepare
commit
EOF
	then
		echo "Error: recovery candidate changed before completion could be witnessed." >&2
		echo "Every recovery ref remains preserved." >&2
		exit 1
	fi
}

print_recovery_guidance() {
	cat <<'EOF'
Interactive rebase paused before completion.
Finish it with:
  git rebase --continue
or abort workflow-owned recovery with:
  SYNC_RECOVERY=abort scripts/workflow/sync-fork-main.sh
After a successful continuation, adopt and push the preserved candidate with:
  SYNC_RECOVERY=complete scripts/workflow/sync-fork-main.sh
EOF
}

adopt_recovery_candidate() {
	local recovery_sha=$1
	local recorded_main_sha=$2
	local recorded_fork_sha=$3
	local recorded_upstream_sha=$4
	local completed_sha=$5
	if [[ $completed_sha != "$recovery_sha" ]]; then
		echo "Error: recovery candidate has no matching rebase-completion witness." >&2
		echo "The candidate remains preserved on ${RECOVERY_BRANCH}." >&2
		exit 1
	fi
	require_clean_worktree
	if ! git merge-base --is-ancestor "$recorded_upstream_sha" "$recovery_sha"; then
		echo "Error: recovery candidate is not based on the recorded release SHA." >&2
		exit 1
	fi
	if ! git update-ref --stdin >/dev/null <<EOF
start
verify refs/heads/${RECOVERY_BRANCH} ${recovery_sha}
verify ${EXPECTED_MAIN_REF} ${recorded_main_sha}
verify ${EXPECTED_FORK_REF} ${recorded_fork_sha}
verify ${EXPECTED_UPSTREAM_REF} ${recorded_upstream_sha}
verify ${COMPLETED_REF} ${completed_sha}
update refs/heads/${FORK_BRANCH} ${recovery_sha} ${recorded_main_sha}
prepare
commit
EOF
	then
		echo "Error: recovery authority changed concurrently." >&2
		echo "The completed candidate remains preserved on ${RECOVERY_BRANCH}." >&2
		exit 1
	fi
	git checkout "$FORK_BRANCH"
	clear_recovery_state \
		"$recovery_sha" \
		"$recorded_main_sha" \
		"$recorded_fork_sha" \
		"$recorded_upstream_sha" \
		"$completed_sha"
	require_candidate_state "$recovery_sha"
	printf '%s\n' "$recovery_sha"
}

resume_recovery() {
	local recovery_sha
	local stored_main_sha
	local stored_fork_sha
	local stored_upstream_sha
	local completed_sha
	require_complete_recovery_state
	if rebase_in_progress; then
		echo "Error: finish or abort the active rebase before resuming synchronisation." >&2
		exit 1
	fi
	recovery_sha=$(git rev-parse "refs/heads/${RECOVERY_BRANCH}")
	stored_main_sha=$(git rev-parse "$EXPECTED_MAIN_REF")
	stored_fork_sha=$(git rev-parse "$EXPECTED_FORK_REF")
	stored_upstream_sha=$(git rev-parse "$EXPECTED_UPSTREAM_REF")
	completed_sha=$(git rev-parse --verify --quiet "$COMPLETED_REF" || true)
	if [[ $completed_sha != "$recovery_sha" ]]; then
		echo "Error: recovery candidate has no matching rebase-completion witness." >&2
		echo "The candidate remains preserved on ${RECOVERY_BRANCH}." >&2
		exit 1
	fi
	if ! git merge-base --is-ancestor \
		"$stored_upstream_sha" \
		"$recovery_sha"; then
		echo "Error: recovery candidate is not a completed rebase onto the recorded release SHA." >&2
		echo "The candidate remains preserved on ${RECOVERY_BRANCH}." >&2
		exit 1
	fi
	if [[ $fork_sha != "$stored_fork_sha" || \
		$upstream_sha != "$stored_upstream_sha" ]]; then
		echo "Error: remote history changed while synchronisation was paused." >&2
		echo "The recovery candidate remains preserved on ${RECOVERY_BRANCH}." >&2
		exit 1
	fi
	adopt_recovery_candidate \
		"$recovery_sha" \
		"$stored_main_sha" \
		"$stored_fork_sha" \
		"$stored_upstream_sha" \
		"$completed_sha"
	candidate_sha=$recovery_sha
	fork_sha=$stored_fork_sha
}

abort_recovery() {
	local rebase_head
	local recovery_sha
	local recorded_main_sha
	local recorded_fork_sha
	local recorded_upstream_sha
	local completed_sha
	require_complete_recovery_state
	recovery_sha=$(git rev-parse "refs/heads/${RECOVERY_BRANCH}")
	recorded_main_sha=$(git rev-parse "$EXPECTED_MAIN_REF")
	recorded_fork_sha=$(git rev-parse "$EXPECTED_FORK_REF")
	recorded_upstream_sha=$(git rev-parse "$EXPECTED_UPSTREAM_REF")
	completed_sha=$(git rev-parse --verify --quiet "$COMPLETED_REF" || true)
	if rebase_in_progress; then
		if ! rebase_head=$(active_rebase_head) || \
			[[ $rebase_head != "refs/heads/${RECOVERY_BRANCH}" ]]; then
			echo "Error: active rebase is not owned by WPKernel synchronisation; refusing to abort it." >&2
			exit 1
		fi
		git rebase --abort
	fi
	if git show-ref --verify --quiet "refs/heads/${FORK_BRANCH}"; then
		git checkout "$FORK_BRANCH"
	fi
	clear_recovery_state \
		"$recovery_sha" \
		"$recorded_main_sha" \
		"$recorded_fork_sha" \
		"$recorded_upstream_sha" \
		"$completed_sha"
	echo "Synchronisation recovery state removed; ${FORK_BRANCH} was preserved."
}

complete_recovery() {
	local recovery_sha
	local stored_main_sha
	local stored_upstream_sha
	require_complete_recovery_state
	if rebase_in_progress; then
		echo "Error: rebase is still active; continue it before recording completion." >&2
		exit 1
	fi
	if [[ $(git symbolic-ref --quiet --short HEAD || true) != "$RECOVERY_BRANCH" ]]; then
		echo "Error: completion must be recorded from ${RECOVERY_BRANCH}." >&2
		exit 1
	fi
	require_clean_worktree
	recovery_sha=$(git rev-parse "refs/heads/${RECOVERY_BRANCH}")
	stored_main_sha=$(git rev-parse "$EXPECTED_MAIN_REF")
	if [[ $recovery_sha == "$stored_main_sha" ]]; then
		echo "Error: recovery candidate is unchanged from the pre-rebase main." >&2
		echo "An aborted or uncompleted rebase cannot be marked complete." >&2
		exit 1
	fi
	stored_upstream_sha=$(git rev-parse "$EXPECTED_UPSTREAM_REF")
	if ! git merge-base --is-ancestor \
		"$stored_upstream_sha" \
		"$recovery_sha"; then
		echo "Error: recovery candidate is not based on the recorded release SHA." >&2
		exit 1
	fi
	record_completion_witness "$recovery_sha"
}
