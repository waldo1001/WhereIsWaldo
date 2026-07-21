// specs/002 §2.11 `GroupCodes` table. Integration-tested later; no unit tests here (thin
// adapter, excluded from mutation).

import { RestError } from "@azure/data-tables";
import { createTableClient } from "./tableClientFactory";
import type { GroupCodeRecord, GroupCodeRepo } from "../../ports/repositories";

const CODE_ROW_KEY = "code";

function isNotFound(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 404;
}

export class TableGroupCodeRepo implements GroupCodeRepo {
  private readonly client = createTableClient("GroupCodes");

  async createCode(code: string, record: GroupCodeRecord): Promise<void> {
    await this.client.createEntity({
      partitionKey: code,
      rowKey: CODE_ROW_KEY,
      groupId: record.groupId,
      createdAt: record.createdAt,
    });
  }

  async getCode(code: string): Promise<GroupCodeRecord | null> {
    try {
      const entity = await this.client.getEntity(code, CODE_ROW_KEY);
      return { groupId: String(entity.groupId), createdAt: String(entity.createdAt) };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }
}
