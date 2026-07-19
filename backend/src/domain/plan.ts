// specs/001 §9 — Entitlements & `features`. The single source of plan limits/flags.
// Every limit-enforcement point MUST read this object — never a literal (001 §9, §11).

export type SubscriptionStatus = "free" | "active";

export interface PlanLimits {
  maxDevices: number;
  maxGeofences: number;
  historyDays: number;
  minSyncIntervalMinutes: number;
  locateRequestsPerDay: number;
}

export interface PlanFlags {
  pushToLocate: boolean;
  geofencing: boolean;
  historyReplay: boolean;
}

export interface PlanBenefits {
  limits: PlanLimits;
  flags: PlanFlags;
}

export interface Features extends PlanBenefits {
  subscriptionStatus: SubscriptionStatus;
}

const FREE_PLAN: PlanBenefits = {
  limits: {
    maxDevices: 10,
    maxGeofences: 20,
    historyDays: 90,
    minSyncIntervalMinutes: 5,
    locateRequestsPerDay: 100,
  },
  flags: {
    pushToLocate: true,
    geofencing: true,
    historyReplay: true,
  },
};

// "active" currently mirrors "free" — a reserved placeholder (001 §9). Changing plan
// benefits later is editing this matrix, nothing else.
export const PLAN_MATRIX: Record<SubscriptionStatus, PlanBenefits> = {
  free: FREE_PLAN,
  active: FREE_PLAN,
};

export function getFeatures(subscriptionStatus: SubscriptionStatus): Features {
  return { subscriptionStatus, ...PLAN_MATRIX[subscriptionStatus] };
}
