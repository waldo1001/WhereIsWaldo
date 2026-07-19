// specs/002 §2.8 `IdempotencyMarkers` table. Conditional insert ("Add", fails 409 if it
// already exists, 002 §2) IS the dedupe test. Integration-tested later; no unit tests
// here (thin adapter, excluded from mutation).

import { RestError } from "@azure/data-tables";
import { createTableClient } from "./tableClientFactory";
import type { IdempotencyRepo } from "../../ports/repositories";

function isAlreadyExists(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 409;
}

export class TableIdempotencyRepo implements IdempotencyRepo {
  private readonly client = createTableClient("IdempotencyMarkers");

  private async tryInsert(partitionKey: string, rowKey: string, extra: Record<string, unknown>): Promise<boolean> {
    try {
      await this.client.createEntity({ partitionKey, rowKey, ...extra });
      return true;
    } catch (err) {
      if (isAlreadyExists(err)) return false;
      throw err;
    }
  }

  async tryInsertBatchMarker(
    deviceId: string,
    batchId: string,
    meta: { receivedAt: string; fixCount: number },
  ): Promise<boolean> {
    return this.tryInsert(deviceId, `batch:${batchId}`, meta);
  }

  async tryInsertEventMarker(deviceId: string, eventId: string, receivedAt: string): Promise<boolean> {
    return this.tryInsert(deviceId, `event:${eventId}`, { receivedAt });
  }

  async tryInsertFixMarker(deviceId: string, fixId: string, receivedAt: string): Promise<boolean> {
    return this.tryInsert(deviceId, `fix:${fixId}`, { receivedAt });
  }
}
