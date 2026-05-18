# Deploy to Azure Container Apps

End-to-end migration from Fly.io to Azure Container Apps + Supabase Postgres.
Targets the free Azure for Students tier ($100 credit, no credit card required)
plus the Supabase free tier (500 MB Postgres, no credit card required).

The CI/CD workflow at `.github/workflows/deploy-azure.yml` builds three Docker
images on every push to `main`, pushes them to GitHub Container Registry
(`ghcr.io`), and updates the three Container Apps to the new image SHA.

## One-time setup

Do all of this once, in order. Every step happens in your browser; nothing here
asks for a credit card.

### 1. Verify the Supabase Postgres connection string

You should have a project from the earlier signup step. Grab the
**Transaction-mode** connection string from
**Settings → Database → Connection string → Transaction (port 6543)**. It looks
like:

```
postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

This is `DATABASE_URL`. Save it — you'll paste it into Azure in step 4.

### 2. Open Azure Cloud Shell

Visit https://shell.azure.com — opens an in-browser bash shell already logged
in as your Azure account. No installs needed.

### 3. Provision Resource Group + Container Apps environment

Paste these commands one block at a time. The whole sequence takes ~5 minutes.

```bash
# ── Settings — adjust if you want ─────────────────────────────────────────
RG=nibras-rg
LOCATION=westeurope            # closest to Egypt with full Container Apps support
ENV=nibras-env

# ── Resource group + Container Apps env ────────────────────────────────────
az group create --name $RG --location $LOCATION

# Register the namespace (one-time per subscription)
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

az containerapp env create \
  --name $ENV \
  --resource-group $RG \
  --location $LOCATION

# Get the env's default DNS domain — needed for the URLs below
ENV_DOMAIN=$(az containerapp env show \
  --name $ENV --resource-group $RG \
  --query 'properties.defaultDomain' -o tsv)
echo
echo "Environment domain: $ENV_DOMAIN"
echo "  api  → https://nibras-api.$ENV_DOMAIN"
echo "  web  → https://nibras-web.$ENV_DOMAIN"
echo
```

**Save the printed URLs** — you'll need them in step 5 for the GitHub
variables. The format is `<app-name>.<env-domain>`.

### 4. Create the three Container Apps with a placeholder image

Each app starts with a Hello-World image. GitHub Actions will replace these
with the real images once the CI workflow runs.

```bash
# ── Helper: encryption key (same value used by api AND worker) ────────────
KEY=$(openssl rand -hex 32)
echo "Encryption key (save somewhere safe — both api+worker need it):"
echo "$KEY"

# ── Replace this with the Supabase Transaction-mode URL from step 1 ───────
DATABASE_URL='postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'

# ── Replace these with your GitHub App values ─────────────────────────────
# (Same values you have on Fly today; keep nibras-platfrom or use whatever
# slug your GitHub App is registered under.)
GITHUB_APP_ID='3206994'
GITHUB_APP_CLIENT_ID='...'
GITHUB_APP_CLIENT_SECRET='...'
GITHUB_APP_NAME='nibras-platfrom'
GITHUB_WEBHOOK_SECRET='...'
# Paste the PEM block as a single line OR `cat` from a file
GITHUB_APP_PRIVATE_KEY=$(cat <<'EOF'
-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
EOF
)

# ── api ──────────────────────────────────────────────────────────────────
az containerapp create \
  --name nibras-api \
  --resource-group $RG \
  --environment $ENV \
  --image mcr.microsoft.com/azuredocs/aci-helloworld \
  --target-port 8080 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 1 \
  --cpu 0.25 --memory 0.5Gi

az containerapp secret set \
  --name nibras-api --resource-group $RG \
  --secrets \
    database-url="$DATABASE_URL" \
    encryption-key="$KEY" \
    github-app-id="$GITHUB_APP_ID" \
    github-app-client-id="$GITHUB_APP_CLIENT_ID" \
    github-app-client-secret="$GITHUB_APP_CLIENT_SECRET" \
    github-app-name="$GITHUB_APP_NAME" \
    github-webhook-secret="$GITHUB_WEBHOOK_SECRET" \
    github-app-private-key="$GITHUB_APP_PRIVATE_KEY"

az containerapp update \
  --name nibras-api --resource-group $RG \
  --set-env-vars \
    PORT=8080 \
    NIBRAS_API_BASE_URL="https://nibras-api.$ENV_DOMAIN" \
    NIBRAS_WEB_BASE_URL="https://nibras-web.$ENV_DOMAIN" \
    NIBRAS_WEB_CORS_ORIGINS="https://nibras-web.$ENV_DOMAIN" \
    DATABASE_URL=secretref:database-url \
    NIBRAS_ENCRYPTION_KEY=secretref:encryption-key \
    GITHUB_APP_ID=secretref:github-app-id \
    GITHUB_APP_CLIENT_ID=secretref:github-app-client-id \
    GITHUB_APP_CLIENT_SECRET=secretref:github-app-client-secret \
    GITHUB_APP_NAME=secretref:github-app-name \
    GITHUB_WEBHOOK_SECRET=secretref:github-webhook-secret \
    GITHUB_APP_PRIVATE_KEY=secretref:github-app-private-key

# ── worker ──────────────────────────────────────────────────────────────────
az containerapp create \
  --name nibras-worker \
  --resource-group $RG \
  --environment $ENV \
  --image mcr.microsoft.com/azuredocs/aci-helloworld \
  --min-replicas 1 --max-replicas 1 \
  --cpu 0.25 --memory 0.5Gi

az containerapp secret set \
  --name nibras-worker --resource-group $RG \
  --secrets \
    database-url="$DATABASE_URL" \
    encryption-key="$KEY"

az containerapp update \
  --name nibras-worker --resource-group $RG \
  --set-env-vars \
    DATABASE_URL=secretref:database-url \
    NIBRAS_ENCRYPTION_KEY=secretref:encryption-key

# ── web ─────────────────────────────────────────────────────────────────────
az containerapp create \
  --name nibras-web \
  --resource-group $RG \
  --environment $ENV \
  --image mcr.microsoft.com/azuredocs/aci-helloworld \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 --max-replicas 1 \
  --cpu 0.25 --memory 0.5Gi

az containerapp update \
  --name nibras-web --resource-group $RG \
  --set-env-vars \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NIBRAS_API_INTERNAL_URL="https://nibras-api.$ENV_DOMAIN"
```

### 5. Create a service principal so GitHub Actions can update Container Apps

```bash
SUB_ID=$(az account show --query id -o tsv)
az ad sp create-for-rbac \
  --name nibras-gha \
  --role contributor \
  --scopes /subscriptions/$SUB_ID/resourceGroups/$RG \
  --sdk-auth
```

The output is a JSON blob. **Copy the whole block** — you'll paste it as a
GitHub Secret in step 6.

### 6. Add GitHub Secrets + Variables

Go to https://github.com/NibrasPlatform/nibras-cli/settings/secrets/actions

**Secrets** (Actions → New repository secret):

| Name | Value |
|---|---|
| `AZURE_CREDENTIALS` | the JSON blob from step 5 |

**Variables** (Actions → Variables tab → New repository variable):

| Name | Value |
|---|---|
| `AZURE_RESOURCE_GROUP` | `nibras-rg` |
| `NIBRAS_API_BASE_URL` | `https://nibras-api.<your-env-domain>` |
| `NIBRAS_WEB_BASE_URL` | `https://nibras-web.<your-env-domain>` |
| `NIBRAS_API_INTERNAL_URL` | `https://nibras-api.<your-env-domain>` |

(Replace `<your-env-domain>` with the value printed at the end of step 3.)

### 7. Push to main → first real deploy

```bash
git push origin main
```

The `Deploy to Azure Container Apps` workflow will:

1. Build the three Docker images (~3-5 min)
2. Push them to `ghcr.io/nibrasplatform/nibras-cli/{api,worker,web}:<sha>`
3. Update the three Container Apps to that SHA
4. Print the live URLs in the workflow logs

Watch progress at https://github.com/NibrasPlatform/nibras-cli/actions

### 8. Update GitHub App callback + webhook URLs

Once the URLs are live, go to
https://github.com/settings/apps/nibras-platfrom and set:

| Field | URL |
|---|---|
| **Homepage URL** | `https://nibras-web.<env-domain>` |
| **Callback URL** | `https://nibras-api.<env-domain>/v1/github/oauth/callback` |
| **Setup URL** | `https://nibras-web.<env-domain>/install/complete` |
| **Webhook URL** | `https://nibras-api.<env-domain>/v1/github/webhooks` |

### 9. (Optional) Make the ghcr.io packages public

Container Apps needs to pull the images. If the GitHub repo is private the
images default to private — Container Apps can still pull them once you've
attached registry credentials, OR you can flip the package visibility to
public:

https://github.com/orgs/NibrasPlatform/packages → for each package
(`nibras-cli/api`, `/worker`, `/web`) → **Package settings → Danger Zone →
Change visibility → Public**.

Public packages need no auth and Container Apps pulls them by default.

## Cost expectation

Container Apps consumption pricing for the smallest replica size (0.25 vCPU,
0.5 GB):

- worker @ `min-replicas: 1` (always-on): ~$14/month
- api + web @ `min-replicas: 0` (scale to zero when idle): ~$0–2/month each

Total ~$14–18/mo. The $100 student credit lasts ~5-7 months.

After the credit runs out you can:

- Keep the worker awake via a different mechanism (e.g. cron-job.org pinging
  the worker via a small HTTP endpoint we'd add)
- Migrate to Render free tier
- Pay the (small) Azure bill

## Updating later

Every push to `main` rebuilds + redeploys automatically. To skip the deploy on
a doc-only change, the workflow already filters `paths:` to ignore changes
outside `apps/`, `packages/`, `prisma/`, and `Dockerfile.*`.

To roll back to a previous SHA:

```bash
az containerapp update \
  --name nibras-<api|worker|web> \
  --resource-group nibras-rg \
  --image ghcr.io/nibrasplatform/nibras-cli/<api|worker|web>:<old-sha>
```

## Tearing down Fly

After the Azure deploy is verified working, remove the Fly resources to stop
the (paused) billing:

```bash
flyctl apps destroy nibras-web-v2 -y
flyctl apps destroy nibras-api-v2 -y
flyctl apps destroy nibras-worker-v2 -y
flyctl postgres destroy nibras-db-v2 -y
```
