# Nibras

> Hosted, GitHub-linked CLI for project setup, testing, and submission.

Nibras is a course-operations platform: a CLI that students use to set up projects, run tests, and submit work — backed by a REST API, async worker, instructor dashboard, and GitHub App integration.

---

## Table of Contents

- [Overview](#overview)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick Start (Local Dev)](#quick-start-local-dev)
- [CLI Usage](#cli-usage)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [GitHub App Setup](#github-app-setup)
- [Optional Integrations](#optional-integrations)
  - [AI Grading](#ai-grading)
  - [Email Notifications](#email-notifications)
  - [Commit Status Checks](#commit-status-checks)
  - [GitHub Repository Validation](#github-repository-validation)
  - [Grade Export](#grade-export)
  - [Course Switching](#course-switching)
  - [Admin Features](#admin-features)
  - [Metrics (Prometheus + Grafana)](#metrics-prometheus--grafana)
- [Production Deployment](#production-deployment)
- [Testing](#testing)
- [CI/CD](#cicd)

---

## Overview

| Persona    | What they do                                                               |
| ---------- | -------------------------------------------------------------------------- |
| Student    | `nibras login` → `nibras setup` → `nibras test` → `nibras submit`          |
| Instructor | Manages courses, projects, milestones, reviews submissions, exports grades |
| Operator   | Deploys API + worker + web via Docker Compose; monitors via Prometheus     |

**Key capabilities:**

- Device-flow GitHub OAuth (no passwords stored)
- Submission pipeline: stage allowed files → commit → push → verify → grade
- Private test grading, semantic AI grading, manual score fallback, optional check50
- Instructor dashboard: course management, review queue, CSV grade export
- Multi-course switching with URL-persisted course selection
- GitHub commit status badges (✅ / ❌ / 🔄) posted on student commits
- GitHub repository validation before submission (checks ownership and write access)
- Submission modal with live GitHub status checks replacing static submit form
- Student notes surfaced in instructor review; milestone previews and counts in project tabs
- Super-admin badge and accessible-course count in the settings page
- Transactional email notifications via Resend (optional)
- Prometheus metrics + Grafana dashboard (optional)

---

## Repository Structure

```
nibras-cli/
├── apps/                          # Deployable services
│   ├── api/                       # Fastify REST API
│   │   └── src/
│   │       ├── features/
│   │       │   ├── admin/         # Admin overrides, user management
│   │       │   ├── github/        # OAuth, App install, webhook handling
│   │       │   ├── hosted-cli/    # Submission, verification, status endpoints
│   │       │   └── tracking/      # Courses, projects, milestones, progress
│   │       ├── lib/               # Shared utilities (auth, email, errors)
│   │       ├── app.ts             # Fastify app factory
│   │       ├── server.ts          # Process entry point
│   │       ├── store.ts           # In-memory dev store (no DB)
│   │       └── prisma-store.ts    # Prisma/Postgres store
│   │
│   ├── cli/                       # Hosted CLI workspace / npm package source
│   │   └── src/
│   │       ├── commands/          # login, logout, whoami, setup, test,
│   │       │                      #   submit, task, ping, update-buildpack
│   │       ├── ui/                # Terminal UI helpers
│   │       └── index.ts           # Commander.js entry point
│   │
│   ├── web/                       # Next.js 15 instructor dashboard
│   │   └── app/
│   │       ├── (app)/             # Authenticated routes
│   │       │   ├── dashboard/     # Overview with multi-course switcher
│   │       │   ├── instructor/    # Course/project/milestone management,
│   │       │   │                  #   submission review, grade export,
│   │       │   │                  #   onboarding wizard (OS-aware)
│   │       │   ├── projects/      # Student project dashboard with
│   │       │   │                  #   status-aware submission modal
│   │       │   ├── settings/      # Profile, GitHub App install,
│   │       │   │                  #   super-admin badge & course count
│   │       │   └── submissions/   # Student submission detail
│   │       ├── auth/              # GitHub OAuth callback
│   │       ├── join/              # Course invite flow
│   │       └── api/               # Next.js route handlers
│   │
│   ├── worker/                    # Async job processor
│   │   └── src/
│   │       ├── worker.ts          # Job loop: verification + grading
│   │       ├── queue.ts           # Job queue abstraction
│   │       ├── sandbox.ts         # Isolated test runner
│   │       └── email.ts           # Submission-result email dispatch
│   │
│   └── proxy/                     # Local same-origin proxy (dev only)
│       └── src/                   # /v1/* → API, else → web
│
├── packages/                      # Shared internal libraries (build order)
│   ├── contracts/                 # Zod schemas + inferred TS types
│   ├── core/                      # API client, config, manifest, git ops
│   ├── github/                    # JWT signing + webhook HMAC validation
│   └── grading/                   # AI semantic grading runner
│
├── src/                           # Legacy CommonJS CLI (backwards compat)
│   └── cli.js                     # Entry point; used if apps/cli/dist/ absent
│
├── bin/
│   └── nibras.js                  # Tries apps/cli/dist/ first, falls back to src/
│
├── prisma/
│   ├── schema.prisma              # PostgreSQL schema (Prisma ORM)
│   ├── seed.ts                    # Dev seed data
│   └── migrations/                # Applied migration history
│
├── docs/
│   ├── instructor-guide.md
│   ├── student-guide.md
│   ├── ops-guide.md
│   ├── runbook.md
│   └── project-tracking.md
│
├── nginx/                         # Nginx config for production reverse proxy
├── grafana/                       # Grafana dashboard JSON
├── sample-answers/                # Test fixtures for grading validation
│
├── .github/workflows/
│   ├── ci.yml                     # Test, lint, build on every push/PR
│   └── release.yml                # Publish @nibras/cli to npm on v* tags
│
├── docker-compose.yml             # Local dev: Postgres only
├── docker-compose.prod.yml        # Production: API + worker + web + Postgres
├── Dockerfile                     # CLI image
├── Dockerfile.api                 # API image
├── Dockerfile.worker              # Worker image
│
├── .env.example                   # Required env vars (copy to .env)
├── .env.ngrok.example             # Env for live GitHub + ngrok validation
├── .env.prod.example              # Production env template
│
├── package.json                   # Root workspace + scripts
├── tsconfig.base.json             # Shared TS config (ES2022, strict, CJS)
└── eslint.config.mjs              # ESLint v9 flat config + Prettier
```

---

## Prerequisites

| Tool      | Required | Notes                                        |
| --------- | -------- | -------------------------------------------- |
| Node.js   | ≥ 18     |                                              |
| npm       | ≥ 9      |                                              |
| git       | any      |                                              |
| Docker    | yes      | Runs local Postgres via Docker Compose       |
| unzip     | yes      | Used by `nibras setup`                       |
| wget/curl | yes      | Used by `nibras setup` for HTTP(S) downloads |
| ngrok     | optional | Required for live GitHub webhook testing     |
| check50   | optional | Required only for check50-type projects      |

---

## Quick Start (Local Dev)

```bash
# 1. Clone and install
git clone https://github.com/NibrasPlatform/nibras-cli.git
cd nibras-cli
npm ci

# 2. Configure environment
cp .env.example .env
# Edit .env — database URL is pre-filled for Docker dev stack

# 3. Start everything
npm run dev
```

`npm run dev` will:

1. Start the Postgres container via Docker Compose
2. Wait for Postgres readiness
3. Apply Prisma migrations (`prisma migrate deploy`)
4. Build TypeScript services once
5. Start watch mode + API + worker + web dev servers in parallel

**Local endpoints:**

| Service       | URL                               |
| ------------- | --------------------------------- |
| API health    | `http://127.0.0.1:4848/v1/health` |
| Web dashboard | `http://127.0.0.1:3000`           |
| Worker health | `http://127.0.0.1:9090/healthz`   |

---

## CLI Usage

### Install

Install the current release from the Git tag (works on macOS, Linux, and Windows):

```bash
npm install -g git+https://github.com/NibrasPlatform/nibras-cli.git#v1.0.2
```

Verify:

```bash
nibras --version   # → v1.0.2-<commit>
```

> The npm package is not yet published, so `npm install -g @nibras/cli` and `npx @nibras/cli` currently return a 404.
> To run from source, use `npm run build` then `node bin/nibras.js`.

For platform-specific prerequisites (Node.js, git, permission fixes) and a full step-by-step walkthrough, see **[docs/student-guide.md](docs/student-guide.md)**.

### Hosted onboarding

Pass the API URL your admin provides during login. A fresh install defaults to the local dev API at `http://127.0.0.1:4848`.

```bash
nibras login --api-base-url https://nibras.yourschool.edu
```

### Core workflow

```bash
nibras login  --api-base-url https://nibras.yourschool.edu  # Device-flow GitHub OAuth
nibras setup  --project cs101/assignment-1                  # Bootstrap or refresh a project
nibras task                                                  # Print assignment instructions
nibras test                                                  # Run manifest-configured tests locally
nibras submit                                                # Stage → commit → push → verify
```

| Command         | What it does                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| `nibras setup`  | Writes `.nibras/project.json` + `.nibras/task.md`, inits git, adds `origin`, optionally extracts starter files |
| `nibras test`   | Runs the OS-aware test command from the manifest; non-zero exit = failure                                      |
| `nibras submit` | Runs tests, stages only allowed files, commits, pushes, registers with API, polls verification                 |

`nibras submit` never stops on local test failure — the result is recorded and server-side verification always runs.

### Diagnostics / session

```bash
nibras whoami   # Signed-in user, linked GitHub account, active API URL
nibras ping     # Full connectivity check: API · auth · GitHub · App install · project
nibras logout   # Clear the local session
```

`nibras ping` is the fastest way to diagnose any problem — run it first.

### Update & uninstall

```bash
nibras update --check                    # Compare installed version against latest release
nibras update --version v1.0.2          # Reinstall a specific Git-tag release
nibras update --force --version v1.0.2  # Force reinstall the same tag
nibras uninstall                         # Remove binary; config is preserved
```

### Advanced / compatibility

```bash
nibras update-buildpack --node 20   # Edit .nibras/project.json buildpack version
nibras legacy ...                   # Run the legacy src/ entrypoint (CS161 backwards compat)
```

---

## Architecture

### Data flows

```
Student CLI
  └─ nibras submit
       ├─ stage allowed files
       ├─ git commit + push → student's GitHub repo
       └─ POST /v1/submissions → API
             └─ Worker picks up job
                   ├─ clone + run tests in sandbox
                   ├─ (optional) AI semantic grading
                   ├─ POST commit status to GitHub
                   ├─ send email notification
                   └─ write results back to DB
```

```
Student Dashboard (Next.js)
  └─ reads/writes via API /v1/* and /v1/tracking/*
       ├─ multi-course switcher (URL-persisted)
       ├─ project list with milestone previews and counts
       ├─ status-aware submission modal
       │     ├─ POST /v1/github/repositories/validate  (repo ownership check)
       │     └─ POST /v1/submissions
       └─ live GitHub App install status
```

```
Instructor Dashboard (Next.js)
  └─ reads/writes via API /v1/tracking/*
       ├─ courses, projects, milestones
       ├─ submission review queue (with student notes + AI evidence)
       └─ grade CSV export
```

### Packages (build dependency order)

```
contracts → core → github
                 → grading
```

| Package             | Description                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `@nibras/contracts` | Zod schemas and TypeScript types shared by all layers (incl. `systemRole`, repo-validate types) |
| `@nibras/core`      | API client (with token refresh), config, manifest, git helpers                                  |
| `@nibras/github`    | GitHub App JWT signing and webhook HMAC validation                                              |
| `@nibras/grading`   | AI semantic grading runner (OpenAI-compatible)                                                  |

### Legacy CLI (`src/`)

`bin/nibras.js` tries `apps/cli/dist/index.js` first. If the modern build is absent it falls back to `src/cli.js` — the original CommonJS CLI kept for backwards compatibility (used by the CS161 course).

---

## Environment Variables

Copy `.env.example` to `.env`. Groups:

| Group      | Required                 | Key vars                                                                                                       |
| ---------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Database   | yes                      | `DATABASE_URL`                                                                                                 |
| GitHub App | yes (for OAuth/webhooks) | `GITHUB_APP_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` |
| Session    | yes                      | `SESSION_SECRET`                                                                                               |
| App URLs   | yes                      | `NIBRAS_API_BASE_URL`, `NIBRAS_WEB_BASE_URL`                                                                   |
| AI Grading | optional                 | `NIBRAS_AI_API_KEY`, `NIBRAS_AI_MODEL`, `NIBRAS_AI_BASE_URL`, `NIBRAS_AI_MIN_CONFIDENCE`                       |
| Email      | optional                 | `RESEND_API_KEY`, `NIBRAS_EMAIL_FROM`                                                                          |
| Monitoring | optional                 | `SENTRY_DSN`                                                                                                   |

See `.env.example` for all variables with documentation.

---

## Database

PostgreSQL via Prisma ORM. Schema: `prisma/schema.prisma`.

```bash
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:push          # Push schema without migration (disposable dev)
npm run db:migrate       # Create a named migration
npm run db:deploy        # Apply pending migrations (production path)
npm run db:local:reset   # Tear down and recreate local Docker volume (destructive)
```

Always run `npm run db:generate` after editing `prisma/schema.prisma`.

---

## GitHub App Setup

Required for OAuth login and webhook-based commit status checks.

1. **Create the App** at [github.com/settings/apps/new](https://github.com/settings/apps/new)
2. **Fill registration fields:**
   - `Homepage URL`: `<public-url>/`
   - `Callback URL`: `<public-url>/v1/github/oauth/callback`
   - `Setup URL`: `<public-url>/install/complete`
   - `Webhook URL`: `<public-url>/v1/github/webhooks`
   - `Webhook secret`: random secret → `GITHUB_WEBHOOK_SECRET`
3. **Auth modes:** enable `Device Flow`; keep OAuth-during-install disabled
4. **Permissions:**
   - Repository → `Contents`: Read and write
   - Repository → `Metadata`: Read-only
   - Repository → `Commit statuses`: Read and write
5. **Events:** subscribe to `Push`
6. **Credentials:** copy App ID, Client ID, Client Secret, and private key into `.env`

For live local testing, use ngrok:

```bash
npm run proxy:dev   # Start proxy on :8080 (/v1/* → API, else → web)
ngrok http 8080     # Expose :8080 publicly
```

Use the ngrok URL in `NIBRAS_API_BASE_URL`, `NIBRAS_WEB_BASE_URL`, and the GitHub App settings. Update GitHub App URLs whenever the tunnel rotates.

---

## Optional Integrations

### AI Grading

When `NIBRAS_AI_API_KEY` is set, the worker runs semantic grading after verification and pre-fills the instructor review form with:

- Confidence scores and criterion breakdowns
- Reasoning summaries and evidence quotes
- Auto-flagging of low-confidence submissions for human review

| Env var                    | Default       | Description                                                      |
| -------------------------- | ------------- | ---------------------------------------------------------------- |
| `NIBRAS_AI_API_KEY`        | —             | Enables AI grading                                               |
| `NIBRAS_AI_MODEL`          | `gpt-4o-mini` | Model name                                                       |
| `NIBRAS_AI_BASE_URL`       | OpenAI        | Override for Azure, Ollama, or other OpenAI-compatible providers |
| `NIBRAS_AI_MIN_CONFIDENCE` | `0.8`         | Submissions below this threshold are flagged for review          |

Omit `NIBRAS_AI_API_KEY` to disable entirely — no other changes required.

### Email Notifications

When `RESEND_API_KEY` is set, transactional emails are sent automatically:

| Trigger                                              | Recipient                      |
| ---------------------------------------------------- | ------------------------------ |
| Submission verified (passed / failed / needs review) | Student                        |
| Submission flagged for human review                  | All course instructors and TAs |
| Instructor submits a review                          | Student                        |

```env
RESEND_API_KEY=re_...
NIBRAS_EMAIL_FROM=Nibras <noreply@yourdomain.com>
```

The sender address must be a verified domain in your Resend account. Omit `RESEND_API_KEY` to disable.

### Commit Status Checks

After every verified submission, the worker posts a GitHub commit status to the student's repo:

| Nibras status  | GitHub badge | Label                                     |
| -------------- | ------------ | ----------------------------------------- |
| `passed`       | ✅ green     | All tests passed                          |
| `failed`       | ❌ red       | Tests failed                              |
| `needs_review` | 🔄 pending   | Tests passed — awaiting instructor review |

Requires the GitHub App to have **Commit statuses: Read and write** and the student to have completed the app install flow. Skipped silently if either is missing.

### GitHub Repository Validation

Before a submission can be created from the web dashboard, the submission modal calls:

```
POST /v1/github/repositories/validate
{ "repoUrl": "https://github.com/owner/repo" }
```

This checks that:

1. The URL is a valid GitHub repository URL
2. The authenticated user has a linked GitHub account
3. The user has **admin or write** permission on the repository

The response includes `owner`, `name`, `defaultBranch`, `visibility`, and `permission`. The modal blocks submission if any check fails and prompts the student to install the GitHub App or fix their repo URL.

### Grade Export

Download a CSV of all grades for a course:

```
GET /v1/tracking/courses/:courseId/grades.csv
```

One row per student, one column per milestone across all projects. Cell values are the review score when one exists, or the submission status otherwise.

### Course Switching

The student dashboard and project views support switching between multiple enrolled courses without leaving the page. The selected course is persisted in:

- The URL search parameter (`?courseId=...`) — shareable and browser-history friendly
- `localStorage` via `prefs` — restored on next visit

### Admin Features

Users with `systemRole: "admin"` (super-admins) get additional capabilities:

| Surface         | Feature                                                             |
| --------------- | ------------------------------------------------------------------- |
| Settings page   | Super-admin badge and total accessible-course count displayed       |
| API             | Access to all courses regardless of enrollment                      |
| Auto-enrollment | New users are auto-enrolled in CS161; admins see all active courses |

The `systemRole` field is returned by `/v1/web/session` and included in the `UserSchema` contracts type.

### Metrics (Prometheus + Grafana)

The API exposes a `/metrics` endpoint (Prometheus format). A pre-built Grafana dashboard is at `grafana/nibras-dashboard.json`.

---

## Production Deployment

See `DEPLOY.md` and `docs/ops-guide.md` for the full production guide.

Quick reference:

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Apply migrations
npm run db:deploy

# Check health
curl https://your-domain/v1/health
```

Nginx config lives in `nginx/`. A `docker-compose.prod.yml` runs API + worker + web + Postgres.

---

## Testing

```bash
npm run test               # Build then run all tests (node --test)
node --test test/<file>.js # Run a single test file
npm run build              # Build all packages in dependency order
```

For the full manual validation sequence, see `TEST.md`.

---

## CI/CD

**`.github/workflows/ci.yml`** — runs on every push and PR:

1. Spin up Postgres 16
2. `npm ci` → `db:generate` → `db:deploy`
3. Lint (`eslint` + `prettier --check`)
4. Build all packages
5. Run tests
6. Build web app (`next build`)

**`.github/workflows/release.yml`** — triggers on `v*` tags:

1. Verify the tag matches the root and CLI package versions (hardened check — exits on mismatch)
2. Verify `NPM_TOKEN` is configured and can authenticate to npm
3. Build all packages
4. Dry-run the CLI publish tarball
5. Publish `@nibras/cli` to npm (public)
6. Create a GitHub Release with auto-generated notes

Requires an `NPM_TOKEN` Actions secret that can publish `@nibras/cli`. If your npm account enforces 2FA for writes, this should be a granular token that can bypass 2FA for publishing.

**`.github/workflows/deploy.yml`** — triggers on every push to `main`:

Deploys the Next.js web app to Fly.io automatically:

```yaml
flyctl deploy \
--config fly.web.toml \
--app nibras-web \
--build-arg NEXT_PUBLIC_NIBRAS_API_BASE_URL=https://nibras-api.fly.dev \
--build-arg NEXT_PUBLIC_NIBRAS_WEB_BASE_URL=https://nibras-web.fly.dev \
--remote-only
```

Requires a `FLY_API_TOKEN` Actions secret. Only one deploy runs at a time; newer pushes cancel in-progress deploys automatically.

---

## License

See `LICENSE`.
