#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${HOME}/.gradle"
cat > "${HOME}/.gradle/gradle.properties" <<'EOF'
org.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
# Keep Kotlin inside the Gradle memory budget on hosted runners.
kotlin.compiler.execution.strategy=in-process
org.gradle.workers.max=2
org.gradle.caching=true
org.gradle.parallel=false
# React Native library codegen must be configured before CMake autolinking.
org.gradle.configureondemand=false
org.gradle.daemon=false
EOF
