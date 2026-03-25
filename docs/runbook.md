# Nibras Operator Runbook

## Services

| Service | Default port | Health check |
|---------|-------------|--------------|
| API | 4848 | `GET /healthz`, `GET /readyz` |
| Worker | 9090 | `GET /healthz` |
| Web | 3000 | Next.js built-in |
| Postgres | 5432 | `pg_isready` |

---

## Tracing a Failed Submission End-to-End

Every API request emits a structured JSON log line with `reqId`. Every worker job logs `jobId` and `submissionAttemptId`.

### Step 1 — Find the submission in the DB
```sql
SELECT id, status, summary, "createdAt", "updatedAt"
FROM "SubmissionAttempt"
WHERE id = '<submissionId>';
```

### Step 2 — Find the verification job
```sql
SELECT id, status, attempt, "claimedAt", "finishedAt"
FROM "VerificationJob"
WHERE "submissionAttemptId" = '<submissionId>';
```

### Step 3 — Find the verification run log
```sql
SELECT attempt, log, status, "startedAt", "finishedAt"
FROM "VerificationRun"
WHERE "submissionAttemptId" = '<submissionId>'
ORDER BY attempt DESC, "createdAt" DESC
LIMIT 5;
```

### Step 4 — Search API logs by request ID
```bash
grep '"reqId":"req_abc123"' /var/log/nibras-api.log
```

### Step 5 — Search worker logs by job ID
```bash
grep '"jobId":"<jobId>"' /var/log/nibras-worker.log
```

---

## Manual Status Override

Use the admin API to manually set a submission's status without re-running verification.

```bash
curl -X PATCH https://api.yourdomain.com/v1/admin/submissions/<submissionId>/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "passed", "summary": "Manually approved by operator."}'
```

Valid statuses: `passed`, `failed`, `needs_review`.

To inspect the verification history exposed by the API:

```bash
curl https://api.yourdomain.com/v1/admin/submissions/<submissionId>/logs \
  -H "Authorization: Bearer <admin-token>"
```

---

## Handling a Stuck Job

A job is "stuck" if `claimedAt` is set but `finishedAt` is null and the worker process is not running.

**Detection:**
```sql
SELECT id, "submissionAttemptId", attempt, "claimedAt"
FROM "VerificationJob"
WHERE status = 'running'
AND "claimedAt" < NOW() - INTERVAL '5 minutes';
```

**Resolution (reset to queued so the worker re-claims it):**
```sql
UPDATE "VerificationJob"
SET status = 'queued', "claimedAt" = NULL
WHERE id = '<jobId>';

UPDATE "SubmissionAttempt"
SET status = 'queued', summary = 'Reset by operator after stuck job.'
WHERE id = '<submissionAttemptId>';
```

---

## Secret Rotation

### CLI session tokens
CLI sessions are stored in `CliSession`. To revoke an individual token:
```sql
UPDATE "CliSession" SET "revokedAt" = NOW() WHERE "accessToken" = '<token>';
```

To revoke all sessions for a user:
```sql
UPDATE "CliSession" SET "revokedAt" = NOW()
WHERE "userId" = '<userId>' AND "revokedAt" IS NULL;
```

### NIBRAS_ENCRYPTION_KEY rotation
1. Generate a new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Write a one-time migration script that reads all `GithubAccount.userAccessToken` values, decrypts with the old key, re-encrypts with the new key, and updates the row.
3. Update the key in `.env.prod` and restart all services.

### GitHub Webhook Secret
1. Generate a new secret and update it in the GitHub App settings.
2. Update `GITHUB_WEBHOOK_SECRET` in `.env.prod`.
3. Restart the API. The old secret is immediately invalid.

---

## Applying Schema Migrations in Production

```bash
# On the API container (or a migration-specific one-off):
npx prisma migrate deploy
```

This runs all pending migrations in `prisma/migrations/` in order. It is idempotent — migrations that already ran are skipped.

The production `docker-compose.prod.yml` API service runs `prisma migrate deploy` automatically on startup.

---

## Health Check Endpoints

```bash
# Liveness (is the process up?)
curl https://api.yourdomain.com/healthz
# → {"ok":true}

# Readiness (is the DB reachable?)
curl https://api.yourdomain.com/readyz
# → {"ok":true}  or  {"ok":false,"reason":"database unavailable"}  (HTTP 503)

# Worker liveness
curl http://worker:9090/healthz
# → {"ok":true}
```

---

## Metrics

Prometheus-compatible metrics are available at:
```
GET https://api.yourdomain.com/metrics
```

Key metrics:
| Metric | Description |
|--------|-------------|
| `nibras_http_requests_total` | Request count by method and status |
| `nibras_verification_queue_depth` | Queued `VerificationJob` count |
| `nibras_verification_total` | Completed verifications by status |

---

## Deployment Reference

### Local dev
```bash
docker compose up -d        # postgres
npm run db:generate
npm run db:push             # dev only — never use in production
npm run build
npm run api:dev             # API on :4848
npm run worker:dev          # worker
npm run web:dev             # web on :3000
```

### Production
```bash
cp .env.prod.example .env.prod
# Fill in all CHANGEME values
docker compose -f docker-compose.prod.yml up -d
```

The API container runs `prisma migrate deploy` on startup.
