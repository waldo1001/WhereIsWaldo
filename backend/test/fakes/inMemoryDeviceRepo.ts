import type { DeviceRecord, DeviceRepo } from "../../src/ports/repositories";

export class InMemoryDeviceRepo implements DeviceRepo {
  private readonly devices = new Map<string, Map<string, DeviceRecord>>();

  private partition(familyId: string): Map<string, DeviceRecord> {
    let roster = this.devices.get(familyId);
    if (!roster) {
      roster = new Map();
      this.devices.set(familyId, roster);
    }
    return roster;
  }

  seed(familyId: string, device: DeviceRecord): void {
    this.partition(familyId).set(device.deviceId, { ...device });
  }

  async getDevice(familyId: string, deviceId: string): Promise<DeviceRecord | null> {
    const device = this.devices.get(familyId)?.get(deviceId);
    return device ? { ...device } : null;
  }

  async putDevice(familyId: string, device: DeviceRecord): Promise<void> {
    this.partition(familyId).set(device.deviceId, { ...device });
  }

  async listDevices(familyId: string): Promise<DeviceRecord[]> {
    const roster = this.devices.get(familyId);
    return roster ? [...roster.values()].map((d) => ({ ...d })) : [];
  }

  async countDevices(familyId: string): Promise<number> {
    return this.devices.get(familyId)?.size ?? 0;
  }

  async deleteDevicesByOwner(familyId: string, userId: string): Promise<void> {
    const roster = this.devices.get(familyId);
    if (!roster) return;
    for (const [deviceId, device] of roster) {
      if (device.ownerUserId === userId) {
        roster.delete(deviceId);
      }
    }
  }
}
