import { describe, expect, it } from "vitest";
import {
  decodeEventCursor,
  decodeFixCursor,
  encodeEventCursor,
  encodeFixCursor,
} from "../../../src/domain/history/cursor";
import { expectAppError } from "../../support/expectAppError";

describe("domain/history/cursor — fix cursor (per-device byte offsets, 002 §3.3)", () => {
  it("round-trips a fix cursor through encode -> decode", () => {
    const cursor = { d: "2026-07-05", o: { "device-a": 128, "device-b": 0 } };

    const encoded = encodeFixCursor(cursor);
    const decoded = decodeFixCursor(encoded);

    expect(decoded).toEqual(cursor);
  });

  it("produces an opaque base64url string (not raw JSON)", () => {
    const encoded = encodeFixCursor({ d: "2026-07-05", o: {} });

    expect(encoded).not.toContain("{");
    expect(encoded).not.toContain('"');
  });

  it("rejects a cursor that is not valid base64url/JSON", async () => {
    await expectAppError(
      Promise.resolve().then(() => decodeFixCursor("!!!not-a-cursor!!!")),
      "VALIDATION_FAILED",
      { fields: ["cursor"] },
    );
  });

  it("rejects a well-formed JSON payload with the wrong shape (e.g. events cursor for a fix reader)", async () => {
    const wrongShape = encodeEventCursor({ d: "2026-07-05", o: 5 }); // o is a number, not a record

    await expectAppError(
      Promise.resolve().then(() => decodeFixCursor(wrongShape)),
      "VALIDATION_FAILED",
      { fields: ["cursor"] },
    );
  });

  it("rejects a cursor with a malformed date", async () => {
    const raw = Buffer.from(JSON.stringify({ d: "not-a-date", o: {} }), "utf-8").toString("base64url");

    await expectAppError(
      Promise.resolve().then(() => decodeFixCursor(raw)),
      "VALIDATION_FAILED",
      { fields: ["cursor"] },
    );
  });
});

describe("domain/history/cursor — event cursor (single byte offset, 002 §3.3)", () => {
  it("round-trips an event cursor through encode -> decode", () => {
    const cursor = { d: "2026-07-05", o: 4096 };

    const encoded = encodeEventCursor(cursor);
    const decoded = decodeEventCursor(encoded);

    expect(decoded).toEqual(cursor);
  });

  it("rejects a fix-shaped cursor (o is a record) for the event decoder", async () => {
    const wrongShape = encodeFixCursor({ d: "2026-07-05", o: { "device-a": 1 } });

    await expectAppError(
      Promise.resolve().then(() => decodeEventCursor(wrongShape)),
      "VALIDATION_FAILED",
      { fields: ["cursor"] },
    );
  });

  it("rejects a negative byte offset", async () => {
    const raw = Buffer.from(JSON.stringify({ d: "2026-07-05", o: -1 }), "utf-8").toString("base64url");

    await expectAppError(
      Promise.resolve().then(() => decodeEventCursor(raw)),
      "VALIDATION_FAILED",
      { fields: ["cursor"] },
    );
  });
});
