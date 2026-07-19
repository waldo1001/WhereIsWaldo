// Small cross-cutting ports. Pinned contract (docs/implementation-handoff.md B1):
// IdGenerator.next(length) returns `length` chars of [A-Za-z0-9]; DOMAIN code adds the
// fam_/lr_ prefix; the SeqIdGenerator test fake pads its sequence to `length` deterministically.

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(length: number): string;
}
