#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_PATH="$(ls "${RUNNER_TEMP}"/artifacts/*.aab "${RUNNER_TEMP}"/artifacts/*.apk 2>/dev/null | head -n 1 || true)"
if [ -z "${ARTIFACT_PATH}" ]; then
  echo "No build artifact found in ${RUNNER_TEMP}/artifacts" >&2
  exit 1
fi

echo "path=${ARTIFACT_PATH}" >> "${GITHUB_OUTPUT}"
