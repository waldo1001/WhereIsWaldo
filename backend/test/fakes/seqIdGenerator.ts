import type { IdGenerator } from "../../src/ports/support";

/**
 * Deterministic IdGenerator fake: each call returns the next sequence number, left-padded
 * with "0" to `length` chars (pinned contract, docs/implementation-handoff.md B1).
 */
export class SeqIdGenerator implements IdGenerator {
  private sequence = 0;

  next(length: number): string {
    this.sequence += 1;
    return String(this.sequence).padStart(length, "0");
  }
}
