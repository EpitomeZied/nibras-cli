# nibras CLI

`nibras` is a course operations CLI for distributing project materials, loading
task text, grading `check` projects, optionally running `check50`, and pushing
submissions to a Git remote. It is designed for instructors and course
operators first, with student-facing commands built on top of the same config.

This repo now also includes a hosted-style v1 vertical slice:
- project-local commands with `nibras test`, `nibras submit`, and `nibras task`
- a device-login flow with `nibras login`, `logout`, and `whoami`
- a Fastify API app under `apps/api/`
- shared contracts and core helpers under `packages/`
- compatibility routing back to the legacy `nibras <subject> <command> <project>` flow
- a tracked student projects dashboard at `/projects` backed by `/v1/tracking/*`

Current repo layout:
- `apps/` and `packages/` are the active product surface
- `xx/` is a legacy prototype/reference and is not part of the active implementation

Supported workflows:
- Strict private auto-grading with `grading.json`
- Semantic grading with review output for written answers
- Manual score fallback for `check` projects when auto-grading is not active
- Optional `check50` execution for `check50` projects
- Setup bundle download and extraction
- Task loading from a local file or a remote URL
- Git-based submission to a submission remote

## At a Glance

Use `nibras` when you need one config file to drive the whole course workflow:

- `task`: show instructions from a local file or remote source
- `test`: run exact-match grading, semantic grading, manual scoring, or `check50`
- `submit`: copy project files into a temporary Git repo and push a submission branch
- `setup`: download or copy starter materials and unzip them into place
- `ping`: verify that the submission remote is reachable

Typical workflows:

- Strict exam grading with private `grading.json`
- Mixed courses where some projects require strict grading and others use `scores.json`
- AI-assisted review flows for free-form written answers
- Student submission pipelines that do not expose private grading assets

## Prerequisites

- Node.js `>=18`
- `git` for `submit` and `ping`
- `unzip` for `setup`
- `wget` or `curl` for HTTP(S) setup downloads
- `check50` only if you use `check50` projects
- Network access for remote task loading, remote setup bundles, and Git pushes

## Install

```bash
npm install
npm install -g .
```

Development usage:

```bash
npm start -- cs161 test exam1
```

Verification:

```bash
npm test
```

Hosted-style development flow:

```bash
npm install
npm run db:generate
npm run build
npm run api:dev
nibras login
nibras whoami
nibras ping
nibras test
nibras task
```

Postgres-backed API development:

```bash
cp .env.example .env
docker compose up -d
npm run db:push   # disposable local dev only
npm run api:dev
```

When `DATABASE_URL` is set, the API uses Prisma/Postgres instead of the
file-backed dev store. The Prisma schema lives in `prisma/schema.prisma`.

GitHub App + web dashboard development:

```bash
cp .env.example .env
docker compose up -d
npm run db:push   # disposable local dev only
npm run api:dev
npm run web:dev
```

The browser app now uses an HTTP-only `nibras_web_session` cookie for web auth.
It no longer stores API access or refresh tokens in browser-readable storage.

In this split-origin local mode, the browser app runs on `http://127.0.0.1:3000`
and calls the API on `http://127.0.0.1:4848`, so the API must allow browser
origins through CORS. By default, the API allows the configured web base URL plus
local Next.js dev origins. Override that allowlist with `NIBRAS_WEB_CORS_ORIGINS`
if you need a stricter browser origin set.

ngrok-ready local development:

```bash
cp .env.ngrok.example .env
docker compose up -d
npm run db:push   # disposable local dev only
npm run api:dev
npm run web:dev
npm run proxy:dev
ngrok http 8080
```

Use one HTTPS tunnel:
- proxy tunnel -> local `http://127.0.0.1:8080`

The local proxy fans requests out like this:
- `/v1/*` and `/dev/*` -> local API `http://127.0.0.1:4848`
- everything else -> local web app `http://127.0.0.1:3000`

This same-origin proxy mode is the preferred way to test GitHub callbacks and
webhooks because the browser, API, and public tunnel all share one origin.

GitHub cannot call `127.0.0.1`, so the public tunnel URLs must be used in both
the GitHub App settings and the `.env` file.

Required GitHub App settings:
- Set the GitHub App `Setup URL` to `<public-url>/install/complete`
- Set the callback URL for the OAuth flow to `<public-url>/v1/github/oauth/callback`
- Set the webhook URL to `<public-url>/v1/github/webhooks`
- Set the homepage URL to `<public-url>/`
- Fill `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`,
  `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_NAME`, and `GITHUB_WEBHOOK_SECRET`
- Optionally set `GITHUB_TEMPLATE_OWNER` and `GITHUB_TEMPLATE_REPO` to enable
  repository generation from a template during `setup`

Implemented product pieces:
- Real GitHub device flow and browser OAuth flow through the API
- Cookie-based browser sessions for the web app
- Signed OAuth state handling
- GitHub App installation link generation
- Installation ownership verification before linking an installation to a user
- HMAC verification for GitHub webhooks using `X-Hub-Signature-256`
- A real Next.js web app under `apps/web/`
- Integrated project tracking for courses, milestones, reviews, and activity feeds
- Worker-owned verification status transitions and manual admin overrides

Project tracking docs:
- `docs/project-tracking.md`

For a full manual validation path, see `TEST_SCENARIO.md`.

### GitHub App Checklist

Use this checklist when creating the GitHub App for Nibras.

1. Create the app under your personal account or the owning organization.
   GitHub Docs: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app

2. Fill the core registration fields.
   `GitHub App name`: short, unique, <= 34 chars.
   `Homepage URL`: `<public-url>/`
   `Callback URL`: `<public-url>/v1/github/oauth/callback`
   `Setup URL`: `<public-url>/install/complete`
   `Webhook URL`: `<public-url>/v1/github/webhooks`
   `Webhook secret`: generate a random secret and put it in `GITHUB_WEBHOOK_SECRET`.

3. Enable the auth modes this repo uses.
   Enable `Device Flow`.
   Keep `Request user authorization (OAuth) during installation` disabled.
   Keep expiring user tokens enabled.
   Callback URL docs: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-user-authorization-callback-url

4. Set the minimum permissions.
   Repository permissions:
   `Contents`: Read and write
   `Metadata`: Read-only
   Do not grant broader permissions unless the product actually needs them.

5. Subscribe to the events the backend handles.
   Enable `Push`.
   The webhook endpoint in [apps/api/src/app.ts](/home/zied/nibras-cli/apps/api/src/app.ts) currently validates signatures and handles push deliveries.

6. Choose installation scope.
   For private testing, choose `Only on this account`.
   Move to `Any account` only when you are ready for broader installs.

7. Generate credentials and store them in `.env`.
   Copy the App ID, Client ID, Client Secret, App name, and private key into `.env`.
   Put the private key into `GITHUB_APP_PRIVATE_KEY` with literal newlines or escaped `\n`.

8. If you want automatic repo provisioning from a template, configure:
   `GITHUB_TEMPLATE_OWNER`
   `GITHUB_TEMPLATE_REPO`
   The authenticated GitHub user must be allowed to generate repos from that template.

9. Start the local stack with public URLs.
   For ngrok:
   `cp .env.ngrok.example .env`
   `docker compose up -d`
   `npm run db:push` for disposable local development only
   `npm run api:dev`
   `npm run web:dev`
   `npm run proxy:dev`
   `ngrok http 8080`

10. Update the GitHub App settings whenever your tunnel URLs change.
   If your ngrok URLs rotate, update:
   `Homepage URL`
   `Callback URL`
   `Setup URL`
   `Webhook URL`
   and the matching env vars in `.env`.
   Stale public tunnel URLs in `.env` or browser localStorage will break the
   dashboard until you update them and sign in again.

11. Verify webhook signing.
   GitHub Docs: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
   This repo verifies `X-Hub-Signature-256` using `GITHUB_WEBHOOK_SECRET`.

12. Validate the full product flow.
   Open the web app.
   Sign in with GitHub.
   Install the GitHub App.
   Complete linking on `/install/complete`.
   Run `nibras login`, `nibras whoami`, `nibras ping`, `nibras setup --project cs161/exam1`, and `nibras submit`.

### Local Webhook Tips

GitHub’s webhook docs use `smee.io` as a local forwarding option:
https://docs.github.com/en/webhooks/using-webhooks/handling-webhook-deliveries

This repo is now ngrok-ready, so you can use either approach:
- `ngrok` if you want one direct public HTTPS URL that the local proxy fans out to the API and web app
- `smee` if you only need webhook forwarding and want GitHub’s documented local workflow

## Quick Start

Review the repo config, then run the core CS161 flow:

```bash
sed -n '1,220p' .nibras.json
nibras cs161 task exam1
NIBRAS_GRADING_ROOT=/private/grading \
nibras cs161 test exam1 --answers-dir sample-answers/cs161/exam1
nibras cs161 submit exam1
```

Replace `/private/grading` with the grading root that contains
`<grading-root>/cs161/exam1/grading.json`.

`exam1` currently has no configured `setupUrl` in this repo. The strict grading
path is validated with `sample-answers/cs161/exam1/` plus a private grading
root.

## Configuration

`nibras` reads `.nibras.json` from the current working directory.

Precedence:
- File config from `.nibras.json`
- Environment overrides for supported top-level keys
- Command flags for the active command

Supported environment overrides:
- `NIBRAS_SLUG`
- `NIBRAS_SUBMIT_REMOTE`
- `NIBRAS_TASK_URL_BASE`
- `NIBRAS_GRADING_ROOT`
- `NIBRAS_AI_PROVIDER`
- `NIBRAS_AI_MODEL`
- `NIBRAS_AI_API_KEY`
- `NIBRAS_AI_BASE_URL`
- `NIBRAS_AI_TIMEOUT_MS`
- `NIBRAS_AI_MAX_RETRIES`
- `NIBRAS_AI_MIN_CONFIDENCE`

### Top-level keys

| Key | Type | Purpose |
| --- | --- | --- |
| `slug` | string | Default slug for task or `check50` resolution. |
| `submitRemote` | string | Default Git remote for `submit` and `ping`. |
| `taskUrlBase` | string | Base URL used by `task` when no local file or direct task URL is configured. |
| `localChecks` | boolean | Default local execution preference for `check50` projects. |
| `requireGrading` | boolean | When true, missing `grading.json` is an error and manual fallback is blocked for `check` projects. Narrower project or subject values override broader ones, including explicit `false`. |
| `gradingRoot` | string | Root directory used to look up private grading files for auto-checking. It does not by itself make missing grading files fatal. |
| `ai` | object | Default semantic-grading provider settings such as model, API key, timeout, retries, and confidence threshold. |
| `buildpack.node` | string | Node version recorded by `nibras update-buildpack`. |
| `subjects` | object | Per-subject configuration and project catalog. |

### Subject-level keys

| Key | Type | Purpose |
| --- | --- | --- |
| `taskFile` | string | Default local task file for projects in the subject. |
| `taskUrl` | string | Direct remote task URL for the subject. |
| `taskUrlBase` | string | Subject-level override for remote task loading. |
| `submitRemote` | string | Subject-level submission remote. |
| `gradingRoot` | string | Subject-level private grading root for auto-check lookup. |
| `requireGrading` | boolean | Subject-level override for strict grading. This value overrides the top-level setting when defined. |
| `projects` | object | Project definitions keyed by project ID. |

### Project-level keys

| Key | Type | Purpose |
| --- | --- | --- |
| `type` | string | Project type. Supported values are `check` and `check50`. |
| `path` | string | Project directory used for answers, scores, and default local files. Relative paths resolve from the current working directory; absolute paths are supported. |
| `totalPoints` | number | Manual grading fallback total when `scores.json` does not define one. |
| `scoresFile` | string | Manual grading file name, default `scores.json`. |
| `setupUrl` | string | Local path, `file://` URL, or HTTP(S) URL for `setup`. |
| `setupZipName` | string | Zip file name used during setup. |
| `setupDir` | string | Destination directory for extraction. |
| `answersDir` | string | Default answer directory for auto-checking. |
| `gradingFile` | string | Grading file name, default `grading.json`. |
| `gradingRoot` | string | Project-level private grading root for auto-check lookup. |
| `submitRemote` | string | Project-level submission remote override. |
| `submitRef` | string | Submission ref override. Branch becomes `submit/<submitRef>`. |
| `files` | string or array | Explicit submit file list. |
| `slug` | string | Project slug for task or `check50` resolution. |
| `check50Slug` | string | Alternate slug field for `check50` projects. |
| `localChecks` | boolean | Project-level local `check50` preference. |
| `requireGrading` | boolean | Project-level strict grading override. This value overrides subject and top-level settings when defined. |
| `taskFile` | string | Project-level local task file. |
| `taskUrl` | string | Project-level direct task URL. |
| `taskUrlBase` | string | Project-level base URL for remote task loading. |

### Example `.nibras.json`

This example mirrors the current repo layout and project catalog.

```json
{
  "requireGrading": true,
  "subjects": {
    "cs161": {
      "taskFile": "CS161.md",
      "projects": {
        "exam1": {
          "type": "check",
          "path": "Stanford Data/cs161/Exams/1",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "exam2": {
          "type": "check",
          "path": "Stanford Data/cs161/Exams/2",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "exam-final": {
          "type": "check",
          "path": "Stanford Data/cs161/Exams/final",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "section1": {
          "type": "check",
          "path": "Stanford Data/cs161/sections/1",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "section2": {
          "type": "check",
          "path": "Stanford Data/cs161/sections/2",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "section3": {
          "type": "check",
          "path": "Stanford Data/cs161/sections/3",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "section4": {
          "type": "check",
          "path": "Stanford Data/cs161/sections/4",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "section5": {
          "type": "check",
          "path": "Stanford Data/cs161/sections/5",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "section6": {
          "type": "check",
          "path": "Stanford Data/cs161/sections/6",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "section7": {
          "type": "check",
          "path": "Stanford Data/cs161/sections/7",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "section8": {
          "type": "check",
          "path": "Stanford Data/cs161/sections/8",
          "totalPoints": 100,
          "scoresFile": "scores.json"
        }
      }
    }
  }
}
```

### AI configuration

Semantic grading uses top-level `ai` settings plus command-line overrides.

Supported keys:

| Key | Type | Purpose |
| --- | --- | --- |
| `provider` | string | AI provider name. Current supported value is `openai`. |
| `model` | string | Model name used for semantic grading. |
| `apiKey` | string | Provider API key. Can also come from `NIBRAS_AI_API_KEY`. |
| `baseUrl` | string | Base URL for an OpenAI-compatible API. |
| `timeoutMs` | number | Request timeout in milliseconds. |
| `maxRetries` | number | Retry count for retryable provider failures. |
| `minConfidence` | number | Default review threshold between `0` and `1`. |

Example:

```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "baseUrl": "https://api.openai.com/v1",
    "timeoutMs": 30000,
    "maxRetries": 2,
    "minConfidence": 0.8
  }
}
```

## Command Reference

### `nibras <subject> test <project>`

Runs grading for a project.

For `check` projects:
- Uses strict auto-grading when `grading.json` is available or required
- Falls back to manual scoring only when auto-grading is not active

For `check50` projects:
- Runs `check50` and summarizes pass, fail, and skip counts

Flags:
- `--previous`: Include previous stages for `check50`
- `--min-score <number>`: Minimum passing percentage, default `100`
- `--slug <slug>`: Override slug
- `--local`: Request local `check50` execution
- `--earned <number>`: Manual earned points override
- `--total <number>`: Manual total points override
- `--scores <path>`: Manual score file override
- `--grading <path>`: Grading file name or absolute path
- `--grading-root <path>`: Private grading root
- `--answers-dir <path>`: Answer directory for auto-checking
- `--ai-model <model>`: Override the configured semantic-grading model
- `--review-file <path>`: Write review JSON for semantic grading
- `--fail-on-review`: Exit non-zero if any semantic answer requires review
- `--no-ai`: Disable semantic grading and fail if the grading schema requires it

Examples:

```bash
nibras cs161 test exam1
nibras cs161 test exam1 --grading-root /private/grading --answers-dir sample-answers/cs161/exam1
nibras cs161 test exam1 --answers-dir /path/to/my/answers --grading-root /private/grading
nibras cs161 test exam1 --earned 92 --total 100
```

### `nibras <subject> submit <project>`

Copies submit files into a temporary Git repository, commits them, and pushes to
`submit/<submissionRef>`.

Flags:
- `--remote <url>`: Submission remote override
- `--files <files...>`: Explicit submit file list
- `--ref <ref>`: Submission ref override

Examples:

```bash
nibras cs161 submit exam1
nibras cs161 submit exam1 --remote /srv/submissions/cs161.git
nibras cs161 submit exam1 --files q1.txt q2.txt q3.txt
nibras cs161 submit exam1 --ref cs161/exam1-student42
```

### `nibras <subject> task <project>`

Prints task text.

Resolution order:
- `--file`
- `projectConfig.taskFile`
- `subjectConfig.taskFile`
- `projectConfig.taskUrl`
- `subjectConfig.taskUrl`
- `projectConfig.taskUrlBase + slug`
- `subjectConfig.taskUrlBase + slug`
- `taskUrlBase + slug`

Flags:
- `--file <path>`: Read task text from a specific local file

Examples:

```bash
nibras cs161 task exam1
nibras cs161 task exam1 --file CS161.md
```

### `nibras <subject> setup <project>`

Downloads or copies a zip archive, verifies that it is a zip, extracts it into
`setupDir`, and removes the temporary zip after extraction unless the zip file
already lives at the destination path.

Flags:
- `--url <url>`: Override `setupUrl`
- `--dir <path>`: Override destination directory

Examples:

```bash
nibras cs161 setup some-project
nibras cs161 setup exam1 --url file:///tmp/exam1.zip
nibras cs161 setup exam1 --dir /tmp/cs161-exam1
```

### `nibras ping`

Checks that the submission remote is reachable with `git ls-remote`.

Flags:
- `--remote <url>`: Remote override

Examples:

```bash
nibras ping
nibras ping --remote /srv/submissions/cs161.git
```

### `nibras update-buildpack`

Updates `buildpack.node` in `.nibras.json`.

Flags:
- `--node <version>`: Node version to record, default `18`

Examples:

```bash
nibras update-buildpack
nibras update-buildpack --node 20
```

### `nibras --help`

Prints the built-in usage text and command list.

### `nibras --version`

Prints the CLI version from `package.json`.

## Grading Modes

### Strict auto-check mode for `check` projects

Auto-checking uses `grading.json`.

Grading file resolution:
- `--grading`
- `projectConfig.gradingFile`
- default file name `grading.json`
- if a grading root is set, the effective path becomes `<grading-root>/<subject>/<project>/<gradingFile>`

Grading root resolution:
- `--grading-root`
- `projectConfig.gradingRoot`
- `subjectConfig.gradingRoot`
- `gradingRoot`
- `NIBRAS_GRADING_ROOT`

Strict grading resolution:
- explicit `--grading`
- `projectConfig.requireGrading` when defined
- `subjectConfig.requireGrading` when defined
- `requireGrading`
- default `false`

Answer file resolution:
- `--answers-dir`
- `projectConfig.answersDir`
- otherwise `projectConfig.path`
- otherwise the project ID directory

Matching rules:
- Whitespace is trimmed and collapsed before comparison
- Matching is case-sensitive
- A question receives either full points or zero

`grading.json` schema:

```json
{
  "totalPoints": 100,
  "questions": [
    {
      "id": "q1",
      "points": 45,
      "answerFile": "q1.txt",
      "solutions": ["Answer A", "Answer B"]
    }
  ]
}
```

Validation rules:
- `totalPoints` must be a positive number
- `questions` must be a non-empty array
- `id` values must be unique
- `points` must be positive
- `answerFile` must be present
- `solutions` must contain at least one non-empty string
- sum of question points must equal `totalPoints`

Failure modes:
- `grading.json` is missing when grading is required or `--grading` is passed explicitly
- Duplicate question IDs
- Invalid totals
- Missing answer files
- Empty answer files

### Manual score mode for `check` projects

Manual scoring is only used when auto-grading is not active.

Manual sources:
- `--earned` and `--total`
- `scores.json`
- `projectConfig.totalPoints`

Supported `scores.json` shapes:

```json
{
  "earnedPoints": 85,
  "totalPoints": 100
}
```

```json
{
  "scores": [
    { "earned": 40, "points": 50 },
    { "earned": 45, "points": 50 }
  ]
}
```

Validation rules:
- Values must be numeric
- Earned values must be non-negative
- Total values must be positive
- Earned cannot exceed total

If `requireGrading` resolves to `true` at the nearest defined scope, missing
`grading.json` is treated as an error and this fallback is effectively disabled.
If a grading root is configured but no grading file is found, manual scoring can
still run as long as strict grading is not required.

Mixed-course example:

```json
{
  "gradingRoot": "/private/grading",
  "subjects": {
    "cs161": {
      "projects": {
        "exam1": {
          "type": "check",
          "path": "student/exam1",
          "requireGrading": true
        },
        "section1": {
          "type": "check",
          "path": "student/section1",
          "requireGrading": false,
          "scoresFile": "scores.json"
        }
      }
    }
  }
}
```

### Semantic grading mode for `check` projects

Semantic grading is enabled per question by setting `mode: "semantic"` in
`grading.json`.

Question requirements:

- `prompt`: the actual question prompt
- `rubric`: non-empty array of rubric items
- rubric item `id`, `description`, and `points`
- rubric-point total must equal question `points`

Optional fields:

- `examples`: labeled answer examples for the grader
- `minConfidence`: per-question override for review threshold

Example semantic question:

```json
{
  "id": "q2",
  "mode": "semantic",
  "points": 30,
  "answerFile": "q2.txt",
  "prompt": "Explain why Dijkstra's algorithm fails with negative edges.",
  "rubric": [
    {
      "id": "reasoning",
      "description": "Explains the finalized-distance issue.",
      "points": 15
    },
    {
      "id": "example",
      "description": "Provides a correct example or equivalent reasoning.",
      "points": 15
    }
  ],
  "minConfidence": 0.8
}
```

Runtime behavior:

- the CLI sends the prompt, rubric, and answer text to an OpenAI-compatible API
- the model must return strict JSON
- the CLI validates rubric totals, criterion IDs, score totals, and evidence quotes
- answers are marked for review when the model sets `needsReview: true` or
  confidence is below the configured threshold

Required runtime config:

- `ai.provider`, currently `openai`
- `ai.model` or `--ai-model`
- `NIBRAS_AI_API_KEY` or `ai.apiKey`

Review workflow:

- `--review-file` writes structured grading output to JSON
- `--fail-on-review` makes review-required results fail CI or release checks
- `--no-ai` disables semantic grading entirely and causes semantic questions to fail fast

Console output format:

- `Auto-check: earned/total (percentage%)`
- semantic question lines in the form `q2: 18/30 AI(confidence 0.61) REVIEW`
- rubric detail lines for each semantic criterion

### `check50` projects

`check50` support is optional and only applies to projects configured as
`type: "check50"` or projects that define `check50Slug`.

Behavior:
- Slug resolution uses `--slug`, then `projectConfig.slug`, `projectConfig.check50Slug`, then `slug`
- `--previous` sets `NIBRAS_PREVIOUS=1`
- `--local` requests local execution
- Output summarizes pass, fail, and skip counts
- Score is computed from graded checks only: `pass / (pass + fail)`
- `--min-score` controls the required percentage

Requirements:
- `check50` must be installed and available in `PATH`
- `check50` must return JSON output

## Setup, Task, Submit, and Ping Details

## Resolution Rules

### Config and flags

Config loading happens in two stages:

- `.nibras.json`
- supported top-level environment overrides
- built-in defaults for missing keys

Then each command resolves its own flags and scoped config. Common command-level
resolution patterns are:

- command flags
- project config
- subject config
- top-level config
- hardcoded defaults

Notable exceptions:

- `requireGrading` uses nearest-defined config scope, with explicit `false` preserved
- `--grading` always forces strict grading for that invocation
- relative project paths resolve from the current working directory, while absolute paths are used as-is

### Setup behavior

`setup` accepts:
- Local filesystem paths
- `file://` URLs
- HTTP(S) URLs

Behavior:
- Copies or downloads the archive to `setupDir`
- Validates the archive header before extraction
- Extracts with `unzip -o`
- Deletes the temporary zip after extraction unless the archive already lives at
  the final zip path

### Task behavior

`task` resolves task text in this order:
- `--file`
- Project `taskFile`
- Subject `taskFile`
- Project `taskUrl`
- Subject `taskUrl`
- Project `taskUrlBase + slug`
- Subject `taskUrlBase + slug`
- Top-level `taskUrlBase + slug`

If no local file or direct URL is configured, both `taskUrlBase` and a slug are
required.

### Submit behavior

Submission remote resolution:
- `--remote`
- `projectConfig.submitRemote`
- `subjectConfig.submitRemote`
- `submitRemote`
- `NIBRAS_SUBMIT_REMOTE`

Submission ref resolution:
- `--ref`
- `projectConfig.submitRef`
- `projectConfig.slug`
- default `<subject>/<project>`

Branch format:
- `submit/<submissionRef>`

File selection order:
- `--files`
- `projectConfig.files`
- `.cs50.yaml` `files:`
- `git ls-files`

Implementation note:
- Files are copied into a temporary repository, committed there, and pushed from
  that temporary repository

### Ping behavior

`ping` runs `git ls-remote` against the configured or overridden submission
remote and prints the result.

## Troubleshooting

Common failure classes:
- Unknown subject or project in `.nibras.json`
- Missing `submitRemote`
- Missing `taskUrlBase` or slug when no local task file or direct task URL is configured
- Missing `setupUrl`
- Downloaded file is not a zip
- Missing `grading.json`
- Missing or invalid `scores.json`
- Missing answer files
- Empty answer files
- No files found to submit
- Missing external tools such as `git`, `wget`, `curl`, `unzip`, or `check50`

## Repo References

- See `SCENARIO.md` for the CS161 operator and student workflow in this repo.
- See `CS161.md` for the course-specific project map and instructions.
