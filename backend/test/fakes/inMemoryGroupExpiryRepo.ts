import type { GroupExpiryAction, GroupExpiryRepo, GroupExpiryRow } from "../../src/ports/repositories";

export class InMemoryGroupExpiryRepo implements GroupExpiryRepo {
  private readonly rows = new Map<string, { bucketDate: string; groupId: string; action: GroupExpiryAction }>();

  async putExpiryRow(bucketDate: string, groupId: string, action: GroupExpiryAction): Promise<void> {
    this.rows.set(`${bucketDate}:${groupId}`, { bucketDate, groupId, action });
  }

  async deleteExpiryRow(bucketDate: string, groupId: string): Promise<void> {
    // Idempotent no-op if the row isn't at this bucket (002 §2.13 self-healing note).
    this.rows.delete(`${bucketDate}:${groupId}`);
  }

  async listByDate(bucketDate: string): Promise<GroupExpiryRow[]> {
    const matches: GroupExpiryRow[] = [];
    for (const row of this.rows.values()) {
      if (row.bucketDate === bucketDate) {
        matches.push({ groupId: row.groupId, action: row.action });
      }
    }
    return matches;
  }

  /** Test-only accessor — not part of the GroupExpiryRepo port. */
  get(bucketDate: string, groupId: string) {
    return this.rows.get(`${bucketDate}:${groupId}`);
  }

  /** Test-only accessor — total row count, to assert no orphans survive a hard delete. */
  size(): number {
    return this.rows.size;
  }
}
