import Foundation

/// specs/004-ios-client.md §3.4 (specs/005-temporary-groups.md §1; 001 §1.4; docs/security-review-
/// checklist.md §5 — "deep-link inputs validated before use") — extracts and normalizes a group
/// join code from EITHER a raw pasted code OR the group-join deep link
/// (`waldo://group-join?code=<code>`), validating the charset defensively before it's ever sent to
/// the network layer. A group code shares the invite codes' 8-char Crockford base32 format/
/// normalization (`InviteCodeParsing`, 001 §1.4) — canonical wire form uppercase, no hyphen; a user
/// may paste/type the hyphenated `XXXX-XXXX` display form.
///
/// Unlike the invite deep link (`waldo://invite/<code>`, a path segment), the group-join link
/// carries its code as a `code` query parameter, and — unlike invites — HTTPS universal links are
/// explicitly deferred for groups (005 §5, 000 §O16), so only the custom `waldo://` scheme is
/// recognized here.
public enum GroupCodeParsing {
    /// Crockford base32 alphabet (specs/001 §1.4): digits + uppercase letters minus I, L, O, U.
    private static let allowedCharacters = CharacterSet(charactersIn: "ABCDEFGHJKMNPQRSTVWXYZ0123456789")

    /// Returns the normalized 8-character uppercase code, or `nil` if `raw` doesn't resolve to a
    /// well-formed group code — malformed/oversized/injection-shaped input is rejected here, never
    /// forwarded to `joinGroup`.
    public static func normalize(_ raw: String) -> String? {
        var candidate = raw.trimmingCharacters(in: .whitespacesAndNewlines)

        if let url = URL(string: candidate), let scheme = url.scheme, !scheme.isEmpty {
            guard scheme == "waldo", url.host == "group-join" else {
                // Either a wholly unrelated URL, or a different `waldo://` deep link (e.g. the
                // invite one) — never cross-parse another feature's link as a group code.
                return nil
            }
            guard
                let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                let code = components.queryItems?.first(where: { $0.name == "code" })?.value,
                !code.isEmpty
            else {
                return nil
            }
            candidate = code
        }

        let stripped = candidate.replacingOccurrences(of: "-", with: "").uppercased()
        guard stripped.count == 8, stripped.unicodeScalars.allSatisfy({ allowedCharacters.contains($0) }) else {
            return nil
        }
        return stripped
    }
}
