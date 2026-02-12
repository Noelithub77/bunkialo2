#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${RUNNER_TEMP}/artifacts"
bunx eas build --local \
  --non-interactive \
  --output="${RUNNER_TEMP}/artifacts/app-production.aab" \
  --platform=android \
  --profile=production
