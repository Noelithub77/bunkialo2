#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${RUNNER_TEMP}/artifacts"
bunx eas build --local \
  --non-interactive \
  --clear-cache \
  --output="${RUNNER_TEMP}/artifacts/app-preview.apk" \
  --platform=android \
  --profile=preview
