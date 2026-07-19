package com.whereswaldo.android.ui.nav

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.whereswaldo.android.AppContainer
import com.whereswaldo.android.ui.geofences.GeofencesRoute
import com.whereswaldo.android.ui.geofences.GeofencesViewModel
import com.whereswaldo.android.ui.geofences.GeofencesViewModelFactory
import com.whereswaldo.android.ui.history.HistoryRoute
import com.whereswaldo.android.ui.history.HistoryViewModel
import com.whereswaldo.android.ui.history.HistoryViewModelFactory
import com.whereswaldo.android.ui.home.HomeRoute
import com.whereswaldo.android.ui.home.HomeViewModel
import com.whereswaldo.android.ui.invites.InvitesRoute
import com.whereswaldo.android.ui.invites.InvitesViewModel
import com.whereswaldo.android.ui.invites.InvitesViewModelFactory
import com.whereswaldo.android.ui.locate.LocateRoute
import com.whereswaldo.android.ui.locate.LocateViewModel
import com.whereswaldo.android.ui.locate.LocateViewModelFactory
import com.whereswaldo.android.ui.map.MapRoute
import com.whereswaldo.android.ui.map.MapViewModel
import com.whereswaldo.android.ui.map.MapViewModelFactory
import com.whereswaldo.android.ui.settings.SettingsRoute
import com.whereswaldo.android.ui.settings.SettingsViewModel
import com.whereswaldo.android.ui.settings.SettingsViewModelFactory

/**
 * Navigation scaffold (specs/003-android-client.md §12). A1 shipped only [Destinations.Home]; A2
 * wires the rest — [Destinations.Map]/[Destinations.History]/[Destinations.Geofences]/
 * [Destinations.Locate]/[Destinations.Settings]/[Destinations.Invites] — each screen's
 * `ViewModel` built from [container]'s single [com.whereswaldo.android.network.WaldoApiClient]
 * (it implements all five 001 §3–§7 port interfaces, so every factory here just narrows it to the
 * one it needs).
 *
 * [Destinations.Locate] takes its target from a locally-`remember`ed `pendingLocateTarget` (set
 * by tapping a roster row in [MapRoute]) rather than a nav-graph path argument — see
 * [Destinations]'s doc for why.
 */
@Composable
fun WaldoNavHost(
    container: AppContainer,
    homeViewModel: HomeViewModel,
    onSignIn: () -> Unit,
    navController: NavHostController = rememberNavController(),
) {
    var pendingLocateTarget by remember { mutableStateOf<Pair<String, String>?>(null) }

    NavHost(navController = navController, startDestination = Destinations.Home.route) {
        composable(Destinations.Home.route) {
            HomeRoute(
                viewModel = homeViewModel,
                onSignIn = onSignIn,
                onNavigate = { route -> navController.navigate(route) },
            )
        }

        composable(Destinations.Map.route) {
            val mapViewModel: MapViewModel = viewModel(factory = MapViewModelFactory(container.waldoApiClient))
            MapRoute(
                viewModel = mapViewModel,
                mapRenderer = container.mapRenderer,
                onSelectMember = { userId, displayName ->
                    pendingLocateTarget = userId to displayName
                    navController.navigate(Destinations.Locate.route)
                },
            )
        }

        composable(Destinations.History.route) {
            val historyViewModel: HistoryViewModel = viewModel(factory = HistoryViewModelFactory(container.waldoApiClient))
            HistoryRoute(viewModel = historyViewModel)
        }

        composable(Destinations.Geofences.route) {
            val geofencesViewModel: GeofencesViewModel =
                viewModel(factory = GeofencesViewModelFactory(container.waldoApiClient))
            GeofencesRoute(viewModel = geofencesViewModel)
        }

        composable(Destinations.Locate.route) {
            val target = pendingLocateTarget
            val locateViewModel: LocateViewModel = viewModel(factory = LocateViewModelFactory(container.waldoApiClient))
            LocateRoute(
                viewModel = locateViewModel,
                targetUserId = target?.first.orEmpty(),
                targetDisplayName = target?.second ?: "family member",
            )
        }

        composable(Destinations.Settings.route) {
            val settingsViewModel: SettingsViewModel = viewModel(
                factory = SettingsViewModelFactory(container.waldoApiClient, container.waldoApiClient),
            )
            SettingsRoute(viewModel = settingsViewModel)
        }

        composable(Destinations.Invites.route) {
            val invitesViewModel: InvitesViewModel = viewModel(factory = InvitesViewModelFactory(container.waldoApiClient))
            InvitesRoute(viewModel = invitesViewModel)
        }
    }
}
