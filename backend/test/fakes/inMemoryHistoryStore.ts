import type { EventLine, FixLine, HistoryPage, HistoryStore } from "../../src/ports/historyStore";

export interface RecordedFix {
  familyId: string;
  userId: string;
  deviceId: string;
  fix: FixLine;
}

/** In-memory HistoryStore fake (B2) — B6 owns the real blob-backed read side. */
export class InMemoryHistoryStore implements HistoryStore {
  readonly fixes: RecordedFix[] = [];
  readonly events: EventLine[] = [];

  async appendFix(familyId: string, userId: string, deviceId: string, fix: FixLine): Promise<void> {
    this.fixes.push({ familyId, userId, deviceId, fix: { ...fix } });
  }

  async appendEvent(familyId: string, event: EventLine): Promise<void> {
    this.events.push({ ...event });
  }

  async readFixHistory(): Promise<HistoryPage<FixLine & { deviceId: string }>> {
    throw new Error("InMemoryHistoryStore: history read is not implemented in B2 (see B6)");
  }

  async readEventHistory(): Promise<HistoryPage<EventLine>> {
    throw new Error("InMemoryHistoryStore: history read is not implemented in B2 (see B6)");
  }
}
