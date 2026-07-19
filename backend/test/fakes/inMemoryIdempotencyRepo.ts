import type { IdempotencyRepo } from "../../src/ports/repositories";

export class InMemoryIdempotencyRepo implements IdempotencyRepo {
  private readonly batchMarkers = new Map<string, { receivedAt: string; fixCount: number }>();
  private readonly eventMarkers = new Set<string>();
  private readonly fixMarkers = new Set<string>();

  private key(deviceId: string, id: string): string {
    return `${deviceId}|${id}`;
  }

  /** Test inspection helper: the meta actually passed to the last insert for (deviceId, batchId). */
  getBatchMarkerMeta(deviceId: string, batchId: string): { receivedAt: string; fixCount: number } | undefined {
    return this.batchMarkers.get(this.key(deviceId, batchId));
  }

  async tryInsertBatchMarker(
    deviceId: string,
    batchId: string,
    meta: { receivedAt: string; fixCount: number },
  ): Promise<boolean> {
    const key = this.key(deviceId, batchId);
    if (this.batchMarkers.has(key)) return false;
    this.batchMarkers.set(key, { ...meta });
    return true;
  }

  async tryInsertEventMarker(deviceId: string, eventId: string, _receivedAt: string): Promise<boolean> {
    const key = this.key(deviceId, eventId);
    if (this.eventMarkers.has(key)) return false;
    this.eventMarkers.add(key);
    return true;
  }

  async tryInsertFixMarker(deviceId: string, fixId: string, _receivedAt: string): Promise<boolean> {
    const key = this.key(deviceId, fixId);
    if (this.fixMarkers.has(key)) return false;
    this.fixMarkers.add(key);
    return true;
  }
}
