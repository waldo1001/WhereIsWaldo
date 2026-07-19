import type { InviteCodeGenerator } from "../../src/ports/support";

/**
 * Deterministic InviteCodeGenerator fake: each call returns the next sequence number,
 * left-padded with "0" to 8 chars — deterministic and trivially canonical (digits only).
 */
export class SeqInviteCodeGenerator implements InviteCodeGenerator {
  private sequence = 0;

  next(): string {
    this.sequence += 1;
    return String(this.sequence).padStart(8, "0");
  }
}
