// specs/002 §2.4 `Devices` table. Integration-tested later; no unit tests here (thin
// adapter, excluded from mutation).

import { odata, RestError } from "@azure/data-tables";
import { createTableClient } from "./tableClientFactory";
import type { DevicePlatform, DeviceRecord, DeviceRepo } from "../../ports/repositories";

const DEVICE_PREFIX = "device:";

function isNotFound(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 404;
}

function toRecord(deviceId: string, entity: Record<string, unknown>): DeviceRecord {
  return {
    deviceId,
    ownerUserId: String(entity.ownerUserId),
    platform: entity.platform as DevicePlatform,
    model: String(entity.model),
    appVersion: String(entity.appVersion),
    deviceName: String(entity.deviceName),
    pushToken: entity.pushToken != null ? String(entity.pushToken) : undefined,
    locationPushToken: entity.locationPushToken != null ? String(entity.locationPushToken) : undefined,
    pushInvalid: Boolean(entity.pushInvalid),
    syncIntervalMinutes: Number(entity.syncIntervalMinutes),
    trackingEnabled: Boolean(entity.trackingEnabled),
    registeredAt: String(entity.registeredAt),
    lastSeenAt: String(entity.lastSeenAt),
  };
}

export class TableDeviceRepo implements DeviceRepo {
  private readonly client = createTableClient("Devices");

  async getDevice(familyId: string, deviceId: string): Promise<DeviceRecord | null> {
    try {
      const entity = await this.client.getEntity(familyId, `${DEVICE_PREFIX}${deviceId}`);
      return toRecord(deviceId, entity);
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async putDevice(familyId: string, device: DeviceRecord): Promise<void> {
    await this.client.upsertEntity(
      {
        partitionKey: familyId,
        rowKey: `${DEVICE_PREFIX}${device.deviceId}`,
        ownerUserId: device.ownerUserId,
        platform: device.platform,
        model: device.model,
        appVersion: device.appVersion,
        deviceName: device.deviceName,
        pushToken: device.pushToken ?? null,
        locationPushToken: device.locationPushToken ?? null,
        pushInvalid: device.pushInvalid,
        syncIntervalMinutes: device.syncIntervalMinutes,
        trackingEnabled: device.trackingEnabled,
        registeredAt: device.registeredAt,
        lastSeenAt: device.lastSeenAt,
      },
      "Replace",
    );
  }

  async listDevices(familyId: string): Promise<DeviceRecord[]> {
    const devices: DeviceRecord[] = [];
    const entities = this.client.listEntities({
      queryOptions: {
        filter: odata`PartitionKey eq ${familyId} and RowKey ge ${DEVICE_PREFIX} and RowKey lt ${"device;"}`,
      },
    });
    for await (const entity of entities) {
      const deviceId = String(entity.rowKey).slice(DEVICE_PREFIX.length);
      devices.push(toRecord(deviceId, entity));
    }
    return devices;
  }

  async countDevices(familyId: string): Promise<number> {
    const devices = await this.listDevices(familyId);
    return devices.length;
  }

  async deleteDevicesByOwner(familyId: string, userId: string): Promise<void> {
    const devices = await this.listDevices(familyId);
    await Promise.all(
      devices
        .filter((device) => device.ownerUserId === userId)
        .map((device) => this.client.deleteEntity(familyId, `${DEVICE_PREFIX}${device.deviceId}`)),
    );
  }
}
