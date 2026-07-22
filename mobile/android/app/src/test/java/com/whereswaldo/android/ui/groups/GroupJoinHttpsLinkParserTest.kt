package com.whereswaldo.android.ui.groups

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * [GroupJoinHttpsLinkParser] is the gate every incoming `https://{host}/g#{code}` `Intent` `Uri`
 * passes through (specs/007-public-join-links.md §1/§4, specs/003-android-client.md §12.3) before
 * [com.whereswaldo.android.MainActivity] ever considers navigating to
 * [com.whereswaldo.android.ui.nav.Destinations.GroupJoin]. Mirrors
 * [GroupJoinCodeSanitizerTest]'s rigor for the sibling `waldo://` deep link.
 */
class GroupJoinHttpsLinkParserTest {

    private val host = "waldo-join.example.net"

    @Test
    fun `a well-formed link with a canonical fragment matches and sanitizes the code`() {
        val result = GroupJoinHttpsLinkParser.parse("https", host, "/g", "7F3K9QRZ", joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.Matched("7F3K9QRZ"), result)
    }

    @Test
    fun `the hyphenated display form is normalized identically to the deep-link path`() {
        val result = GroupJoinHttpsLinkParser.parse("https", host, "/g", "7f3k-9qrz", joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.Matched("7F3K9QRZ"), result)
    }

    @Test
    fun `wrong host is ignored, never mis-routed`() {
        val result = GroupJoinHttpsLinkParser.parse("https", "evil.example.net", "/g", "7F3K9QRZ", joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.NoMatch, result)
    }

    @Test
    fun `a host that merely contains the real host as a substring is ignored`() {
        val result = GroupJoinHttpsLinkParser.parse("https", "evil-$host.attacker.net", "/g", "7F3K9QRZ", joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.NoMatch, result)
    }

    @Test
    fun `wrong path is ignored`() {
        assertEquals(
            GroupJoinHttpsLinkParser.Result.NoMatch,
            GroupJoinHttpsLinkParser.parse("https", host, "/other", "7F3K9QRZ", joinLinkHost = host),
        )
        assertEquals(
            GroupJoinHttpsLinkParser.Result.NoMatch,
            GroupJoinHttpsLinkParser.parse("https", host, "/g/", "7F3K9QRZ", joinLinkHost = host),
        )
        assertEquals(
            GroupJoinHttpsLinkParser.Result.NoMatch,
            GroupJoinHttpsLinkParser.parse("https", host, null, "7F3K9QRZ", joinLinkHost = host),
        )
    }

    @Test
    fun `wrong scheme is ignored (http, not https)`() {
        val result = GroupJoinHttpsLinkParser.parse("http", host, "/g", "7F3K9QRZ", joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.NoMatch, result)
    }

    @Test
    fun `the waldo custom scheme is ignored by this parser (handled separately)`() {
        val result = GroupJoinHttpsLinkParser.parse("waldo", "group-join", null, null, joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.NoMatch, result)
    }

    @Test
    fun `null host is ignored`() {
        val result = GroupJoinHttpsLinkParser.parse("https", null, "/g", "7F3K9QRZ", joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.NoMatch, result)
    }

    @Test
    fun `a matching host and path with a null fragment opens with no prefill, not an error`() {
        val result = GroupJoinHttpsLinkParser.parse("https", host, "/g", null, joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.Matched(null), result)
    }

    @Test
    fun `a matching host and path with an unparsable fragment opens with no prefill, not an error`() {
        val result = GroupJoinHttpsLinkParser.parse("https", host, "/g", "<script>alert(1)</script>", joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.Matched(null), result)
    }

    @Test
    fun `scheme and host comparison is case-insensitive`() {
        val result = GroupJoinHttpsLinkParser.parse("HTTPS", host.uppercase(), "/g", "7F3K9QRZ", joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.Matched("7F3K9QRZ"), result)
    }

    @Test
    fun `path comparison is case-sensitive`() {
        val result = GroupJoinHttpsLinkParser.parse("https", host, "/G", "7F3K9QRZ", joinLinkHost = host)
        assertEquals(GroupJoinHttpsLinkParser.Result.NoMatch, result)
    }
}
