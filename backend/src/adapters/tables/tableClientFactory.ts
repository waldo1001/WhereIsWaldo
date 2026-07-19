// specs/002 §1 — credential selection by endpoint host: the well-known Azurite
// devstoreaccount1 name/key for local emulator hosts, DefaultAzureCredential otherwise.
// No connection strings/keys for the real account — only managed identity.

import { AzureNamedKeyCredential, TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

// This is Azurite's well-known, publicly-documented emulator key (identical on every
// Azurite install everywhere — see Microsoft's Azurite docs). It is NOT a real account
// credential and only ever talks to 127.0.0.1/localhost.
const AZURITE_ACCOUNT_NAME = "devstoreaccount1";
const AZURITE_ACCOUNT_KEY =
  "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

function isLocalEmulatorHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export function createTableClient(tableName: string): TableClient {
  const endpoint = process.env.TABLES_ENDPOINT;
  if (!endpoint) {
    throw new Error("TABLES_ENDPOINT app setting is required");
  }
  const host = new URL(endpoint).hostname;
  if (isLocalEmulatorHost(host)) {
    const credential = new AzureNamedKeyCredential(AZURITE_ACCOUNT_NAME, AZURITE_ACCOUNT_KEY);
    return new TableClient(endpoint, tableName, credential);
  }
  return new TableClient(endpoint, tableName, new DefaultAzureCredential());
}
