# Authoring and upstream promotion

Verify the checkout root, remote and dirty state before editing. Public
distribution and documentation deployment live in
[wpkernel/wpkernel](https://github.com/wpkernel/wpkernel). Reviewed authoring
work lands in [theGeekist/wpkernel-1](https://github.com/theGeekist/wpkernel-1)
first. Retain the WordPress framework identity.

For changes affecting documentation deployment, including package or workspace
manifests, use this sequence:

1. Create an authoring feature branch containing current upstream work and open
   a PR into the authoring repository's `main`. Obtain independent review and
   passing PR CI.
2. Merge the authoring PR using the repository's squash policy. Wait for
   successful push CI on authoring `main` at the resulting commit; PR CI alone
   is insufficient.
3. Open the upstream PR from authoring `main` into upstream `main`. Preserve
   the reviewed source tree exactly. If either `main` changes, reconcile in
   authoring, then repeat CI and review the resulting diff.
4. After the reviewed promotion is merged, verify that upstream **Deploy
   Documentation** succeeds. A green upstream CI run does not certify
   deployment. Retain both source revisions and workflow URLs.

The authoring feature-branch PR is required. The prohibition applies to opening
a deployment-affecting PR directly against upstream from an upstream branch or
an authoring feature branch. The upstream promotion must come from authoring
`main` and have a real merged authoring receipt, identical Git trees, and
successful authoring-main push CI. Do not bypass or manufacture those checks.

The separate **Check documentation promotion source** status uses trusted base
code and read-only PR metadata. Review it before merging; it does not configure
branch protection. Its first adoption is a reviewed bootstrap: a new workflow
cannot certify its own PR before it exists on the trusted default branch. Only
claim that admission ran when its actual workflow receipt is present.

For the package-root and serial v1-adapter boundary referenced by this repository's Pipeline guidance, see the [Pipeline package compatibility note](internal/pipeline/PACKAGE-COMPATIBILITY.md).
