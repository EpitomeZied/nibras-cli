# Productionization Plan for Nibras

## Summary

Move Nibras from a working vertical slice to a production-grade product in 5 streams:

1. Replace simulated verification with a real async execution pipeline.
2. Add production deployment, CI, and release hygiene.
3. Harden auth, token, and secret handling.
4. Add observability, auditability, and operational safety.
5. Finish the minimum operator/admin product surface.

This plan assumes the current API/web/CLI contracts stay largely intact and prioritizes shipping a reliable single-tenant production deployment before broader multi-tenant features.

## Scope and Defaults

- Keep the current monorepo layout and Node/Next/Fastify/Prisma stack.
- Keep the current CLI and web flows as the public entrypoints.
- Use Postgres as the source of truth.
- Introduce one background worker service rather than embedding async verification in the API process.
- Treat GitHub-backed verification as authoritative; remove timer-based fake progression.
- Target one production environment first: `api`, `web`, `worker`, `postgres`, object storage.

## Phase 1: Real Verification Pipeline

### Changes

- Add a worker service under `apps/worker/`.
- Move submission progression logic out of [apps/api/src/prisma-store.ts](/home/zied/nibras-cli/apps/api/src/prisma-store.ts) and [apps/api/src/store.ts](/home/zied/nibras-cli/apps/api/src/store.ts).
- Replace timer-based state changes with explicit job lifecycle:
  - `queued`
  - `running`
  - `passed`
  - `failed`
  - `needs_review`
- Add a queue model in Postgres first:
  - either extend `VerificationRun`
  - or add a dedicated `VerificationJob` table linked to `SubmissionAttempt`
- Worker responsibilities:
  - claim queued jobs transactionally
  - fetch submission context
  - run verification command/container
  - persist logs, timestamps, exit code, final status
  - retry transient failures with bounded retry count
- API responsibilities:
  - create submission + queue job
  - expose submission and verification status
  - never synthesize progress from elapsed time

### Public/API impact

- Keep existing submission status response shape if possible.
- Add optional fields to submission status:
  - `verificationRunId`
  - `logAvailable`
  - `startedAt`
  - `finishedAt`

### Acceptance criteria

- Submissions only move state when the worker writes the result.
- Restarting API or worker does not lose queued jobs.
- Duplicate submit for the same commit remains idempotent.

## Phase 2: Deployment and Release Hygiene

### Changes

- Add production packaging for:
  - API container
  - worker container
  - web container
- Add deployment manifests for one chosen platform.
  Default: Docker Compose for local plus one real deploy target such as Fly.io, Railway, or Render.
- Add CI in `.github/workflows/`:
  - install
  - build
  - `node --test`
  - `npm run web:build`
- Replace `prisma db push` release usage with Prisma migrations:
  - create checked-in `prisma/migrations/`
  - add `db:migrate` and `db:deploy` scripts
- Add release/version workflow:
  - tag-based releases
  - changelog or release notes
  - CLI package build artifact

### Acceptance criteria

- Fresh production environment can be provisioned from code only.
- Schema changes deploy through migrations, not manual push.
- Every PR gets automated build/test coverage.

## Phase 3: Security Hardening

### Changes

- Stop storing browser access/refresh tokens in `localStorage`.
- Move web auth to secure cookies:
  - `HttpOnly`
  - `Secure`
  - `SameSite=Lax` or stricter where possible
- Encrypt or otherwise protect stored GitHub tokens and refresh tokens at rest.
- Add token rotation/revocation model for CLI and web sessions.
- Add CSRF protection for state-changing browser endpoints if cookie auth is introduced.
- Add stricter config validation on startup for required secrets and public URLs.
- Add explicit secret management guidance for production.

### Files likely affected

- [apps/web/app/auth/complete/page.tsx](/home/zied/nibras-cli/apps/web/app/auth/complete/page.tsx)
- [apps/web/app/lib/session.ts](/home/zied/nibras-cli/apps/web/app/lib/session.ts)
- [apps/api/src/app.ts](/home/zied/nibras-cli/apps/api/src/app.ts)
- [prisma/schema.prisma](/home/zied/nibras-cli/prisma/schema.prisma)

### Acceptance criteria

- No browser-readable long-lived tokens.
- Session revocation actually invalidates future requests.
- Production startup fails fast on missing critical secrets.

## Phase 4: Observability and Operations

### Changes

- Enable structured logging in the API and worker.
- Add request IDs and propagate them through API, worker, and webhook handling.
- Add metrics:
  - request latency
  - error rate
  - queue depth
  - verification duration
  - submission pass/fail counts
- Add health/readiness endpoints for API and worker.
- Start writing real audit events to `AuditLog` for:
  - sign-in
  - install link generation
  - installation linking
  - setup
  - submission creation
  - verification completion
- Add operator runbook docs for incident handling.

### Acceptance criteria

- A failed submission/job can be traced end-to-end by request/job ID.
- Operators can tell whether API, worker, DB, and webhook flow are healthy.

## Phase 5: Minimum Operator Product

### Changes

- Add an admin/operator surface for:
  - project/release creation
  - release asset upload
  - viewing submissions and verification logs
  - manual override to `needs_review` / `passed` / `failed`
- Add project release management backed by the existing release models in [prisma/schema.prisma](/home/zied/nibras-cli/prisma/schema.prisma).
- Replace seed/demo assumptions with operator-managed data.
- Add access control for operator-only actions.

### Acceptance criteria

- A course operator can create/manage a release without editing DB rows manually.
- Support can inspect a broken submission without shell access to production.

## Testing Plan

- Unit tests for queue claiming, retry logic, token/session helpers, and config validation.
- Integration tests for:
  - submission creation -> queued job
  - worker execution -> final status
  - webhook handling -> state updates
  - cookie/session auth
- End-to-end tests for:
  - browser login
  - GitHub App install
  - CLI login/setup/submit
  - operator review flow
- Non-functional tests:
  - worker restart recovery
  - duplicate delivery/idempotency
  - migration up/down validation

## Risks and Assumptions

- The biggest architectural decision is the worker execution model.
  Default: DB-backed queue first, containerized job runner second.
- GitHub integration is already central, so production readiness depends on stable public URLs and secret management.
- The operator/admin surface can be minimal at first; the worker and security work are higher priority.

## Recommended Delivery Order

1. Real worker and queue
2. Prisma migrations + CI
3. Secure web/session model
4. Logging/metrics/audit
5. Operator UI and release tooling
