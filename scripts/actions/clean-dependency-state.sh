#!/usr/bin/env bash
set -euo pipefail

rm -rf node_modules
rm -rf ~/.bun/install/cache
rm -rf ~/.gradle/caches ~/.gradle/wrapper
rm -rf "${RUNNER_TEMP}/eas-local-build" "${RUNNER_TEMP}/artifacts"
