// specs/002 §3.1/§3.4, specs/001 §7.1 — reads the `config` block blob's ETag only
// (the piggyback seam POST /locations needs, §5.1). B5 implements the full config
// document read/write (PUT /geofences, version field, If-Match conflict handling).
// Integration-tested later; no unit tests here (thin adapter, excluded from mutation).

import { RestError } from "@azure/storage-blob";
import { createContainerClient } from "./blobClientFactory";
import type { GeofenceConfigRepo } from "../../ports/geofenceConfig";

const CONFIG_CONTAINER = "config";
const NO_CONFIG_ETAG = "0";

function isNotFound(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 404;
}

export class BlobGeofenceConfigRepo implements GeofenceConfigRepo {
  private readonly container = createContainerClient(CONFIG_CONTAINER);

  async getEtag(familyId: string): Promise<string> {
    const client = this.container.getBlockBlobClient(`${familyId}/geofences.json`);
    try {
      const props = await client.getProperties();
      return props.etag ?? NO_CONFIG_ETAG;
    } catch (err) {
      if (isNotFound(err)) return NO_CONFIG_ETAG;
      throw err;
    }
  }
}
