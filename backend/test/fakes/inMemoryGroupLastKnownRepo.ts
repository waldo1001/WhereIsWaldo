import type { GroupLastKnownRecord, GroupLastKnownRepo } from "../../src/ports/repositories";

// specs/002 §2.12 — GroupLastKnown keyed by groupId (one partition per group, `member:`
// rows within it), same only-newer idiom as InMemoryLastKnownRepo.
export class InMemoryGroupLastKnownRepo implements GroupLastKnownRepo {
  private readonly records = new Map<string, Map<string, GroupLastKnownRecord>>();

  private partition(groupId: string): Map<string, GroupLastKnownRecord> {
    let roster = this.records.get(groupId);
    if (!roster) {
      roster = new Map();
      this.records.set(groupId, roster);
    }
    return roster;
  }

  /** Seeds a record bypassing the only-newer rule (test setup helper). */
  seed(groupId: string, record: GroupLastKnownRecord): void {
    this.partition(groupId).set(record.userId, { ...record });
  }

  async get(groupId: string, userId: string): Promise<GroupLastKnownRecord | null> {
    const record = this.records.get(groupId)?.get(userId);
    return record ? { ...record } : null;
  }

  async upsertIfNewer(groupId: string, record: GroupLastKnownRecord): Promise<boolean> {
    const roster = this.partition(groupId);
    const existing = roster.get(record.userId);
    if (existing && new Date(existing.recordedAt).getTime() >= new Date(record.recordedAt).getTime()) {
      return false;
    }
    roster.set(record.userId, { ...record });
    return true;
  }

  async listByGroup(groupId: string): Promise<GroupLastKnownRecord[]> {
    const roster = this.records.get(groupId);
    return roster ? [...roster.values()].map((r) => ({ ...r })) : [];
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    this.records.get(groupId)?.delete(userId);
  }

  async deletePartition(groupId: string): Promise<void> {
    this.records.delete(groupId);
  }
}
