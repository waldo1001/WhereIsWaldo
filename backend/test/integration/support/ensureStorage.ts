import "./azuriteEnv";
import { createTableClient } from "../../../src/adapters/tables/tableClientFactory";
import { createContainerClient } from "../../../src/adapters/blobs/blobClientFactory";

/** Azurite doesn't auto-create tables/containers (real Azure provisioning does this once,
 * docs/azure-setup.md); integration tests create-if-not-exists on their own fixtures. */
export async function ensureTables(...names: string[]): Promise<void> {
  for (const name of names) {
    await createTableClient(name).createTable();
  }
}

export async function ensureContainers(...names: string[]): Promise<void> {
  for (const name of names) {
    await createContainerClient(name).createIfNotExists();
  }
}
