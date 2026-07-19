import type { LastKnownRecord, LastKnownRepo } from "../../src/ports/repositories";

export class InMemoryLastKnownRepo implements LastKnownRepo {
  private readonly records = new Map<string, Map<string, LastKnownRecord>>();

  private partition(familyId: string): Map<string, LastKnownRecord> {
    let roster = this.records.get(familyId);
    if (!roster) {
      roster = new Map();
      this.records.set(familyId, roster);
    }
    return roster;
  }

  /** Seeds a record bypassing the only-newer rule (test setup helper). */
  seed(familyId: string, record: LastKnownRecord): void {
    this.partition(familyId).set(record.deviceId, { ...record });
  }

  async get(familyId: string, deviceId: string): Promise<LastKnownRecord | null> {
    const record = this.records.get(familyId)?.get(deviceId);
    return record ? { ...record } : null;
  }

  async upsertIfNewer(familyId: string, record: LastKnownRecord): Promise<boolean> {
    const roster = this.partition(familyId);
    const existing = roster.get(record.deviceId);
    if (existing && new Date(existing.recordedAt).getTime() >= new Date(record.recordedAt).getTime()) {
      return false;
    }
    roster.set(record.deviceId, { ...record });
    return true;
  }

  async listByFamily(familyId: string): Promise<LastKnownRecord[]> {
    const roster = this.records.get(familyId);
    return roster ? [...roster.values()].map((r) => ({ ...r })) : [];
  }
}
