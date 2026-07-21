package com.whereswaldo.android.ui.nav

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import com.whereswaldo.android.AppContainer
import com.whereswaldo.android.auth.AuthState
import com.whereswaldo.android.network.PlanLimits
import com.whereswaldo.android.ui.geofences.GeofencesRoute
import com.whereswaldo.android.ui.geofences.GeofencesViewModel
import com.whereswaldo.android.ui.geofences.GeofencesViewModelFactory
import com.whereswaldo.android.ui.groups.CreateGroupRoute
import com.whereswaldo.android.ui.groups.CreateGroupViewModel
import com.whereswaldo.android.ui.groups.CreateGroupViewModelFactory
import com.whereswaldo.android.ui.groups.GroupDetailRoute
import com.whereswaldo.android.ui.groups.GroupDetailViewModel
import com.whereswaldo.android.ui.groups.GroupDetailViewModelFactory
import com.whereswaldo.android.ui.groups.GroupJoinCodeSanitizer
import com.whereswaldo.android.ui.groups.GroupJoinRoute
import com.whereswaldo.android.ui.groups.GroupJoinViewModel
import com.whereswaldo.android.ui.groups.GroupJoinViewModelFactory
import com.whereswaldo.android.ui.groups.GroupMapRoute
import com.whereswaldo.android.ui.groups.GroupMapViewModel
import com.whereswaldo.android.ui.groups.GroupMapViewModelFactory
import com.whereswaldo.android.ui.groups.GroupsListRoute
import com.whereswaldo.android.ui.groups.GroupsListUiState
import com.whereswaldo.android.ui.groups.GroupsListViewModel
import com.whereswaldo.android.ui.groups.GroupsListViewModelFactory
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
import com.whereswaldo.android.ui.signin.SignInRoute
import com.whereswaldo.android.ui.signin.SignInViewModel
import com.whereswaldo.android.ui.signin.SignInViewModelFactory

/**
 * Navigation scaffold (specs/003-android-client.md §12). A1 shipped only [Destinations.Home]; A2
 * wires the rest — [Destinations.Map]/[Destinations.History]/[Destinations.Geofences]/
 * [Destinations.Locate]/[Destinations.Settings]/[Destinations.Invites] — each screen's
 * `ViewModel` built from [container]'s single [com.whereswaldo.android.network.WaldoApiClient]
 * (it implements all five 001 §3–§7 port interfaces, so every factory here just narrows it to the
 * one it needs). [Destinations.SignIn] (§7) hosts the phone sign-in screen regardless of
 * `container`'s `authProvider` implementation; a [LaunchedEffect] on `authState` pops this screen
 * once sign-in succeeds, since that's when `authState` flips to `SignedIn`.
 *
 * [Destinations.Locate] takes its target from a locally-`remember`ed `pendingLocateTarget` (set
 * by tapping a roster row in [MapRoute]) rather than a nav-graph path argument — see
 * [Destinations]'s doc for why.
 *
 * Phone sign-in (specs/006-phone-auth.md): [Destinations.SignIn] is reached the same way in every
 * build variant, dev included — the former `DevAuthProvider` short-circuit (a dev sign-in button
 * bypassing the screen entirely) is removed, so the two-step phone UI is actually exercised
 * locally against `AUTH_MODE=insecure-local` (003 §7).
 *
 * **A5 additions** (specs/005-temporary-groups.md; specs/003 §12.2) — [Destinations.Groups] /
 * [Destinations.GroupCreate] / [Destinations.GroupDetail] / [Destinations.GroupMap] /
 * [Destinations.GroupJoin]: `GroupsRoute`'s create/join buttons stash the caller's `limits`/
 * `needsDisplayName` (from its own `GET /groups` load) in `pendingCreateContext` before
 * navigating — the same "remembered local state instead of a nav-graph argument" pattern
 * [Destinations]'s own doc describes for `Locate`, since [PlanLimits] and a `Boolean` aren't
 * URL-safe path segments either. [Destinations.GroupDetail]/[Destinations.GroupMap] instead use a
 * real `{groupId}` path argument (safe, no encoding risk — see [Destinations.GroupDetail]'s doc).
 * [Destinations.GroupJoin] additionally declares a [navDeepLink] for `waldo://group-join?code=…`
 * — the app's first and only external deep link — whose `code` query argument is run through
 * [GroupJoinCodeSanitizer] **before** it ever reaches [GroupJoinRoute], since it is untrusted
 * external input (any app, or a malicious link, can launch this intent with an arbitrary string).
 */
@Composable
fun WaldoNavHost(
    container: AppContainer,
    homeViewModel: HomeViewModel,
    navController: NavHostController = rememberNavController(),
) {
    var pendingLocateTarget by remember { mutableStateOf<Pair<String, String>?>(null) }
    var pendingCreateContext by remember { mutableStateOf<GroupsListUiState.Content?>(null) }
    var pendingJoinContext by remember { mutableStateOf<GroupsListUiState.Content?>(null) }

    val authState by container.authProvider.authState.collectAsState()
    LaunchedEffect(authState) {
        if (authState is AuthState.SignedIn && navController.currentDestination?.route == Destinations.SignIn.route) {
            navController.popBackStack()
        }
    }

    NavHost(navController = navController, startDestination = Destinations.Home.route) {
        composable(Destinations.Home.route) {
            HomeRoute(
                viewModel = homeViewModel,
                onSignIn = { navController.navigate(Destinations.SignIn.route) },
                onNavigate = { route -> navController.navigate(route) },
            )
        }

        composable(Destinations.SignIn.route) {
            val signInViewModel: SignInViewModel =
                viewModel(factory = SignInViewModelFactory(container.authProvider))
            SignInRoute(viewModel = signInViewModel)
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

        // --- A5: groups (specs/005-temporary-groups.md; specs/003 §12.2) ---

        composable(Destinations.Groups.route) {
            val groupsListViewModel: GroupsListViewModel =
                viewModel(factory = GroupsListViewModelFactory(container.waldoApiClient, container.waldoApiClient))
            GroupsListRoute(
                viewModel = groupsListViewModel,
                onCreateGroup = { content ->
                    pendingCreateContext = content
                    navController.navigate(Destinations.GroupCreate.route)
                },
                onJoinGroup = { content ->
                    pendingJoinContext = content
                    navController.navigate(Destinations.GroupJoin.route)
                },
                onOpenGroup = { groupId -> navController.navigate(Destinations.GroupDetail.createRoute(groupId)) },
                onManageFamily = { navController.navigate(Destinations.Invites.route) },
            )
        }

        composable(Destinations.GroupCreate.route) {
            val context = pendingCreateContext
            val createGroupViewModel: CreateGroupViewModel = viewModel(
                factory = CreateGroupViewModelFactory(
                    groupsApi = container.waldoApiClient,
                    limits = context?.limits,
                    needsDisplayName = context?.needsDisplayName ?: false,
                ),
            )
            CreateGroupRoute(
                viewModel = createGroupViewModel,
                onCreated = { navController.popBackStack() },
            )
        }

        composable(
            route = Destinations.GroupJoin.ROUTE_WITH_ARG,
            arguments = listOf(
                navArgument(Destinations.GroupJoin.ARG_CODE) {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                },
            ),
            deepLinks = listOf(navDeepLink { uriPattern = Destinations.GroupJoin.DEEP_LINK_URI_PATTERN }),
        ) { backStackEntry ->
            val rawCode = backStackEntry.arguments?.getString(Destinations.GroupJoin.ARG_CODE)
            // The deep link's `code` is untrusted external input — sanitize before it ever
            // reaches the screen/StateHolder; an unparsable code silently prefills empty rather
            // than being trusted as-is.
            val sanitizedCode = rawCode?.let { GroupJoinCodeSanitizer.sanitize(it) }.orEmpty()
            val context = pendingJoinContext
            val groupJoinViewModel: GroupJoinViewModel = viewModel(
                factory = GroupJoinViewModelFactory(container.waldoApiClient, context?.needsDisplayName ?: false),
            )
            GroupJoinRoute(
                viewModel = groupJoinViewModel,
                prefillCode = sanitizedCode,
                // Not a plain popBackStack: GroupJoin is this app's only deep-link destination, so
                // a cold app start via waldo://group-join can leave a back stack that never
                // contains Destinations.Groups at all — popBackStack(Groups, ...) would silently
                // no-op there, stranding the user on this (now-stale) screen. navigate() always
                // lands on Groups regardless of how this screen was reached; popUpTo(Home) plus
                // launchSingleTop avoids stacking a redundant entry on the common in-app path
                // (Groups -> GroupJoin -> Groups) and is itself a safe no-op if Home isn't present.
                onJoined = {
                    navController.navigate(Destinations.Groups.route) {
                        popUpTo(Destinations.Home.route)
                        launchSingleTop = true
                    }
                },
            )
        }

        composable(
            route = Destinations.GroupDetail.route,
            arguments = listOf(navArgument("groupId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val groupId = requireNotNull(backStackEntry.arguments?.getString("groupId"))
            val groupDetailViewModel: GroupDetailViewModel =
                viewModel(factory = GroupDetailViewModelFactory(groupId, container.waldoApiClient))
            GroupDetailRoute(
                viewModel = groupDetailViewModel,
                onLeft = { navController.popBackStack(Destinations.Groups.route, false) },
                onOpenMap = { id -> navController.navigate(Destinations.GroupMap.createRoute(id)) },
            )
        }

        composable(
            route = Destinations.GroupMap.route,
            arguments = listOf(navArgument("groupId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val groupId = requireNotNull(backStackEntry.arguments?.getString("groupId"))
            val groupMapViewModel: GroupMapViewModel =
                viewModel(factory = GroupMapViewModelFactory(groupId, container.waldoApiClient))
            GroupMapRoute(
                viewModel = groupMapViewModel,
                mapRenderer = container.mapRenderer,
                onExpired = { navController.popBackStack(Destinations.Groups.route, false) },
            )
        }
    }
}
