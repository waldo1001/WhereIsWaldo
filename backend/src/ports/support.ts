// Small cross-cutting ports. Pinned contract (docs/implementation-handoff.md B1):
// IdGenerator.next(length) returns `length` chars of [A-Za-z0-9]; DOMAIN code adds the
// fam_/lr_ prefix; the SeqIdGenerator test fake pads its sequence to `length` deterministically.

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(length: number): string;
}

// specs/001 §1.4 — invite codes are 8 chars of Crockford base32 (alphabet 0-9A-Z minus
// I/L/O/U), a DIFFERENT alphabet than IdGenerator's [A-Za-z0-9]. Domain code canonicalizes
// (uppercase, no hyphen) on both create and accept (specs/001 §3.3/§3.4); the generator
// itself is expected to already return the canonical form.
export interface InviteCodeGenerator {
  next(): string;
}
