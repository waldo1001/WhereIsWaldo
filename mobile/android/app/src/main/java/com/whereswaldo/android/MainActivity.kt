package com.whereswaldo.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import com.whereswaldo.android.auth.DevAuthProvider
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
                WaldoNavHost(
                    container = container,
                    homeViewModel = homeViewModel,
                    onSignIn = {
                        // Dev-only: AUTH_MODE=insecure-local wires a DevAuthProvider; there is
                        // nothing to sign in to in AUTH_MODE=firebase yet (H1/A2 replace this
                        // with a real Firebase Auth sign-in flow).
                        (container.authProvider as? DevAuthProvider)?.signInDev("dev-user-1")
                    },
                )
            }
        }
    }
}
