#!/usr/bin/env bash
set -euo pipefail

PACKAGE_VERSION=$(node -p "require('./package.json').version")
APP_VERSION=$(node -p "require('./app.json').expo.version")

echo "package_version=$PACKAGE_VERSION" >> "$GITHUB_OUTPUT"
echo "app_version=$APP_VERSION" >> "$GITHUB_OUTPUT"
