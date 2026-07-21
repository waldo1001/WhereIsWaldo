package com.whereswaldo.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import com.whereswaldo.android.ui.designsystem.WaldoTheme
import com.whereswaldo.android.ui.home.HomeViewModel
import com.whereswaldo.android.ui.home.HomeViewModelFactory
import com.whereswaldo.android.ui.nav.WaldoNavHost

/** The single Activity (Compose Navigation pattern, specs/003-android-client.md §12). Registers
 * itself with [AppContainer] as the current foreground Activity (specs/006-phone-auth.md §6,
 * specs/003 §7) — `FirebaseAuthProvider`'s phone verification needs a live `Activity` for Play
 * Integrity / reCAPTCHA app verification. */
class MainActivity : ComponentActivity() {

    private val container get() = (application as WaldoApplication).container

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        container.onActivityStarted(this)

        setContent {
            WaldoTheme {
                val homeViewModel: HomeViewModel = viewModel(
                    factory = HomeViewModelFactory(container.authProvider, container.deviceRegistrar),
                )
                // Sign-in navigation lives inside WaldoNavHost itself (specs/003 §7, §12) — it
                // owns the NavController the real path needs.
                WaldoNavHost(container = container, homeViewModel = homeViewModel)
            }
        }
    }

    override fun onDestroy() {
        container.onActivityStopped(this)
        super.onDestroy()
    }
}
