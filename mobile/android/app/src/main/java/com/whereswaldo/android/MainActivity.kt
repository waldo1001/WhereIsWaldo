package com.whereswaldo.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import com.whereswaldo.android.ui.designsystem.WaldoTheme
import com.whereswaldo.android.ui.home.HomeViewModel
import com.whereswaldo.android.ui.home.HomeViewModelFactory
import com.whereswaldo.android.ui.nav.WaldoNavHost

/** The single Activity (Compose Navigation pattern, specs/003-android-client.md §12). */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val container = (application as WaldoApplication).container

        setContent {
            WaldoTheme {
                val homeViewModel: HomeViewModel = viewModel(
                    factory = HomeViewModelFactory(container.authProvider, container.deviceRegistrar),
                )
                // Sign-in wiring (dev shortcut vs real Firebase screen) lives inside WaldoNavHost
                // itself now (specs/003 §7, §12) — it owns the NavController the real path needs.
                WaldoNavHost(container = container, homeViewModel = homeViewModel)
            }
        }
    }
}
