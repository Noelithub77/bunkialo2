plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val easKeystorePath = providers.environmentVariable("NEAROS_EAS_KEYSTORE_PATH").orNull
val easStorePassword = providers.environmentVariable("NEAROS_EAS_STORE_PASSWORD").orNull
val easKeyAlias = providers.environmentVariable("NEAROS_EAS_KEY_ALIAS").orNull
val easKeyPassword = providers.environmentVariable("NEAROS_EAS_KEY_PASSWORD").orNull
val hasEasSigning = listOf(
    easKeystorePath,
    easStorePassword,
    easKeyAlias,
    easKeyPassword,
).all { value -> !value.isNullOrBlank() }
val isReleaseTask = gradle.startParameter.taskNames.any { taskName ->
    taskName.contains("Release", ignoreCase = true)
}

if (isReleaseTask && !hasEasSigning) {
    error("Release builds require the EAS signing environment variables.")
}

android {
    namespace = "com.codialo.bunkialo"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.codialo.bunkialo"
        minSdk = 36
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

    }

    signingConfigs {
        if (hasEasSigning) {
            create("eas") {
                storeFile = file(requireNotNull(easKeystorePath))
                storePassword = requireNotNull(easStorePassword)
                keyAlias = requireNotNull(easKeyAlias)
                keyPassword = requireNotNull(easKeyPassword)
            }
        }
    }

    buildTypes {
        release {
            if (hasEasSigning) {
                signingConfig = signingConfigs.getByName("eas")
            }
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    useLibrary("wear-sdk")
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.activity.compose)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling)
    implementation(libs.core.splashscreen)
    implementation(libs.guava)
    implementation(libs.play.services.wearable)
    implementation(libs.protolayout)
    implementation(libs.protolayout.material3)
    implementation(libs.tiles)
    implementation(libs.tiles.tooling.preview)
    implementation(libs.ui)
    implementation(libs.ui.graphics)
    implementation(libs.ui.tooling.preview)
    implementation(libs.watchface.complications.data.source.ktx)
    implementation(libs.wear.remote.interactions)
    implementation(libs.wear.tooling.preview)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.ui.test.junit4)
    debugImplementation(libs.tiles.renderer)
    debugImplementation(libs.tiles.tooling)
    debugImplementation(libs.ui.test.manifest)
    debugImplementation(libs.ui.tooling)
}
