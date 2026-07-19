import { randomInt } from "node:crypto";
import type { IdGenerator } from "../../ports/support";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Cryptographically-random [A-Za-z0-9] id generator (pinned contract: length chars, no prefix). */
export class CryptoIdGenerator implements IdGenerator {
  next(length: number): string {
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += ALPHABET[randomInt(ALPHABET.length)];
    }
    return out;
  }
}
