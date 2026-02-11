#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${HOME}/.gradle"
cat > "${HOME}/.gradle/gradle.properties" <<'EOF'
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
kotlin.daemon.jvmargs=-Xmx2g
org.gradle.workers.max=2
org.gradle.caching=true
org.gradle.parallel=true
org.gradle.configureondemand=true
org.gradle.daemon=false
EOF
