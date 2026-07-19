import { randomInt } from "node:crypto";
import type { InviteCodeGenerator } from "../../ports/support";

// specs/001 §1.4 — Crockford base32: 0-9A-Z minus I, L, O, U (32 symbols).
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 8;

/** Cryptographically-random 8-char Crockford base32 invite code generator. */
export class CryptoInviteCodeGenerator implements InviteCodeGenerator {
  next(): string {
    let out = "";
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      out += CROCKFORD_ALPHABET[randomInt(CROCKFORD_ALPHABET.length)];
    }
    return out;
  }
}
