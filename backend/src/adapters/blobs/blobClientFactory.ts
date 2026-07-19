// specs/002 §1 — credential selection by endpoint host: the well-known Azurite
// devstoreaccount1 name/key for local emulator hosts, DefaultAzureCredential otherwise.
// No connection strings/keys for the real account — only managed identity.

import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

// Azurite's well-known, publicly-documented emulator key (identical on every Azurite
// install everywhere — see Microsoft's Azurite docs). Not a real account credential;
// only ever talks to 127.0.0.1/localhost (mirrors tableClientFactory.ts).
const AZURITE_ACCOUNT_NAME = "devstoreaccount1";
const AZURITE_ACCOUNT_KEY =
  "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

function isLocalEmulatorHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export function createContainerClient(containerName: string): ContainerClient {
  const endpoint = process.env.BLOB_ENDPOINT;
  if (!endpoint) {
    throw new Error("BLOB_ENDPOINT app setting is required");
  }
  const host = new URL(endpoint).hostname;
  const serviceClient = isLocalEmulatorHost(host)
    ? new BlobServiceClient(endpoint, new StorageSharedKeyCredential(AZURITE_ACCOUNT_NAME, AZURITE_ACCOUNT_KEY))
    : new BlobServiceClient(endpoint, new DefaultAzureCredential());
  return serviceClient.getContainerClient(containerName);
}
