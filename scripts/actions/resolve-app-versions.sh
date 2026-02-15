#!/usr/bin/env bash
set -euo pipefail

PACKAGE_VERSION=$(node -p "require('./package.json').version")
EAS_JSON=$(eas build:version:get -p android -e production --json --non-interactive 2>/dev/null || true)
VERSION_CODE=$(
  EAS_JSON="$EAS_JSON" node -p "JSON.parse(process.env.EAS_JSON || '{}').versionCode || ''"
)

echo "package_version=$PACKAGE_VERSION" >> "$GITHUB_OUTPUT"
echo "app_version=$PACKAGE_VERSION" >> "$GITHUB_OUTPUT"
echo "version_code=$VERSION_CODE" >> "$GITHUB_OUTPUT"
