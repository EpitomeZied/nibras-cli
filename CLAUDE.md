# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm ci

# Build all packages (in dependency order)
npm run build

# Run tests (builds first, then node --test)
npm run test

# Run a single test file
node --test test/<file>.js

# Full local dev stack (watch + API + web + worker)
npm run dev

# Database
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:push          # Push schema without migration (dev only)
npm run db:migrate       # Create a named migration
npm run db:deploy        # Apply migrations (production path)
npm run db:local:reset   # Tear down and recreate local Docker DB (destructive)
```

No lint is configured (`npm run lint` is a no-op).

## Architecture

Nibras is an npm **monorepo** (`apps/*`, `packages/*`) with a legacy CommonJS CLI (`src/`) for backwards compatibility. `bin/nibras.js` tries `apps/cli/dist/index.js` first; falls back to `src/cli.js` if the modern build is absent.

### Packages (dependency order for builds)
| Package | Role |
|---|---|
| `packages/contracts` | Zod schemas and inferred TypeScript types shared by all layers |
| `packages/core` | CLI utilities: API client (with token refresh), config, manifest, git ops |
| `packages/github` | JWT signing and webhook HMAC validation for GitHub App |
| `packages/grading` | AI semantic grading runner (OpenAI-compatible, optional) |

### Apps
| App | Role |
|---|---|
| `apps/cli` | Published `@nibras/cli` npm package; TypeScript; Commander.js |
| `apps/api` | Fastify REST API (auth, GitHub OAuth/webhooks, submissions, tracking, admin) |
| `apps/web` | Next.js 15 / React 19 instructor dashboard |
| `apps/worker` | Async processor for verification and grading jobs |
| `apps/proxy` | Local HTTP proxy for ngrok: `/v1/*` → API, else → web |

### Key data flows
- **Device login:** CLI → API device-flow → GitHub OAuth → access/refresh tokens stored in `~/.nibras/cli.json`
- **Submission:** CLI stages allowed files, commits, pushes → polls API until verification completes
- **Grading:** Worker picks up jobs, calls `@nibras/grading`, writes results back; AI is disabled if `NIBRAS_AI_API_KEY` is unset
- **Tracking:** `apps/api/src/features/tracking/` manages courses, projects, milestones, student progress

### Configuration files (runtime, not build)
- `~/.nibras/cli.json` — per-user CLI tokens and API base URL
- `.nibras/project.json` — per-project manifest (test mode, submission paths, grading config, Node.js buildpack version)
- `.nibras/task.md` — task instructions shown via `nibras task`

### Database
PostgreSQL via Prisma. Schema lives in `prisma/schema.prisma`. Local dev uses Docker Compose (`docker-compose.yml`). Always run `npm run db:generate` after editing the schema.

### TypeScript setup
All packages extend `tsconfig.base.json` (ES2022 target, strict mode, CommonJS output). Each workspace compiles independently; `npm run build` runs them in dependency order.

### Environment
Copy `.env.example` to `.env`. Required groups: database (`DATABASE_URL`), GitHub App credentials, session secret. AI grading (`NIBRAS_AI_API_KEY`) is optional — its absence disables the feature without errors.

### CI
`.github/workflows/ci.yml` spins up Postgres 16, runs `npm ci`, `db:generate`, `db:deploy`, `build`, tests, and `web:build`. PRs must pass all steps.
