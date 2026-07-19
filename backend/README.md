# Where's waldo — backend

Azure Functions (consumption), TypeScript, Node 20, **v4 programming model**. The wire contract is [`specs/001-api-contract.md`](../specs/001-api-contract.md); storage layouts are [`specs/002-storage-schema.md`](../specs/002-storage-schema.md). Nothing here may diverge from those specs — fix the spec first.

## Layout (hexagonal)

```
src/
├── functions/     # v4 app.http() registrations ONLY — thin, no logic, excluded from mutation
├── http/          # envelope.ts, errors.ts (the 001 §10 catalog), authGuard.ts, validate.ts (zod)
├── domain/        # PURE business logic — zero Azure/Google imports. plan.ts holds PLAN_MATRIX.
│   ├── family/  device/  location/  locate/  geofence/
├── ports/         # interfaces the domain depends on:
│   │              #   repositories.ts (FamilyRepo, UserRepo, DeviceRepo, LastKnownRepo,
│   │              #   InviteRepo, EntitlementsRepo, LocateRequestRepo, IdempotencyRepo, UsageRepo)
│   │              #   historyStore.ts, pushSender.ts, tokenVerifier.ts, support.ts (Clock, IdGenerator —
│   │              #   IdGenerator.next(length) returns `length` chars of [A-Za-z0-9]; DOMAIN adds the
│   │              #   fam_/lr_ prefix; the SeqIdGenerator fake pads its sequence to `length`)
└── adapters/      # real implementations: tables/ + blobs/ (@azure/data-tables / @azure/storage-blob;
                   #   AzureNamedKeyCredential with the well-known devstoreaccount1 key when the endpoint
                   #   host is 127.0.0.1/localhost i.e. Azurite, DefaultAzureCredential otherwise — 002 §1),
                   #   push/fcmV1Sender.ts, auth/firebaseJoseVerifier.ts (jose)
test/
├── fakes/         # InMemory* repos, FixedClock, SeqIdGenerator, FakePushSender, StubTokenVerifier
└── unit/          # domain/ + http/ tests — MUST run without Azurite, network, or Azure SDKs
```

**Rule:** `src/domain` + `src/http` are pure and mutation-tested. `src/adapters` + `src/functions` are thin integration surface (integration-tested against Azurite in a later session; excluded from mutation).

## Commands

| Command | What |
|---|---|
| `npm test` | Unit tests (Vitest). Never needs Azurite. |
| `npm run test:watch` | The red–green loop |
| `npm run mutation` | StrykerJS — same gate as CI. Thresholds in `stryker.config.json` (`break: 60`, ratchet-up only). |
| `npm run build` | `tsc` type-check + emit |
| `npm run dev:storage` | Azurite (local Table/Blob emulator), state in `.azurite/` |
| `npm run dev` | Build + `func start` (requires [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4) |

## TDD workflow (non-negotiable)

1. Write the failing test in `test/unit/…` (start from the checklist in specs/001 §11).
2. Run it. **Watch it fail.**
3. Implement the minimum in `src/domain` / `src/http`.
4. Green → refactor → `npm run mutation` before pushing.

## Local settings

Copy `local.settings.json.example` → `local.settings.json` (gitignored). `AUTH_MODE=insecure-local` accepts unsigned JWTs for local testing (specs/001 §2.3) and must refuse to run in Azure.
