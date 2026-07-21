import type { GroupExpiryAction, GroupExpiryRepo } from "../../src/ports/repositories";

export class InMemoryGroupExpiryRepo implements GroupExpiryRepo {
  private readonly rows = new Map<string, { bucketDate: string; groupId: string; action: GroupExpiryAction }>();

  async putExpiryRow(bucketDate: string, groupId: string, action: GroupExpiryAction): Promise<void> {
    this.rows.set(`${bucketDate}:${groupId}`, { bucketDate, groupId, action });
  }

  /** Test-only accessor — not part of the GroupExpiryRepo port. */
  get(bucketDate: string, groupId: string) {
    return this.rows.get(`${bucketDate}:${groupId}`);
  }
}
