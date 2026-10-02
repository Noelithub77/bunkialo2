plugins { id("com.android.application") }
android {
  namespace="com.codialo.attachmentchecks"
  compileSdk=37
  defaultConfig { applicationId="com.codialo.attachmentchecks";minSdk=29;targetSdk=37;versionCode=1;versionName="1";testInstrumentationRunner="androidx.test.runner.AndroidJUnitRunner" }

}
dependencies {
 androidTestImplementation("androidx.test:runner:1.7.0")
 androidTestImplementation("androidx.test.ext:junit:1.3.0")
}

val copyStorage by tasks.registering(Sync::class) {
 from("../../../modules/attachment-preview/android/src/main/java/expo/modules/attachmentpreview/LmsAttachmentStorage.kt")
 into("src/main/kotlin/expo/modules/attachmentpreview")
}
tasks.named("preBuild").configure { dependsOn(copyStorage) }
