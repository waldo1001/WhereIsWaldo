import Testing
@testable import WaldoKit

/// specs/004-ios-client.md §3.4 (specs/005-temporary-groups.md §1; 001 §1.4; docs/security-review-
/// checklist.md §5 — deep-link inputs validated before use). Group join codes share the invite
/// codes' 8-char Crockford base32 format/normalization (001 §1.4), but the deep link shape differs:
/// `waldo://group-join?code=XXXXXXXX` (a query parameter), not a path segment like
/// `waldo://invite/<code>` — and unlike invites, HTTPS universal links are explicitly deferred
/// (005 §5, 000 §O16), so only the custom scheme is accepted here.
struct GroupCodeParsingTests {

    @Test func normalize_acceptsCanonicalUppercaseCode() {
        #expect(GroupCodeParsing.normalize("7F3K9QRZ") == "7F3K9QRZ")
    }

    @Test func normalize_acceptsLowercaseHyphenatedDisplayForm() {
        #expect(GroupCodeParsing.normalize("7f3k-9qrz") == "7F3K9QRZ")
    }

    @Test func normalize_extractsCodeFromGroupJoinDeepLink() {
        #expect(GroupCodeParsing.normalize("waldo://group-join?code=7F3K9QRZ") == "7F3K9QRZ")
    }

    @Test func normalize_extractsAndNormalizesHyphenatedCodeFromDeepLink() {
        #expect(GroupCodeParsing.normalize("waldo://group-join?code=7f3k-9qrz") == "7F3K9QRZ")
    }

    @Test func normalize_rejectsWrongLength() {
        #expect(GroupCodeParsing.normalize("7F3K9Q") == nil)
        #expect(GroupCodeParsing.normalize("7F3K9QRZXX") == nil)
    }

    @Test func normalize_rejectsAmbiguousCrockfordCharacters() {
        // I, L, O, U are excluded from Crockford base32 (specs/001 §1.4).
        #expect(GroupCodeParsing.normalize("7F3K9QRI") == nil)
        #expect(GroupCodeParsing.normalize("7F3K9QRL") == nil)
        #expect(GroupCodeParsing.normalize("7F3K9QRO") == nil)
        #expect(GroupCodeParsing.normalize("7F3K9QRU") == nil)
    }

    @Test func normalize_rejectsUnrelatedUrl() {
        // A URL-shaped string that isn't our group-join deep link must never leak its host/path
        // through as if it were a code.
        #expect(GroupCodeParsing.normalize("https://evil.example/not-a-group") == nil)
    }

    @Test func normalize_rejectsInviteDeepLink() {
        // Same "waldo" scheme, different feature — must not cross-parse as a group code.
        #expect(GroupCodeParsing.normalize("waldo://invite/7F3K9QRZ") == nil)
    }

    @Test func normalize_rejectsHttpsUniversalLink() {
        // HTTPS universal join links are explicitly deferred (005 §5, 000 §O16) — only the custom
        // `waldo://` scheme is recognized in v1.
        #expect(GroupCodeParsing.normalize("https://wheres-waldo.example/group-join?code=7F3K9QRZ") == nil)
    }

    @Test func normalize_rejectsDeepLinkMissingCodeParam() {
        #expect(GroupCodeParsing.normalize("waldo://group-join") == nil)
        #expect(GroupCodeParsing.normalize("waldo://group-join?code=") == nil)
    }

    @Test func normalize_rejectsEmptyString() {
        #expect(GroupCodeParsing.normalize("") == nil)
    }

    @Test func normalize_trimsWhitespace() {
        #expect(GroupCodeParsing.normalize("  7F3K9QRZ  ") == "7F3K9QRZ")
    }
}
