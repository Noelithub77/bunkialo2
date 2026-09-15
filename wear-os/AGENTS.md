# Bunkialo

Native Kotlin/Compose Wear OS app for the timetable and tile experience.

## Layout

- `app/src/main/java/com/codialo/bunkialo/` contains the app, timetable, tile, and complication code.
- `app/build.gradle.kts` defines the `com.codialo.bunkialo` application and its release signing requirements.
- `scripts/` contains operator commands for deploying to the connected watch.

## Operator scripts

- `./scripts/deploy-prod` builds the signed release APK, discovers the Wear OS watch through ADB mDNS, removes the installed package, and installs the release APK.
- `./scripts/deploy-dev` builds the debug APK, discovers the Wear OS watch through ADB mDNS, removes the installed package, and installs the debug APK.
- Both scripts intentionally use the package ID `com.codialo.bunkialo` and never hardcode a watch IP address or serial.
- Production deployment requires `NEAROS_EAS_KEYSTORE_PATH`, `NEAROS_EAS_STORE_PASSWORD`, `NEAROS_EAS_KEY_ALIAS`, and `NEAROS_EAS_KEY_PASSWORD`.
