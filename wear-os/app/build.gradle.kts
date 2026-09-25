import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations
import javax.inject.Inject

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

abstract class GenerateWearMessMenuTask @Inject constructor(
    private val execOperations: ExecOperations,
) : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val menuSource: RegularFileProperty

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val generatorScript: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @TaskAction
    fun generateMenu() {
        execOperations.exec {
            commandLine(
                "bun",
                "run",
                generatorScript.get().asFile.absolutePath,
                outputDirectory.file("raw/mess_menu.json").get().asFile.absolutePath,
            )
        }
    }
}

val repositoryRoot = rootProject.projectDir.parentFile
val generateWearMessMenu = tasks.register<GenerateWearMessMenuTask>("generateWearMessMenu") {
    menuSource.set(repositoryRoot.resolve("src/data/mess.ts"))
    generatorScript.set(repositoryRoot.resolve("scripts/generate-wear-mess-menu.ts"))
    outputDirectory.set(layout.buildDirectory.dir("generated/mess-menu-res"))
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
        applicationId = "com.codialo.Bunkialo2"
        minSdk = 36
        targetSdk = 37
        // Keep Wear releases in their own high range so they never collide with phone builds.
        versionCode = 1_000_001
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

androidComponents {
    onVariants { variant ->
        variant.sources.res?.addGeneratedSourceDirectory(
            generateWearMessMenu,
            GenerateWearMessMenuTask::outputDirectory,
        )
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
