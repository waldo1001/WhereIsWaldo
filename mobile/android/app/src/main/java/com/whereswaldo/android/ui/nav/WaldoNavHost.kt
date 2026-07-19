package com.whereswaldo.android.ui.nav

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.whereswaldo.android.ui.home.HomeRoute
import com.whereswaldo.android.ui.home.HomeViewModel

/** Navigation scaffold (specs/003-android-client.md §12) — a single destination today; A2 adds
 * the map/history/geofences/locate/settings screens listed in [Destinations]. */
@Composable
fun WaldoNavHost(
    homeViewModel: HomeViewModel,
    onSignIn: () -> Unit,
    navController: NavHostController = rememberNavController(),
) {
    NavHost(navController = navController, startDestination = Destinations.Home.route) {
        composable(Destinations.Home.route) {
            HomeRoute(viewModel = homeViewModel, onSignIn = onSignIn)
        }
    }
}
