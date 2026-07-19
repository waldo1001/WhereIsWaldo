plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.whereswaldo.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.whereswaldo.android"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        debug {
            // Android emulator's documented loopback alias to the host machine, where
            // `func start` (backend/README.md) listens locally — not a third-party URL, and not
            // reachable outside the emulator. See network_security_config.xml for the matching
            // cleartext carve-out, and specs/003-android-client.md §13 for the H1 hand-off.
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:7071/api/\"")
            buildConfigField("String", "AUTH_MODE", "\"insecure-local\"")
            buildConfigField("String", "FIREBASE_PROJECT_ID", "\"waldo-dev-placeholder\"")
        }
        release {
            isMinifyEnabled = false // TODO(H1): enable + tune proguard-rules.pro before shipping
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Obviously-fake placeholder host (never resolves) — TODO(H1) replaces with the real
            // Function App URL once docs/azure-setup.md has been run (specs/003 §13).
            buildConfigField("String", "BASE_URL", "\"https://CHANGE-ME.azurewebsites.net/api/\"")
            buildConfigField("String", "AUTH_MODE", "\"firebase\"")
            buildConfigField("String", "FIREBASE_PROJECT_ID", "\"CHANGE-ME\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    testOptions {
        unitTests {
            isReturnDefaultValues = true
            isIncludeAndroidResources = false
        }
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.activity:activity-compose:1.9.3")

    implementation(platform("androidx.compose:compose-bom:2025.09.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // Offline fix-queue periodic worker scaffold (specs/003 §10.5) — no enqueue call sites wired yet.
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // Networking (specs/003 §5): Retrofit + OkHttp + kotlinx.serialization, chosen over Ktor for
    // its mature Android ecosystem, suspend-fun support, and predictable Response<T> based
    // interface-per-endpoint testing story.
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.1")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
