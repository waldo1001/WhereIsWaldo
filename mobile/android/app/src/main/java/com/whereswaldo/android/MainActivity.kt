package com.whereswaldo.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import com.whereswaldo.android.ui.designsystem.WaldoTheme
import com.whereswaldo.android.ui.groups.GroupJoinHttpsLinkParser
import com.whereswaldo.android.ui.home.HomeViewModel
import com.whereswaldo.android.ui.home.HomeViewModelFactory
import com.whereswaldo.android.ui.nav.WaldoNavHost

/** The single Activity (Compose Navigation pattern, specs/003-android-client.md §12). Registers
 * itself with [AppContainer] as the current foreground Activity (specs/006-phone-auth.md §6,
 * specs/003 §7) — `FirebaseAuthProvider`'s phone verification needs a live `Activity` for Play
 * Integrity / reCAPTCHA app verification.
 *
 * **A6 addition** (specs/007-public-join-links.md, specs/003-android-client.md §12.3): the
 * launching `Intent`'s `data` `Uri` is checked once, here, against this app's configured
 * `https://{JOIN_LINK_HOST}/g#CODE` join-link shape via [GroupJoinHttpsLinkParser] — deliberately
 * *not* through Navigation Compose's own `navDeepLink` URI-pattern matching (used below this class
 * for the `waldo://group-join?code=…` link), since that matching is path/query-argument based and
 * the join code lives in the URL **fragment** (007 §1), read directly via `Uri.getFragment()`. The
 * parsed [GroupJoinHttpsLinkParser.Result] is then handed to [WaldoNavHost] once, at composition;
 * its own `LaunchedEffect(Unit)` performs the one-time navigation, so this never re-fires on later
 * in-app navigation back to [com.whereswaldo.android.ui.nav.Destinations.GroupJoin] (re-checking
 * the live `Activity.intent` from inside the nav graph itself would have exactly that staleness
 * bug, since `Activity.intent` doesn't change on in-app `NavController.navigate()` calls). */
class MainActivity : ComponentActivity() {

    private val container get() = (application as WaldoApplication).container

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        container.onActivityStarted(this)

        val launchingUri = intent?.data
        val httpsJoinLinkResult = GroupJoinHttpsLinkParser.parse(
            scheme = launchingUri?.scheme,
            host = launchingUri?.host,
            path = launchingUri?.path,
            fragment = launchingUri?.fragment,
            joinLinkHost = container.appConfig.joinLinkHost,
        )

        setContent {
            WaldoTheme {
                val homeViewModel: HomeViewModel = viewModel(
                    factory = HomeViewModelFactory(container.authProvider, container.deviceRegistrar),
                )
                // Sign-in navigation lives inside WaldoNavHost itself (specs/003 §7, §12) — it
                // owns the NavController the real path needs.
                WaldoNavHost(
                    container = container,
                    homeViewModel = homeViewModel,
                    httpsJoinLinkResult = httpsJoinLinkResult,
                )
            }
        }
    }

    override fun onDestroy() {
        container.onActivityStopped(this)
        super.onDestroy()
    }
}
