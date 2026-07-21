// specs/002 §2.13 `GroupExpiry` table — the sweeper's index. Integration-tested later; no
// unit tests here (thin adapter, excluded from mutation).

import { createTableClient } from "./tableClientFactory";
import type { GroupExpiryAction, GroupExpiryRepo } from "../../ports/repositories";

export class TableGroupExpiryRepo implements GroupExpiryRepo {
  private readonly client = createTableClient("GroupExpiry");

  async putExpiryRow(bucketDate: string, groupId: string, action: GroupExpiryAction): Promise<void> {
    // Upsert (not a conditional insert): B10's re-bucket-on-PATCH and B12's sweeper both
    // need to write/move this row idempotently (002 §2.13/§4.1) — this task only ever
    // writes it once at create, but the write itself has no collision to guard against.
    await this.client.upsertEntity(
      { partitionKey: bucketDate, rowKey: groupId, action },
      "Replace",
    );
  }
}
