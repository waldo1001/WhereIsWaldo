// specs/005 §2.2 — group state is a pure function, never a stored column: no transition
// writes, no drift. `expired` is never serialized in a response (001 §12); callers filter
// it (list, §12.2) or map it to 410 GROUP_EXPIRED (get/join, §12.3/§12.6).

import type { GroupExpiryPolicy } from "../../ports/repositories";

export type GroupState = "active" | "ended" | "archived" | "expired";

/**
 * state(now, endsAt, policy):
 *   now < endsAt                                 -> "active"
 *   policy = delete,  now >= endsAt               -> expired
 *   policy = grace,   endsAt <= now < graceUntil  -> "ended"    (owner may reactivate)
 *   policy = grace,   now >= graceUntil           -> expired
 *   policy = archive, now >= endsAt               -> "archived"
 *
 * graceUntil = endsAt + groupGraceDays (005 §2.2) — resolved from the caller's own
 * features.limits.groupGraceDays at call sites in this task (create/list/get/join), since
 * 002 §2.2's list cost model is explicitly "reverse-index scan + Groups.meta point-reads
 * only" (no extra owner-entitlement reads); `maxGroupMembers` remains the one owner-plan
 * exception, per 001 §9.
 */
export function deriveGroupState(
  now: Date,
  endsAt: string,
  policy: GroupExpiryPolicy,
  groupGraceDays: number,
): GroupState {
  const endsAtMs = new Date(endsAt).getTime();
  const nowMs = now.getTime();

  if (nowMs < endsAtMs) {
    return "active";
  }

  if (policy === "archive") {
    return "archived";
  }

  if (policy === "delete") {
    return "expired";
  }

  // policy === "grace"
  const graceUntilMs = endsAtMs + groupGraceDays * 24 * 60 * 60 * 1000;
  return nowMs < graceUntilMs ? "ended" : "expired";
}
