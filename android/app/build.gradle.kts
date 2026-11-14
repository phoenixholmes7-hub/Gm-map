import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.gmmap.app"
    compileSdk = 36

    defaultConfig {
        // Change this to a name you own before publishing to an app store; it can't change after.
        applicationId = "com.gmmap.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    signingConfigs {
        // A debug key checked into the repo so every build (CI or local) is signed the same way
        // and can be installed over the previous one. It is NOT a release key.
        getByName("debug") {
            storeFile = rootProject.file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // The web app at the repo root is the UI. It is copied into the APK's assets at build time
    // so there is a single copy of it in source control.
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("webassets").get().asFile)
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

val syncWeb by tasks.registering(Sync::class) {
    from(rootProject.projectDir.parentFile) {
        include("index.html", "styles.css", "manifest.webmanifest", "src/**", "vendor/**", "icons/**")
    }
    into(layout.buildDirectory.dir("webassets/www"))
}

tasks.named("preBuild") {
    dependsOn(syncWeb)
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.webkit:webkit:1.14.0")
}
