# Azure / GitHub / Firebase setup (one-time, manual)

Everything the cloud side needs before the first deploy. Run by a human with `az` CLI (Owner on the subscription) — nothing here lives in CI. Cost target: a few euros/month (consumption Function App + storage transactions).

## 1. Azure resources

```bash
# ---- adjust these ----
LOCATION=westeurope
RG=rg-whereswaldo
STORAGE=stwhereswaldo          # must be globally unique, 3-24 lowercase alphanumerics
FUNCAPP=func-whereswaldo       # must be globally unique
GITHUB_REPO=<owner>/WhereIsWaldo
FIREBASE_PROJECT_ID=<your-firebase-project-id>
# ----------------------

az group create -n $RG -l $LOCATION

az storage account create -n $STORAGE -g $RG -l $LOCATION \
  --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
  --allow-blob-public-access false

# Lifecycle policy (normative JSON in specs/002 §4)
# NB: append blobs support ONLY the delete action in lifecycle management (no tiering)
cat > /tmp/lifecycle.json <<'EOF'
{ "rules": [ {
    "name": "history-retention", "enabled": true, "type": "Lifecycle",
    "definition": {
      "filters": { "blobTypes": ["appendBlob"], "prefixMatch": ["history/", "events/"] },
      "actions": { "baseBlob": {
        "delete": { "daysAfterModificationGreaterThan": 400 } } } } } ] }
EOF
az storage account management-policy create --account-name $STORAGE -g $RG --policy @/tmp/lifecycle.json

# Consumption Function App, Node 20, system-assigned managed identity
az functionapp create -n $FUNCAPP -g $RG -s $STORAGE \
  --consumption-plan-location $LOCATION \
  --runtime node --runtime-version 20 --functions-version 4 \
  --assign-identity '[system]'

# Managed identity → data-plane roles on the storage account (specs/002 §1)
PRINCIPAL_ID=$(az functionapp identity show -n $FUNCAPP -g $RG --query principalId -o tsv)
STORAGE_ID=$(az storage account show -n $STORAGE -g $RG --query id -o tsv)
az role assignment create --assignee-object-id $PRINCIPAL_ID --assignee-principal-type ServicePrincipal \
  --role "Storage Table Data Contributor" --scope $STORAGE_ID
az role assignment create --assignee-object-id $PRINCIPAL_ID --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" --scope $STORAGE_ID

# App settings (FCM_SERVICE_ACCOUNT_JSON added in step 3)
az functionapp config appsettings set -n $FUNCAPP -g $RG --settings \
  FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID \
  TABLES_ENDPOINT="https://$STORAGE.table.core.windows.net" \
  BLOB_ENDPOINT="https://$STORAGE.blob.core.windows.net"
```

## 2. GitHub Actions → Azure via OIDC (no secrets)

```bash
# App registration used ONLY by GitHub Actions to deploy
APP_ID=$(az ad app create --display-name gh-whereswaldo-deploy --query appId -o tsv)
az ad sp create --id $APP_ID

# Federated credential: trust pushes to main of this repo
cat > /tmp/fedcred.json <<EOF
{ "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:${GITHUB_REPO}:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"] }
EOF
az ad app federated-credential create --id $APP_ID --parameters @/tmp/fedcred.json

# Deploy permission, scoped to the Function App only
FUNCAPP_ID=$(az functionapp show -n $FUNCAPP -g $RG --query id -o tsv)
az role assignment create --assignee $APP_ID --role "Website Contributor" --scope $FUNCAPP_ID
```

Then set **repository variables** (Settings → Secrets and variables → Actions → *Variables* — these are identifiers, not secrets; `backend.yml`'s deploy job stays skipped until `AZURE_CLIENT_ID` exists):

| Variable | Value |
|---|---|
| `AZURE_CLIENT_ID` | `$APP_ID` |
| `AZURE_TENANT_ID` | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query id -o tsv` |
| `AZURE_FUNCTIONAPP_NAME` | `$FUNCAPP` |

## 3. Firebase (auth + push)

1. Create a Firebase project (free Spark plan) at console.firebase.google.com; note the **project ID** → `FIREBASE_PROJECT_ID`.
2. **Authentication:** enable Email/Password (and optionally Google sign-in).
3. **Android app:** register package id (e.g. `be.wauters.whereswaldo`), download `google-services.json` → `mobile/android/app/` (gitignored).
4. **iOS app:** register bundle id, download `GoogleService-Info.plist` → gitignored; upload the **APNs auth key** (from the Apple Developer account) into Firebase Cloud Messaging settings so FCM can route to APNs.
5. **FCM sending credential** (the system's only stored key — specs/000 §O6): Project settings → Service accounts → *Generate new private key*, then:
   ```bash
   az functionapp config appsettings set -n $FUNCAPP -g $RG \
     --settings FCM_SERVICE_ACCOUNT_JSON="$(cat serviceAccountKey.json | tr -d '\n')"
   ```
   Delete the local copy afterwards. Hardening backlog: GCP Workload Identity Federation trust to the Function App's managed identity → no stored key at all.

## 4. Apple specifics (before iOS push-to-locate works properly)

- Apple Developer Program ($99/yr) — needed for APNs at all.
- **Apply for the Location Push Service Extension entitlement** (`com.apple.developer.location.push`) via developer.apple.com — justification: family locator app, user-initiated locates. This takes time; apply early (specs/000 §O1).

## 5. Branch protection (the mutation gate's teeth)

GitHub → Settings → Branches → protect `main`: require the status checks **`test`** and **`mutation`** (contexts match the *job names* from `backend.yml`; the PR merge box displays them as "backend / test" etc.) — add **`android-build`** / **`ios-build`** once those apps have real builds. Note: `backend.yml` deliberately has **no path filter on `pull_request`** — a path-filtered required check never reports on non-matching PRs, which would leave every docs/specs/mobile PR stuck on "Expected — waiting for status". Alternatively manage all of this as a repository ruleset (JSON export can then live in `.github/`).

## 6. Verify

1. Push any `backend/**` change to main → `backend` workflow: test → mutation → deploy all green.
2. `curl https://$FUNCAPP.azurewebsites.net/api/v1/families/me -H "Authorization: Bearer <firebase-id-token>"` → JSON envelope (`FAMILY_NOT_FOUND` for a fresh user is the expected happy sign).
3. Azure portal → Function App → confirm the **app's data-plane** settings are endpoint URLs only (`TABLES_ENDPOINT`/`BLOB_ENDPOINT`, no account keys) and storage reads succeed via managed identity. Expected and fine: `AzureWebJobsStorage` / `WEBSITE_CONTENT*` connection strings exist — those belong to the Functions *host* (created by `az functionapp create` on the consumption plan), not to the app's data access.
