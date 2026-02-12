#!/usr/bin/env bash
set -euo pipefail

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git fetch origin "${GITHUB_REF_NAME}"
git checkout -B "${GITHUB_REF_NAME}" "origin/${GITHUB_REF_NAME}"

node scripts/actions/increment-android-version-code.mjs
git add app.json
if git diff --cached --quiet; then
  echo "No app.json changes detected; skipping commit."
  exit 0
fi

git commit -m "incremented version code"

if git push origin "HEAD:${GITHUB_REF_NAME}"; then
  echo "Version bump pushed successfully."
  exit 0
fi

echo "Initial push rejected; retrying once after rebase."
git fetch origin "${GITHUB_REF_NAME}"
git rebase "origin/${GITHUB_REF_NAME}"
git push origin "HEAD:${GITHUB_REF_NAME}"
