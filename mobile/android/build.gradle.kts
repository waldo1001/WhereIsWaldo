// Top-level build file: plugin versions are declared once here (with apply false) so a future
// second module (specs/003-android-client.md still plans single-module for A1) applies them
// without repeating — and can't drift out of sync — a version.
plugins {
    id("com.android.application") version "9.2.0" apply false
    id("org.jetbrains.kotlin.android") version "2.3.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.3.0" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.3.0" apply false
}
