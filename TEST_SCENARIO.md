# Nibras Manual Test Scenario

This is the canonical manual validation path for Nibras.

## Purpose

A run is only considered successful if all of these are true:

- preflight passes
- fresh DB bootstrap succeeds
- API, web, and worker start cleanly
- GitHub OAuth succeeds
- GitHub App install succeeds
- CLI login, setup, and submit succeed
- webhook delivery is accepted
- submission transitions past `queued` to a terminal state

## Prerequisites

- Node.js 18+
- npm
- Docker
- git
- ngrok
- a GitHub App with the required permissions and events
- a GitHub account authorized to install and use that app

## Fresh Local Bootstrap

Start every acceptance run from a fresh local Postgres state.

```bash
cp .env.example .env
npm run db:local:reset
npm run db:local:migrate
npm run build
```

Notes:

- If you reuse an existing database without a reset, Prisma drift or data-loss warnings can block the workflow.
- The accepted manual-test path is always fresh-volume first.
- `npm run db:push` remains available for disposable development only. It is not part of the acceptance path.

## Local Preflight

Run the automated smoke gate before starting services:

```bash
npm run manual:preflight
```

Expected result:

- all Node tests pass
- the Next.js production build passes

## Local Stack Validation

Start the local stack in three terminals.

Terminal 1:

```bash
npm run api:dev
```

Terminal 2:

```bash
npm run worker:dev
```

Terminal 3:

```bash
npm run web:dev
```

Validate the running services:

```bash
curl http://127.0.0.1:4848/healthz
curl http://127.0.0.1:4848/readyz
curl http://127.0.0.1:9090/healthz
curl http://127.0.0.1:4848/v1/health
curl -I http://127.0.0.1:3000
```

Browser validation:

- open `http://127.0.0.1:3000/`
- confirm the home page renders

Expected result:

- all health endpoints return `{"ok":true}`
- the web app responds with HTTP 200
- none of the services crash on startup

## GitHub Live Validation

Use `.env.ngrok.example` for this phase.

### Configure the local stack

1. Copy the ngrok-ready env file.

```bash
cp .env.ngrok.example .env
```

2. Reset and migrate the local database.

```bash
npm run db:local:reset
npm run db:local:migrate
npm run build
```

3. Start the local services in separate terminals.

Terminal 1:

```bash
npm run api:dev
```

Terminal 2:

```bash
npm run worker:dev
```

Terminal 3:

```bash
npm run web:dev
```

Terminal 4:

```bash
npm run proxy:dev
```

4. Start the public tunnel.

```bash
ngrok http 8080
```

5. Copy the generated public URL into these env vars in `.env`:

- `NIBRAS_API_BASE_URL`
- `NIBRAS_WEB_BASE_URL`
- `NEXT_PUBLIC_NIBRAS_API_BASE_URL`
- `NEXT_PUBLIC_NIBRAS_WEB_BASE_URL`

6. Restart the API, web app, and proxy after editing `.env`.

### Configure the GitHub App

Set the GitHub App values exactly like this:

- Homepage URL: `<public-url>/`
- Callback URL: `<public-url>/v1/github/oauth/callback`
- Setup URL: `<public-url>/install/complete`
- Webhook URL: `<public-url>/v1/github/webhooks`
- Webhook secret: same value as `GITHUB_WEBHOOK_SECRET`

Authentication settings:

- Device Flow enabled
- Request user authorization (OAuth) during installation disabled

Repository permissions:

- Contents: Read and write
- Metadata: Read-only

Subscribed events:

- Push

### Verify GitHub config before browser login

Run:

```bash
curl https://<public-url>/v1/github/config
```

Expected result:

- the response includes `"configured": true`

### Validate browser OAuth and install flow

1. Open `https://<public-url>/`
2. Click `Sign in with GitHub`
3. Complete the GitHub OAuth flow
4. Confirm redirect to `/auth/complete`
5. Confirm redirect to `/dashboard`
6. From the dashboard click `Install GitHub App`
7. Install the app on the target account
8. Confirm GitHub redirects back to `/install/complete`
9. Confirm the page auto-links the installation and redirects back to `/dashboard`
10. If the automatic link fails, use the manual installation ID form as a fallback

Expected result:

- the browser session is established
- the dashboard loads successfully
- the API accepts the installation callback state and installation ID
- the dashboard eventually shows that the app is installed

## CLI Learner Flow

Use the live backend from the previous section.

```bash
nibras login
nibras whoami
nibras ping
mkdir -p /tmp/nibras-e2e
cd /tmp/nibras-e2e
nibras setup --project cs161/exam1 --dir .
nibras task
nibras test
```

Expected result:

- `nibras login` completes the device flow
- `nibras whoami` shows the authenticated user
- `nibras ping` reports:
  - API reachable
  - Auth valid
  - GitHub linked
  - GitHub App installed
- `nibras setup` writes:
  - `.nibras/project.json`
  - `.nibras/task.md`
- `nibras task` prints the task text
- `nibras test` runs the project-local test command

## Submission And Verification Flow

Use the same provisioned directory from the CLI flow.

```bash
mkdir -p answers
printf 'test answer\n' > answers/q1.txt
git status --short
nibras test
nibras submit
```

Expected result:

- the local test command runs
- a commit is created
- the branch push succeeds
- GitHub delivers the push webhook
- the API and worker move the submission through verification
- the final status becomes one of:
  - `passed`
  - `failed`
  - `needs_review`

Important:

- `npm run worker:dev` must be running before `nibras submit`, otherwise the submission may remain `queued`

## Failure And Recovery Checks

Run these as explicit troubleshooting gates.

### Stale DB state

Symptom:

- Prisma warns about drift or data loss
- `db:push` or startup steps fail unexpectedly

Recovery:

```bash
npm run db:local:reset
npm run db:local:migrate
```

### Stale ngrok URL

Symptom:

- OAuth callback fails
- browser login redirects to the wrong origin
- GitHub App setup cannot complete
- webhook deliveries fail from GitHub

Recovery:

- update the current ngrok URL in `.env`
- update the same URL in the GitHub App settings
- restart the API, web app, and proxy
- sign in again

### Missing GitHub env vars

Remove one of:

- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`

Expected result:

- GitHub-specific endpoints fail clearly
- non-GitHub local development can still run in fallback mode

### Wrong webhook secret

Set a bad `GITHUB_WEBHOOK_SECRET`.

Expected result:

- webhook requests are rejected with `401`

### Wrong repo or repo mismatch

Run `nibras submit` from an unrelated git repo.

Expected result:

- submit fails or `nibras ping` shows the repo mismatch

### Forbidden changed files during submit

Modify a file outside `submission.allowedPaths`.

Expected result:

- `nibras submit` refuses to proceed

## Final Acceptance Checklist

- [ ] `npm run manual:preflight` passes
- [ ] `npm run db:local:reset` succeeds
- [ ] `npm run db:local:migrate` succeeds
- [ ] `npm run build` succeeds on fresh local state
- [ ] API starts and `/healthz` returns `{"ok":true}`
- [ ] API `/readyz` returns `{"ok":true}`
- [ ] worker starts and `/healthz` returns `{"ok":true}`
- [ ] web app starts and serves the home page on `http://127.0.0.1:3000/`
- [ ] `https://<public-url>/v1/github/config` reports `"configured": true`
- [ ] browser GitHub OAuth succeeds
- [ ] GitHub App installation succeeds
- [ ] `nibras login` succeeds
- [ ] `nibras setup --project cs161/exam1 --dir .` writes `.nibras/project.json`
- [ ] `nibras setup --project cs161/exam1 --dir .` writes `.nibras/task.md`
- [ ] `nibras ping` reports valid auth, linked GitHub, and installed GitHub App
- [ ] `nibras submit` pushes successfully
- [ ] the submission leaves `queued`
- [ ] the submission reaches a terminal state
- [ ] webhook signature validation succeeds
