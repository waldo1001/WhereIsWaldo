import type { GeofenceConfigRepo } from "../../src/ports/geofenceConfig";

const NO_CONFIG_ETAG = "0";

export class InMemoryGeofenceConfigRepo implements GeofenceConfigRepo {
  private readonly etags = new Map<string, string>();

  seed(familyId: string, etag: string): void {
    this.etags.set(familyId, etag);
  }

  async getEtag(familyId: string): Promise<string> {
    return this.etags.get(familyId) ?? NO_CONFIG_ETAG;
  }
}
