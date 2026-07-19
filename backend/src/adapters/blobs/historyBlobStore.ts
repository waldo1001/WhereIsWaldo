// specs/002 §3.1/§3.2 `history`/`events` containers. APPEND side only (POST /locations,
// POST /geofence-events). Integration-tested later; no unit tests here (thin adapter,
// excluded from mutation). B6 implements readFixHistory/readEventHistory (cursor + walk).

import { RestError } from "@azure/storage-blob";
import { createContainerClient } from "./blobClientFactory";
import type { EventLine, FixLine, HistoryPage, HistoryStore } from "../../ports/historyStore";

function isAlreadyExists(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 409;
}

/** UTC yyyy/MM/dd path segments from an ISO 8601 `recordedAt` (002 §3.1 day-boundary rule). */
function dayPath(recordedAtIso: string): string {
  const date = new Date(recordedAtIso);
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

async function appendLine(
  container: ReturnType<typeof createContainerClient>,
  blobPath: string,
  line: unknown,
): Promise<void> {
  const client = container.getAppendBlobClient(blobPath);
  try {
    await client.create({ conditions: { ifNoneMatch: "*" } });
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
  }
  const buffer = Buffer.from(`${JSON.stringify(line)}\n`, "utf-8");
  await client.appendBlock(buffer, buffer.length);
}

export class BlobHistoryStore implements HistoryStore {
  private readonly historyContainer = createContainerClient("history");
  private readonly eventsContainer = createContainerClient("events");

  async appendFix(familyId: string, userId: string, deviceId: string, fix: FixLine): Promise<void> {
    const blobPath = `${familyId}/${userId}/${deviceId}/${dayPath(fix.recordedAt)}.jsonl`;
    await appendLine(this.historyContainer, blobPath, fix);
  }

  async appendEvent(familyId: string, event: EventLine): Promise<void> {
    const blobPath = `${familyId}/${dayPath(event.recordedAt)}.jsonl`;
    await appendLine(this.eventsContainer, blobPath, event);
  }

  async readFixHistory(): Promise<HistoryPage<FixLine & { deviceId: string }>> {
    throw new Error("history read is implemented in B6");
  }

  async readEventHistory(): Promise<HistoryPage<EventLine>> {
    throw new Error("history read is implemented in B6");
  }
}
