---
name: bunkialo-android-development
description: Set up, build, test, and run Bunkialo's Expo Android app and native Wear OS companion with Android SDKs and emulators.
---

# Bunkialo Android development

Use this skill for Android SDK setup, the phone emulator, the Wear OS emulator,
native builds, and device checks in this repository. Keep the root
[`AGENTS.md`](../../../AGENTS.md) in force. Use the existing checkout; do not
create a Git worktree.

Read the installed Android CLI skills when they apply:

- [`android-cli`](../android-cli/SKILL.md) for SDK packages, AVDs, and device
  inspection.
- [`testing-setup`](../testing-setup/SKILL.md) when changing Android test
  infrastructure.
- [`wear-compose-m3`](../wear-compose-m3/SKILL.md) when changing the Compose
  watch UI.

## Environment

The cloud environment stores tools and caches outside the application source:

```bash
export BUN_INSTALL="${BUN_INSTALL:-/workspace/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
export ANDROID_HOME="${ANDROID_HOME:-/workspace/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-/workspace/.android}"
export ANDROID_AVD_HOME="${ANDROID_AVD_HOME:-/workspace/.android/avd}"
export ANDROID_EMULATOR_HOME="${ANDROID_EMULATOR_HOME:-/workspace/.android}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/workspace/.gradle}"
export JAVA_HOME="${JAVA_HOME:-/workspace/jdk21}"
export PATH="$BUN_INSTALL/bin:$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export EXPO_NO_TELEMETRY=1
export GRADLE_OPTS="${GRADLE_OPTS:-} -Dhttps.proxyHost=proxy -Dhttps.proxyPort=8080 -Dhttp.proxyHost=proxy -Dhttp.proxyPort=8080 -Djavax.net.ssl.trustStore=/workspace/java-cacerts -Djavax.net.ssl.trustStorePassword=changeit"
```

The phone app uses Expo SDK 54, React Native 0.81, Android API 36, and NDK
`27.1.12297006`. The native watch app uses Gradle 9.5, AGP 9.3.2, JDK 21, and
Android API 37.0. The managed environment installs the Android command-line
tools and emulator under `/workspace/android-sdk`. Gradle uses the environment
proxy and a workspace trust store containing the runtime-provided proxy CA;
keep TLS verification enabled.

Install the locked JavaScript dependencies from the repository root and the
landing app directory:

```bash
bun install --frozen-lockfile
(cd bunkialo-landing && bun install --frozen-lockfile)
```

## SDK and emulator images

The configured phone image is Android 36 Google APIs for x86_64:

```text
system-images;android-36;google_apis;x86_64
```

The watch image is the signed Wear OS image on Android API 37.0 for x86_64:

```text
system-images;android-37.0;android-wear-signed;x86_64
```

The SDK also needs `platform-tools`, `emulator`, `platforms;android-36`,
`platforms;android-37.0`, `build-tools;36.0.0`, NDK `27.1.12297006`, and CMake
`3.22.1`. Use the Android CLI documented in the installed `android-cli` skill
or `sdkmanager` to add packages. Do not commit SDK files or generated native
projects.

AVDs are named `Bunkialo_Phone_API_36` and `Bunkialo_Wear_API_37`. Check them
with:

```bash
emulator -list-avds
adb devices -l
```

If an AVD is missing, create it with `avdmanager` using the matching image
above and the Pixel phone or round Wear OS device profile listed by
`avdmanager list device`. Keep the phone and watch profiles separate; do not
use an Android phone image for watch UI validation.

On a Linux host with `/dev/kvm`, start an AVD with hardware acceleration. For a
headless container, add `-no-window -no-audio -no-boot-anim -no-snapshot
-no-metrics -gpu software`.
Check acceleration first with `emulator -accel-check`. If KVM is unavailable,
`-accel off` can attempt software CPU emulation, but it may be too slow for
reliable UI tests. Add `-no-metrics` to emulator launches. The AVD data lives
under `$ANDROID_AVD_HOME`. Do not report the emulator as ready until
`adb shell getprop sys.boot_completed` returns `1`.

Boot one emulator at a time on small cloud hosts. Boot the phone and watch
simultaneously only when checking pairing or Wear Data Layer behavior; the
phone and watch both need Google Play services for those checks.

## Build and test

Run the existing JS checks from the repo root:

```bash
bun test
bun run lint
bunx tsc --noEmit
```

Generate the ignored native Android project when it is absent, then build an
x86_64 debug APK for the phone emulator:

```bash
EXPO_NO_TELEMETRY=1 bunx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleDebug -PreactNativeArchitectures=x86_64
```

Build the native watch app from `wear-os/`:

```bash
cd wear-os
./gradlew :app:assembleDebug
```

The root `bun test` suite covers app modules. The Wear OS module currently has
no test source files, so its debug APK build is the available compilation
check. When an emulator boots, install the phone APK with `adb install -r`
from `android/app/build/outputs/apk/debug/` and the watch APK from
`wear-os/app/build/outputs/apk/debug/`. Check the running app with `adb logcat`
and a representative screen flow.

Release deployment uses the signing requirements in `wear-os/AGENTS.md` and
must not be run as part of local setup.
