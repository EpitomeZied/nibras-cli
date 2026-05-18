# Nibras — Course Operations Platform

![Nibras](https://img.shields.io/badge/Version-1.0.2-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Node](https://img.shields.io/badge/Node-≥18-brightgreen.svg)
![NPM](https://img.shields.io/badge/npm-≥9-brightgreen.svg)

> A comprehensive, hosted course operations platform designed for CS education. Nibras enables students to set up projects, run local tests, and submit work via an intelligent CLI; gives instructors powerful tools for course management, submission review, and analytics; and provides operators with production-ready infrastructure for deployment and monitoring.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
  - [Local Development](#local-development)
  - [CLI Installation](#cli-installation)
- [Student Workflow](#student-workflow)
- [CLI Command Reference](#cli-command-reference)
- [Configuration & Environment](#configuration--environment)
- [GitHub App Setup](#github-app-setup)
- [Database Management](#database-management)
- [Deployment](#deployment)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Nibras is a modern, full-stack course operations platform built specifically for computer science education. It seamlessly integrates with GitHub and provides three distinct user experiences:

| User Role | Primary Activity | Key Tools |
|-----------|------------------|-----------|
| **Students** | Project setup, local testing, work submission | CLI (`nibras`) commands, task viewer |
| **Instructors** | Course management, project creation, submission review, analytics | Web dashboard, export tools, review interface |
| **Operators** | System deployment, monitoring, infrastructure management | Docker, Kubernetes, monitoring dashboards |

### Core Value Proposition

- **Simplicity for Students**: One command to set up, test, and submit work
- **Visibility for Instructors**: Real-time insights into student progress, submission status, and aggregate metrics
- **Reliability for Operators**: Production-ready infrastructure with optional AI grading, email notifications, and distributed job processing

---

## Key Features

### Student Experience
✅ **Device Flow Authentication** — Secure GitHub login without storing credentials  
✅ **Project Bootstrapping** — One-command project setup with starter code and task descriptions  
✅ **Local Testing** — Run tests locally before submission with guaranteed environment consistency  
✅ **Smart Submissions** — Automatic file staging, commit creation, and push to GitHub  
✅ **Real-time Status** — Live submission status updates and verification results  
✅ **Project Discovery** — List and filter enrolled courses and projects  

### Instructor Experience
✅ **Course Management** — Create and configure courses, projects, and milestones  
✅ **Submission Tracking** — View all submissions with detailed metadata and status filters  
✅ **Code Review Interface** — In-app code review with diff viewing and commenting  
✅ **Analytics Dashboard** — Per-course submission metrics, milestone progress, and student activity  
✅ **Bulk Operations** — Retry failed submissions, update grades, export results  
✅ **Notifications** — In-app and email notifications for review-ready and graded work  

### Platform Features
✅ **Optional AI Grading** — Semantic grading with configurable confidence thresholds  
✅ **Notification System** — In-app notifications, email alerts, and preference controls  
✅ **Audit Logging** — Complete audit trail of all platform operations  
✅ **Job Queue** — Redis-backed BullMQ for instant job dispatch (with DB-polling fallback)  
✅ **SSE Streams** — Live submission updates via Server-Sent Events  
✅ **Multi-Course Support** — Isolated courses with independent project configurations  

### System Updates (Latest)

- **CLI Improvements**: `nibras list`, `nibras status`, and `nibras submit --milestone <slug>` fully integrated
- **Live Submission UX**: Web app streams submission state via SSE for real-time updates
- **Analytics**: Per-course student analytics and instructor class-wide milestone tracking
- **Notifications**: Built-in notification preferences, unread counts, and per-type controls
- **Admin Operations**: Audit log browsing, bulk submission retry, enhanced review tooling
- **Submission Control**: Cancelled submissions tracked and queryable by status
- **Job Dispatch**: Redis/BullMQ for instant processing with graceful DB polling fallback
- **Grading Intelligence**: AI confidence thresholds push work to `needs_review` with automatic instructor notification

---

## Architecture

### System Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     Student CLI (@nibras/cli)               │
│                    Instructor Web Dashboard                 │
│                        (Next.js 15/React)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      API (Fastify)                          │
│          ├─ Device Flow OAuth / GitHub Integration          │
│          ├─ Project Setup & Manifest Management             │
│          ├─ Submission Pipeline & Verification              │
│          ├─ Tracking & Analytics Engine                     │
│          └─ Webhook & Event Processing                      │
└────┬──────────────────────────────────────────────────────┬─┘
     │                                                      │
     ▼                                                      ▼
┌──────────────────────┐              ┌──────────────────────┐
│  PostgreSQL Database │              │   GitHub Repositories│
│  (Prisma ORM)        │              │   (via GitHub App)   │
└──────────────────────┘              └──────────────────────┘
     ▲                                                      │
     │                                                      │
     └──────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Worker Service                         │
│          ├─ Submission Verification & Testing               │
│          ├─ AI Grading Pipeline                             │
│          ├─ Job Queue Consumer (BullMQ/Polling)             │
│          ├─ Email Notification Dispatcher                   │
│          └─ Health & Metrics Reporting                      │
└─────────────────────────────────────────────────────────────┘
     ▲
     │ Optional
     ▼
┌──────────────────────┐    ┌──────────────────────┐
│    Redis (BullMQ)    │    │  Sentry (Monitoring) │
│    (Job Queue)       │    │  Resend (Email)      │
└──────────────────────┘    └──────────────────────┘
```

### Runtime Components

| Component | Purpose | Technology | Port |
|-----------|---------|-----------|------|
| **API Server** | REST API, authentication, project setup, submissions, tracking | Fastify, Node.js | `4848` |
| **Web App** | Instructor dashboard, student progress, submission review | Next.js 15, React 19 | `3000` |
| **Worker** | Async verification, grading, job processing, notifications | Node.js, BullMQ | `9090` (health) |
| **Proxy** | Local dev proxy for same-origin GitHub callbacks | Node.js HTTP | `8080` |
| **Database** | Persistent data storage, migrations, schema management | PostgreSQL 16+ | `5432` |

### Shared Packages (Dependency Order)

| Package | Purpose | Exports |
|---------|---------|---------|
| `@nibras/contracts` | Zod schemas, TypeScript types, API contracts | Type definitions, validators |
| `@nibras/core` | CLI utilities, API client, config/manifest management, git operations | Client, helpers, types |
| `@nibras/github` | GitHub App JWT signing, webhook HMAC validation | Auth helpers |
| `@nibras/grading` | AI semantic grading runner, OpenAI-compatible interface | Grading engine, types |

### Data Flow Examples

#### Device Login Flow
```
1. Student: nibras login --api-base-url <url>
2. CLI requests device code from API
3. API generates device code, shows authorization URL
4. Student opens URL in browser, authorizes CLI app
5. API exchanges device code for GitHub OAuth token
6. Token stored in ~/.nibras/cli.json (encrypted)
7. CLI now authenticated for all operations
```

#### Submission Flow
```
1. Student: nibras submit
2. CLI stages tracked files to index
3. CLI commits with metadata to git
4. CLI pushes to linked GitHub repository
5. API creates submission record with status=queued
6. Worker picks up job (via BullMQ or polling)
7. Worker runs verification tests in isolated environment
8. Worker updates submission status and stores results
9. Web app streams status updates via SSE to instructor
10. Instructor reviews and grades submission
```

#### Grading Flow (Optional)
```
1. Worker receives verified submission
2. Worker calls AI grading service (if NIBRAS_AI_API_KEY set)
3. AI returns semantic grade and confidence score
4. If confidence < NIBRAS_AI_MIN_CONFIDENCE, push to needs_review
5. Instructor notified of review-needed submissions
6. Instructor reviews and approves/corrects grade
7. Final grade stored and exported
```

---

## Quick Start

### Requirements

Before you begin, ensure you have:

- **Node.js** `>=18.0.0`
- **npm** `>=9.0.0`
- **git** (version 2.0+)
- **Docker & Docker Compose** (for local database)
- **PostgreSQL CLI tools** (`pg_isready` for health checks)

Verify your setup:
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be v9.0.0 or higher
docker --version
docker-compose --version
```

### Local Development

#### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/NibrasPlatform/nibras-cli.git
cd nibras-cli

# Install all dependencies
npm ci
```

#### 2. Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Edit .env with your values:
# - GITHUB_APP_ID, GITHUB_APP_CLIENT_ID, etc.
# - DATABASE_URL (optional for local dev)
# - NIBRAS_ENCRYPTION_KEY (generate a random 32-char string)
nano .env
```

#### 3. Start the Full Development Stack

```bash
# This single command will:
# - Start PostgreSQL in Docker (if not running)
# - Apply database migrations
# - Build all packages
# - Start watch mode for file changes
# - Start the API server
# - Start the worker
# - Start the Next.js web app

npm run dev
```

**Expected output:**
```
> api listening on http://127.0.0.1:4848
> web ready on http://127.0.0.1:3000
> worker started
> watch mode enabled
```

#### 4. Verify the Setup

In a new terminal, check all services are healthy:

```bash
# API health
curl http://127.0.0.1:4848/v1/health

# Worker health
curl http://127.0.0.1:9090/healthz

# Web (open in browser)
open http://127.0.0.1:3000
```

#### Service Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| **API** | `http://127.0.0.1:4848` | Main backend API |
| **API Health** | `http://127.0.0.1:4848/v1/health` | Health check endpoint |
| **Web** | `http://127.0.0.1:3000` | Instructor dashboard |
| **Proxy** | `http://127.0.0.1:8080` | Local OAuth callback proxy |
| **Worker Health** | `http://127.0.0.1:9090/healthz` | Worker health endpoint |

### CLI Installation

#### Install from NPM (Global)

The published `@nibras/cli` package is available on npm:

```bash
# Install the latest stable version
npm install -g @nibras/cli

# Or install a specific version
npm install -g @nibras/cli@1.0.2

# Verify installation
nibras --version
```

#### Build and Install Locally

To test your local changes:

```bash
# Build the CLI package
npm run build

# Link it globally for testing
cd apps/cli
npm link

# Test it
nibras --version

# Unlink when done
npm unlink @nibras/cli
```

#### First Login

```bash
# Login to a Nibras instance
nibras login --api-base-url https://nibras.yourschool.edu

# This will:
# 1. Show you a device authorization URL
# 2. Wait for you to authorize in your browser
# 3. Save your token to ~/.nibras/cli.json
```

---

## Student Workflow

### Complete Example: CS161 Lab 1

```bash
# Step 1: Login once per device
$ nibras login --api-base-url https://nibras.stanford.edu
? Device code: ABCD-1234
? Go to: https://github.com/login/device
✓ Authorization complete!
✓ Saved to ~/.nibras/cli.json

# Step 2: List your courses and projects
$ nibras list
Courses:
  cs161 - Computer Security
    ├─ lab1 (Core)
    ├─ lab2 (Core)
    └─ project (Milestone 1, Milestone 2)

# Step 3: Set up a specific project
$ nibras setup --project cs161/lab1
✓ Created .nibras/project.json
✓ Downloaded starter code
✓ Ready to start!

# Step 4: Read the task instructions
$ nibras task
CS161 Lab 1: Buffer Overflow Exploits
================================
Due: 2026-05-24

Your task: [detailed instructions...]

# Step 5: Run the public test suite
$ nibras test
Running public tests...
  ✓ test_basic_overflow (45ms)
  ✓ test_environment_variable (67ms)
  ✓ test_file_input (89ms)
✓ All tests passed! (2/2)

# Step 6: Submit your work
$ nibras submit
Running tests before submission...
✓ All tests passed!

Staging files...
✓ Staged 5 files

Committing...
✓ Created commit abc123def

Pushing...
✓ Pushed to origin/main

Submitted! Submission ID: sub_abc123
Waiting for verification... ⏳

(After verification completes)
✓ Verification passed
✓ Ready for instructor review

# Step 7: Check submission status
$ nibras status
Recent submissions:
  cs161/lab1
    Status: passed ✓
    Submitted: 2026-05-10T14:23:45Z
    Grade: Pending Review
    URL: https://nibras.stanford.edu/submissions/sub_abc123
```

### Common Workflows

#### Re-submit with Fixes

```bash
# Make changes to your code
vim src/exploit.c

# Run tests locally
nibras test

# If tests pass, submit again
nibras submit

# Check status
nibras status
```

#### Submit for a Specific Milestone

```bash
# If your project has milestones, target one
nibras submit --milestone "milestone-1"

# View all available milestones
nibras list --verbose
```

#### Check Previous Test Results

```bash
# View test output from last submission
nibras test --previous

# Or submit with debug output
DEBUG=* nibras submit
```

#### Verify Environment

```bash
# Quick health check
nibras ping

# This verifies:
# ✓ API is reachable
# ✓ You are authenticated
# ✓ Your GitHub app is installed
# ✓ Your project repo exists
```

---

## CLI Command Reference

### Authentication

#### `nibras login`
Authenticate the CLI with a hosted Nibras instance.

```bash
# Login to a specific instance
nibras login --api-base-url https://nibras.yourschool.edu

# Don't open browser automatically
nibras login --api-base-url https://nibras.yourschool.edu --no-open

# Reset to a different instance
nibras logout
nibras login --api-base-url https://different-instance.edu
```

**Stores:** Token to `~/.nibras/cli.json` (encrypted)

#### `nibras logout`
Clear the local CLI session.

```bash
nibras logout
```

**Removes:** Token from `~/.nibras/cli.json`

#### `nibras whoami`
Show the currently authenticated user and linked GitHub account.

```bash
$ nibras whoami
Logged in as: alice@stanford.edu
GitHub: @alice-github
API: https://nibras.stanford.edu
```

### Project Discovery

#### `nibras list`
List all enrolled courses and available projects.

```bash
# Basic listing
$ nibras list
Courses:
  cs161 - Computer Security (4 projects)
  cs161b - Applied Cryptography (2 projects)

# Detailed view with milestones
$ nibras list --verbose
cs161 - Computer Security
  ├─ lab1 (Core project)
  ├─ lab2 (Core project)
  └─ final-project (Milestones: part1, part2, part3)
```

#### `nibras status`
Show recent submission statuses across all projects.

```bash
$ nibras status
cs161/lab1
  Submission 1: passed ✓ (2 days ago)
    Grade: 95/100
    Review: Complete
  Submission 2: failed ✗ (1 day ago)
    Status: failed_tests
    Review: Pending

cs106L/warmup
  Submission 1: cancelled ⊘ (3 days ago)
    Reason: Manual cancellation
```

### Project Setup

#### `nibras setup`
Bootstrap a local project from the hosted manifest.

```bash
# Setup a specific project
nibras setup --project cs161/lab1

# This will:
# ✓ Create .nibras/project.json
# ✓ Copy starter code to working directory
# ✓ Download task instructions to .nibras/task.md
# ✓ Initialize git repo (if needed)
# ✓ Add remote origin (if needed)
```

**Creates:**
- `.nibras/project.json` — Project manifest and configuration
- `.nibras/task.md` — Task instructions and requirements
- Starter code files in current directory

#### `nibras task`
Display the current project's task instructions.

```bash
# Print task instructions
nibras task

# Save to file
nibras task > task-backup.txt

# Open in editor
nibras task | less
```

**Source:** `.nibras/task.md` (created during `nibras setup`)

### Testing

#### `nibras test`
Run the project's public test suite locally.

```bash
# Run all tests
nibras test

# Expected output:
# Running public tests...
#   ✓ test_basic_functionality (125ms)
#   ✓ test_edge_case (89ms)
#   ✓ test_performance (234ms)
# ✓ All tests passed! (3/3)

# Run with previous output
nibras test --previous

# Run with verbose output
DEBUG=* nibras test
```

**Runs:** Test command defined in `.nibras/project.json` (e.g., `npm test`, `./run-tests.sh`)

**Note:** Tests must pass before submission (unless `--force` is used).

### Submission

#### `nibras submit`
Stage files, commit, push, and submit your work.

```bash
# Simple submission
nibras submit

# Submit with all flags
nibras submit --force --milestone "part-1"

# What it does:
# 1. Runs local tests (stops if failed, unless --force)
# 2. Stages tracked files to git index
# 3. Creates commit with submission metadata
# 4. Pushes to origin/main
# 5. Creates submission record on API
# 6. Waits for verification to complete
```

**Options:**
- `--force` — Skip local test pass requirement
- `--milestone <slug>` — Target a specific milestone

**Returns:** Submission ID for tracking

#### `nibras ping`
Quick health check of API, auth, GitHub, and project state.

```bash
$ nibras ping
✓ API is reachable
✓ Authenticated (alice@stanford.edu)
✓ GitHub installed on account
✓ Repository exists and is accessible
✓ Project configuration is valid
All systems operational!
```

### Updates & Maintenance

#### `nibras update`
Check for or install CLI updates.

```bash
# Check for available updates
nibras update --check
# Output: You have 1.0.2. Latest is 1.0.3 (new features).

# Install latest version
nibras update

# Install specific version
nibras update --version v1.0.2
```

#### `nibras uninstall`
Remove the global CLI installation.

```bash
nibras uninstall
# Removes: npm global package and ~/.nibras/ config
```

#### `nibras update-buildpack`
Update the Node.js version for this project.

```bash
# Upgrade to Node 20
nibras update-buildpack --node 20

# This updates: .nibras/project.json
# Worker will use Node 20 for next verification
```

### Legacy Commands

#### `nibras legacy`
Run the legacy subject/project CLI (for backwards compatibility).

```bash
nibras legacy
# Loads: src/cli.js (CommonJS legacy CLI)
```

---

## Configuration & Environment

### Environment Variables

Nibras uses environment variables for all configuration. Copy `.env.example` to `.env` and fill in your values.

#### Required Configuration

##### Database
```bash
# PostgreSQL connection string
# Format: postgresql://user:password@host:port/database
DATABASE_URL=postgresql://nibras:password@localhost:5432/nibras
```

##### Encryption
```bash
# 32-character random string for encrypting sensitive data
# Generate with: openssl rand -hex 16
NIBRAS_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

##### GitHub App
```bash
# Create app at: https://github.com/settings/apps/new
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=abc123def456...
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GITHUB_APP_NAME=nibras-dev
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
```

##### Application URLs
```bash
# Must match GitHub App redirect URLs
NIBRAS_API_BASE_URL=http://localhost:4848
NIBRAS_WEB_BASE_URL=http://localhost:3000

# Production example:
# NIBRAS_API_BASE_URL=https://api.nibras.stanford.edu
# NIBRAS_WEB_BASE_URL=https://nibras.stanford.edu
```

##### Web app external services
The web app ports student-dashboard features (Gamification, AI Tutor, Community,
Competitions, Analytics) that talk to external production backends directly
from the browser. Each `NEXT_PUBLIC_*` URL below is whitelisted under
`connect-src` of the CSP set in `apps/web/next.config.ts`.
```bash
NEXT_PUBLIC_NIBRAS_ADMIN_API_URL=https://nibras-backend.up.railway.app/api
NEXT_PUBLIC_NIBRAS_COMMUNITY_API_URL=https://nibras-backend.up.railway.app/api
NEXT_PUBLIC_NIBRAS_TRACKING_API_URL=https://nibras-api.fly.dev
NEXT_PUBLIC_NIBRAS_COMPETITIONS_API_URL=https://nibras-backend.up.railway.app/api
NEXT_PUBLIC_NIBRAS_RECOMMENDATION_API_URL=https://recommendationmodel-production-0f8e.up.railway.app/api
```
Per-tab debug override: append `?adminApi=…&communityApi=…&trackingApi=…&competitionsApi=…&recommendationApi=…`
to the URL, or set the matching `nibras_<service>_api_url` localStorage key.
External backends must respond with `Access-Control-Allow-Origin: <web origin>`
and `Access-Control-Allow-Headers: Authorization, Content-Type`.

#### Optional Configuration

##### Job Queue (Redis)
```bash
# Enable instant job dispatch (recommended for production)
REDIS_URL=redis://localhost:6379

# Worker concurrency (default: 5)
WORKER_CONCURRENCY=10
```

##### Worker Tuning
```bash
# Poll interval for database job checks (default: 5000ms)
WORKER_POLL_INTERVAL_MS=3000

# Health check port (default: 9090)
WORKER_HEALTH_PORT=9090

# Run tests in sandbox mode (default: true)
WORKER_SANDBOX_MODE=true
```

##### Email Notifications
```bash
# Resend API key for email notifications
RESEND_API_KEY=re_...

# From address for emails
NIBRAS_EMAIL_FROM=nibras@yourschool.edu
```

##### Monitoring & Metrics
```bash
# Sentry DSN for error tracking
SENTRY_DSN=https://...@sentry.io/...

# Metrics collection token
NIBRAS_METRICS_TOKEN=your_metrics_token
```

##### AI Grading
```bash
# OpenAI-compatible API key
NIBRAS_AI_API_KEY=sk-...

# Model to use (e.g., gpt-4, gpt-3.5-turbo)
NIBRAS_AI_MODEL=gpt-4

# Custom API endpoint (if not OpenAI)
NIBRAS_AI_BASE_URL=https://api.openai.com/v1

# Minimum confidence threshold (0.0-1.0, default: 0.85)
NIBRAS_AI_MIN_CONFIDENCE=0.85
```

### Environment Validation

Validate your configuration before deploying:

```bash
# Check all required variables are set
npm run validate:env

# Output:
# ✓ DATABASE_URL is set
# ✓ GITHUB_APP_ID is set
# ✓ GITHUB_APP_CLIENT_ID is set
# ... (checks all required variables)
# All required environment variables are configured!
```

### Runtime Behavior

**Database Polling (Default)**
- When `REDIS_URL` is unset, the worker polls the database for jobs
- Poll interval: `WORKER_POLL_INTERVAL_MS` (default: 5000ms)
- Suitable for small deployments with low submission volume

**Job Queue with Redis (Recommended)**
- When `REDIS_URL` is set, the API enqueues jobs to BullMQ
- Worker consumes jobs with zero latency
- Concurrency controlled by `WORKER_CONCURRENCY`
- Recommended for production and high-volume scenarios

**Email Notifications**
- When `RESEND_API_KEY` is set, email notifications are sent
- Subscription status controlled via user preferences
- When unset, in-app notifications still function

**Error Monitoring**
- When `SENTRY_DSN` is set, errors are sent to Sentry
- When unset, errors are logged locally only

**AI Grading**
- When `NIBRAS_AI_API_KEY` is set, submissions are graded automatically
- When unset, all submissions default to `needs_review` status
- Confidence threshold determines if grade is auto-approved

---

## GitHub App Setup

Nibras requires a GitHub App for:
- Device flow authentication (CLI and web)
- Repository access (for cloning starter code, pushing submissions)
- Webhook processing (for repository events)

### Creating the App

1. **Navigate to GitHub Settings:**
   ```
   https://github.com/settings/apps/new
   ```

2. **Fill in Basic Information:**
   - **App name:** `nibras-dev` (or your instance name)
   - **Homepage URL:** `http://localhost:3000` (or your public URL)
   - **Webhook URL:** `http://localhost:4848/v1/github/webhooks` (required for receiving events)
   - **Webhook secret:** Generate a random string (store in `GITHUB_WEBHOOK_SECRET`)

3. **Configure Permissions:**
   - **Repository permissions:**
     - Contents: Read & Write
     - Metadata: Read only
     - Commit statuses: Read & Write
   - **User permissions:**
     - Email addresses: Read only

4. **Enable Features:**
   - ✅ **Device Flow:** Required for CLI authentication
   - ✅ **Webhooks:** Required for real-time repository updates

5. **Set Authorization Callbacks:**
   - **Authorization callback URL:** `http://localhost:4848/v1/github/oauth/callback`
   - **Setup URL:** `http://localhost:3000/install/complete`

6. **Copy Your Credentials:**
   - **App ID:** Copy to `GITHUB_APP_ID`
   - **Client ID:** Copy to `GITHUB_APP_CLIENT_ID`
   - **Client Secret:** Copy to `GITHUB_APP_CLIENT_SECRET`
   - **Private Key:** Generate and download, copy to `GITHUB_APP_PRIVATE_KEY`

7. **Verify Installation:**
   ```bash
   npm run dev
   open http://localhost:3000
   # You should be able to start the login flow
   ```

### Local Testing with ngrok

For testing webhooks locally:

```bash
# Terminal 1: Start the dev server
npm run dev

# Terminal 2: Start ngrok tunnel
ngrok http 8080

# Update GitHub App settings with ngrok URL:
# Webhook URL: https://xxx.ngrok.io/v1/github/webhooks
# Callback URL: https://xxx.ngrok.io/v1/github/oauth/callback

# Update .env
NIBRAS_API_BASE_URL=https://xxx.ngrok.io
NIBRAS_WEB_BASE_URL=https://xxx.ngrok.io
```

### GitHub App Permissions Explained

| Permission | Purpose | Why Needed |
|-----------|---------|-----------|
| **Contents** (R/W) | Read/write repository code | Push submissions, clone starter code |
| **Metadata** (R) | Read repository metadata | Get repo info, commit history |
| **Commit Statuses** (R/W) | Update commit status checks | Show test results on GitHub |
| **Email** (R) | Read user email | Link GitHub account to Nibras user |

---

## Database Management

Nibras uses PostgreSQL with Prisma ORM. Schema lives in `prisma/schema.prisma`.

### Common Commands

#### Generate Prisma Client
Run after editing the schema:
```bash
npm run db:generate
```

#### Push Schema (Development Only)
Apply schema changes without creating a migration:
```bash
npm run db:push
```

#### Create a Migration
Create a named migration for version control:
```bash
npm run db:migrate

# Follow the prompts:
# ? Enter migration name: add_milestone_table
# Created: prisma/migrations/20260510_add_milestone_table/migration.sql
```

#### Apply Migrations (Production Path)
Apply all pending migrations:
```bash
npm run db:deploy
```

#### Reset Local Database
**Destructive operation** — tears down and recreates the local database:
```bash
npm run db:local:reset

# This will:
# ✓ Stop Docker container
# ✓ Delete volume
# ✓ Start fresh container
# ✓ Apply all migrations
```

### Viewing the Schema

```bash
# Open Prisma Studio (web UI for database)
npx prisma studio

# Navigate to: http://localhost:5555
```

### Creating Migrations for Production

```bash
# 1. Edit prisma/schema.prisma
vim prisma/schema.prisma

# 2. Create a migration
npm run db:migrate
# Prompts for migration name
# Creates: prisma/migrations/<timestamp>_<name>/migration.sql

# 3. Review the generated SQL
cat prisma/migrations/*/migration.sql

# 4. Test locally
npm run build
npm run test

# 5. Commit to git
git add prisma/
git commit -m "migration: add milestone_id to submissions"

# 6. Deploy will run: npm run db:deploy
```

---

## Deployment

### Quick Production Start

```bash
# Using Docker Compose (full stack)
docker compose -f docker-compose.prod.yml up -d

# Apply migrations
npm run db:deploy

# Verify health
curl http://localhost:4848/v1/health
```

### Docker Images

Build individual service images:

```bash
# API service
docker build -f Dockerfile.api -t nibras-api:latest .

# Worker service  
docker build -f Dockerfile.worker -t nibras-worker:latest .

# Web application
docker build -f Dockerfile.web -t nibras-web:latest .
```

### Production Configuration

Create `.env.prod`:
```bash
cp .env.prod.example .env.prod
```

Key differences from development:
- Disable `WORKER_SANDBOX_MODE` for performance
- Set production `NIBRAS_API_BASE_URL` and `NIBRAS_WEB_BASE_URL`
- Configure `REDIS_URL` for job dispatch
- Set `SENTRY_DSN` for monitoring
- Set `RESEND_API_KEY` for email notifications
- Set `NIBRAS_AI_API_KEY` for AI grading (optional)

### Fly.io Deployment

Deploy to Fly.io using provided configuration:

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Authenticate
flyctl auth login

# Deploy API
flyctl deploy -c fly.api.toml

# Deploy Worker
flyctl deploy -c fly.worker.toml

# Deploy Web
flyctl deploy -c fly.web.toml

# Check status
flyctl status
```

### GitHub Actions CI/CD

The repository includes automated workflows:

**Continuous Integration (`ci.yml`):**
- Lint all code
- Validate environment
- Generate Prisma client
- Build all packages
- Run test suite
- Build Next.js web app

**Release (`release.yml`):**
- Triggered on `v*` git tags
- Publishes `@nibras/cli` to npm
- Creates GitHub Release with auto-generated notes
- Requires `NPM_TOKEN` secret

**Deployment (`deploy.yml`):**
- Triggered on pushes to `main`
- Deploys API, worker, web to Fly.io
- Runs database migrations

### Monitoring & Observability

#### Health Checks

```bash
# API health
curl http://your-api.com/v1/health

# Worker health  
curl http://your-worker.com:9090/healthz
```

#### Logs

```bash
# Docker Compose
docker compose -f docker-compose.prod.yml logs -f api

# Fly.io
flyctl logs -a nibras-api

# Structured logging available via Sentry
```

#### Metrics

Configure `NIBRAS_METRICS_TOKEN` to enable metrics collection and dashboards.

### Disaster Recovery

#### Database Backup

```bash
# Local backup
docker exec nibras-db pg_dump -U nibras nibras > backup.sql

# Restore from backup
cat backup.sql | docker exec -i nibras-db psql -U nibras -d nibras
```

#### Submission Retry

Use the admin dashboard to retry failed submissions:

```
Admin → Submissions → Filter: failed
→ Select submissions → Retry
```

#### Clearing Job Queue

```bash
# If Redis is stuck, flush and restart worker
redis-cli FLUSHDB
docker restart nibras-worker
```

---

## Development

### Repository Structure

```
nibras-cli/
├── apps/
│   ├── api/              # Fastify REST API
│   │   ├── src/
│   │   │   ├── server.ts       # Server setup & middleware
│   │   │   ├── app.ts          # Route definitions
│   │   │   ├── features/       # Feature modules (auth, submissions, etc)
│   │   │   └── lib/            # Shared utilities
│   │   ├── test/
│   │   └── package.json
│   ├── cli/              # @nibras/cli npm package
│   │   ├── src/          # TypeScript source
│   │   ├── dist/         # Compiled JavaScript
│   │   └── package.json
│   ├── web/              # Next.js instructor dashboard
│   │   ├── app/          # Next.js App Router
│   │   ├── components/   # React components
│   │   └── package.json
│   ├── worker/           # Async job processor
│   │   ├── src/
│   │   │   ├── worker.ts       # Job consumer loop
│   │   │   ├── verification.ts # Test runner
│   │   │   ├── grading.ts      # AI grading pipeline
│   │   │   ├── email.ts        # Email dispatcher
│   │   │   └── health.ts       # Health endpoint
│   │   └── package.json
│   └── proxy/            # Local development proxy
│
├── packages/
│   ├── contracts/        # Zod schemas & types
│   ├── core/             # CLI utilities & API client
│   ├── github/           # GitHub App helpers
│   └── grading/          # AI grading engine
│
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Schema migrations
│
├── test/                 # Test suite
│   ├── api/
│   ├── cli/
│   └── integration/
│
├── src/                  # Legacy CommonJS CLI (fallback)
├── bin/                  # Root nibras entrypoint
├── docs/                 # Documentation
└── .github/workflows/    # GitHub Actions CI/CD
```

### Build System

```bash
# Build all packages in dependency order
npm run build

# Build specific workspace
npm run build -w apps/api

# Watch mode (rebuilds on file change)
npm run dev

# Clean build artifacts
npm run clean
```

### Linting & Formatting

```bash
# Lint all workspaces
npm run lint

# Auto-fix issues
npm run lint:fix

# ESLint uses flat config: eslint.config.mjs
# Prettier is run as ESLint plugin
```

### TypeScript Configuration

- All packages extend `tsconfig.base.json`
- Target: ES2022
- Module: CommonJS (for Node.js)
- Strict mode enabled
- Each workspace compiles independently

---

## Testing

### Test Suites

```bash
# Run all tests
npm run test

# Run specific test file
node --test test/cli-docs.test.js

# Run with verbose output
node --test test/*.js --reporter=spec

# Run with coverage (if configured)
npm run test:coverage
```

### Manual Validation

See [TEST.md](TEST.md) for comprehensive manual testing procedures.

### CI/CD Testing

GitHub Actions automatically:
- Runs linter on all PRs
- Builds all packages
- Runs test suite
- Builds Next.js web app
- Validates environment variables

All checks must pass before merging to `main`.

---

## Troubleshooting

### Common Issues

#### PostgreSQL Connection Failed

```bash
# Check Docker is running
docker ps

# Check PostgreSQL container health
docker logs nibras-db

# Verify DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
pg_isready -h localhost -p 5432 -U nibras
```

#### Worker Not Processing Jobs

```bash
# Check worker health
curl http://127.0.0.1:9090/healthz

# Check logs
docker logs nibras-worker

# If using Redis, verify connection
redis-cli PING

# Check for stuck jobs
redis-cli LLEN bull:nibras:submissions:wait
```

#### GitHub Authentication Issues

```bash
# Verify GitHub App ID and Client ID are correct
echo $GITHUB_APP_ID
echo $GITHUB_APP_CLIENT_ID

# Check webhook secret matches
# Settings → https://github.com/settings/apps/your-app

# Try re-authorizing
nibras logout
nibras login --api-base-url http://localhost:4848
```

#### Tests Failing Locally

```bash
# Build first
npm run build

# Run specific failing test
node --test test/cli-docs.test.js

# Check Node version matches requirement
node --version  # Should be >=18

# Clean dependencies
rm -rf node_modules package-lock.json
npm ci
npm run build
npm run test
```

#### Submission Verification Stuck

```bash
# Check worker is running
curl http://127.0.0.1:9090/healthz

# Check submission status in database
psql $DATABASE_URL -c "SELECT id, status, created_at FROM submissions ORDER BY created_at DESC LIMIT 5;"

# Retry submission from admin UI
# Or via API: POST /v1/admin/submissions/:id/retry
```

### Debugging

#### Enable Debug Logging

```bash
# Set DEBUG environment variable
DEBUG=* npm run dev

# Or for specific modules
DEBUG=nibras:* nibras submit
```

#### Enable Sentry in Local Development

Add to `.env`:
```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/xxx
```

#### Monitor Database Queries

```bash
# Enable Prisma query logging
DATABASE_LOG='query' npm run dev

# Or in code:
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

#### Worker Job Queue Inspection

```bash
# With Redis/BullMQ
redis-cli
> KEYS "bull:*"
> LRANGE "bull:nibras:submissions:wait" 0 -1
> HGETALL "bull:nibras:submissions:active"

# Monitor in real-time
> MONITOR

# Clear queue if stuck
> FLUSHDB
```

---

## Documentation

Comprehensive guides and references:

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | Developer guide for Claude Code integration |
| [docs/student-guide.md](docs/student-guide.md) | Complete student workflow guide |
| [docs/instructor-guide.md](docs/instructor-guide.md) | Instructor dashboard & tools guide |
| [docs/project-tracking.md](docs/project-tracking.md) | Project configuration & manifest spec |
| [docs/ops-guide.md](docs/ops-guide.md) | Operations & deployment guide |
| [docs/runbook.md](docs/runbook.md) | Operational runbook for common tasks |
| [DEPLOY.md](DEPLOY.md) | Detailed deployment instructions |
| [TEST.md](TEST.md) | Manual testing procedures |
| [docs/api-reference.pdf](docs/api-reference.pdf) | Complete API reference documentation |

---

## Contributing

We welcome contributions to Nibras! Here's how to get involved:

### Before You Start

1. **Check existing issues:** https://github.com/NibrasPlatform/nibras-cli/issues
2. **Review the architecture** in this README
3. **Understand the codebase** structure in [CLAUDE.md](CLAUDE.md)
4. **Set up local dev** using the [Local Development](#local-development) guide

### Development Workflow

```bash
# 1. Create a feature branch
git checkout -b feature/your-feature-name

# 2. Make your changes
# ... edit files ...

# 3. Build and test
npm run build
npm run test
npm run lint

# 4. Commit with clear message
git commit -m "feat: add description of what you changed"

# 5. Push and create PR
git push origin feature/your-feature-name

# 6. GitHub Actions will automatically:
# - Run linter
# - Build packages
# - Run tests
# - Build web app
# - Report status on PR
```

### Code Style

- Use **TypeScript** for all new code
- Follow **ESLint rules** (run `npm run lint:fix` to auto-fix)
- Use **Prettier** formatting (integrated with ESLint)
- Write **JSDoc comments** for public APIs
- Keep functions **small and focused**

### Commit Messages

Follow conventional commits format:

```
feat: add support for milestone-scoped submissions
fix: handle race condition in submission verification
docs: update deployment guide for Fly.io
test: add integration tests for job queue
```

### Pull Request Guidelines

1. **Title:** Clear, concise description (e.g., "Add milestone support to CLI")
2. **Description:** Explain the change and why it's needed
3. **Tests:** Include tests for new functionality
4. **Docs:** Update relevant documentation
5. **Backwards Compatibility:** Maintain compatibility with existing APIs

---

## License

Nibras is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

---

## Support

Need help? Here are your options:

- 📖 **Documentation:** Start with [docs/](docs/)
- 🐛 **Report Issues:** https://github.com/NibrasPlatform/nibras-cli/issues
- 💬 **Discussions:** https://github.com/NibrasPlatform/nibras-cli/discussions
- 📧 **Email:** epitomezied@gmail.com (if applicable)

---

## Acknowledgments

Built with ❤️ for CS education by the Nibras team.

**Technologies used:**
- Node.js, TypeScript, Fastify, Next.js/React, Prisma, PostgreSQL, Docker, GitHub API, OpenAI API

---

**Last Updated:** May 10, 2026  
**Version:** 1.0.2

