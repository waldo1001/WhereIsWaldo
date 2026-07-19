// specs/001 §1.4 — invite code canonical form: uppercase, no hyphen. Applied on BOTH
// create (store canonical) and accept (normalize input before lookup).

export function normalizeInviteCode(raw: string): string {
  return raw.replace(/-/g, "").toUpperCase();
}
