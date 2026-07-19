// specs/002 §1/§6 — points the adapters at a local Azurite emulator (never a real Azure
// account). Imported for its side effect: sets TABLES_ENDPOINT/BLOB_ENDPOINT before any
// adapter (`createTableClient`/`createContainerClient`) is constructed. Azurite must
// already be running (`npm run dev:storage` — default ports 10000 blob / 10002 table).

process.env.TABLES_ENDPOINT ??= "http://127.0.0.1:10002/devstoreaccount1";
process.env.BLOB_ENDPOINT ??= "http://127.0.0.1:10000/devstoreaccount1";
