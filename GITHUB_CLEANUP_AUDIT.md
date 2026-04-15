# GitHub & Repository Cleanup Audit

## 📋 Summary

Your repository has accumulated useful and useless files. This audit categorizes everything and provides cleanup recommendations.

---

## ✅ IMPORTANT & KEEP

### GitHub Workflows (.github/workflows/)

| File          | Status        | Notes                                                                                       |
| ------------- | ------------- | ------------------------------------------------------------------------------------------- |
| `ci.yml`      | **CRITICAL**  | Main CI pipeline - runs tests, lint, build, Postgres migrations on push/PR. MUST KEEP       |
| `release.yml` | **IMPORTANT** | Publishes `@nibras/cli` to npm on version tags (v\*). MUST KEEP if you publish npm packages |
| `deploy.yml`  | **IMPORTANT** | Deploys to Fly.io on push to main. Currently only deploys web. MUST KEEP if using Fly.io    |

### Core Configuration Files

| File                | Status   | Notes                                                        |
| ------------------- | -------- | ------------------------------------------------------------ |
| `.env.example`      | **KEEP** | Template for required environment variables. Used onboarding |
| `.env.prod.example` | **KEEP** | Production environment template                              |
| `.gitignore`        | **KEEP** | Prevents committing node_modules, dist, .env, etc.           |
| `.dockerignore`     | **KEEP** | Optimizes Docker builds                                      |
| `CLAUDE.md`         | **KEEP** | Your project instructions - referenced by Claude Code        |

### Documentation

| File        | Status   | Notes                                                 |
| ----------- | -------- | ----------------------------------------------------- |
| `README.md` | **KEEP** | Main project overview                                 |
| `DEPLOY.md` | **KEEP** | Deployment guide (Fly.io setup)                       |
| `TEST.md`   | **KEEP** | Testing documentation                                 |
| `CLAUDE.md` | **KEEP** | Development guidelines                                |
| `CS161.md`  | **KEEP** | Course-specific documentation (legacy but functional) |
| `LICENSE`   | **KEEP** | Required for open source projects                     |

### Monorepo Structure (Core Architecture)

| Item                   | Status       | Notes                                               |
| ---------------------- | ------------ | --------------------------------------------------- |
| `package.json`         | **CRITICAL** | Monorepo root - defines workspaces and scripts      |
| `packages/*`           | **CRITICAL** | Shared libraries (contracts, core, github, grading) |
| `apps/*`               | **CRITICAL** | Service apps (cli, api, web, worker, proxy)         |
| `prisma/schema.prisma` | **CRITICAL** | Database schema                                     |
| `tsconfig.base.json`   | **KEEP**     | TypeScript configuration                            |
| `eslint.config.mjs`    | **KEEP**     | Linting configuration                               |

### Dockerfiles (In Use)

| File                | Status     | Purpose                                                           |
| ------------------- | ---------- | ----------------------------------------------------------------- |
| `Dockerfile.api`    | **KEEP**   | Referenced by `fly.api.toml` - used by Fly.io deployment          |
| `Dockerfile.web`    | **KEEP**   | Referenced by `fly.web.toml` - used by Fly.io deployment          |
| `Dockerfile.worker` | **KEEP**   | Referenced by `fly.worker.toml` - used by Fly.io deployment       |
| `Dockerfile`        | **DELETE** | Multi-stage monolith not used (verified: individual files in use) |

### Fly.io Configuration

| File              | Status     | Notes                                                                          |
| ----------------- | ---------- | ------------------------------------------------------------------------------ |
| `fly.api.toml`    | **KEEP**   | Contains `dockerfile = 'Dockerfile.api'` - actively used                       |
| `fly.web.toml`    | **KEEP**   | Contains `dockerfile = 'Dockerfile.web'` - actively used                       |
| `fly.worker.toml` | **KEEP**   | Contains `dockerfile = 'Dockerfile.worker'` - actively used                    |
| `fly.toml`        | **DELETE** | Only contains comments explaining the setup. Not used by Fly.io CLI (verified) |

---

## 🗑️ USELESS & DELETE

### Empty Directories

```
Frontend-examples/     - Empty directory, no content
xx/                    - Empty directory, appears to be a placeholder/temp
```

**Action**: Delete both. They serve no purpose.

### Outdated Documentation

| File                                   | Reason                                                                    | Action                           |
| -------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| `SCENARIO.md`                          | Course-specific playbook. Duplicates info in CS161.md. Last updated Apr 1 | **DELETE** - Keep only CS161.md  |
| `TEST_SCENARIO.md`                     | Test scenario guide. Outdated (Apr 1). Info in TEST.md is clearer         | **DELETE** - Keep only TEST.md   |
| `productionization-plan-for-praxis.md` | Old strategic planning doc. Plan is already implemented. Not maintained   | **DELETE** - History, not active |

### Example/Template Files

| File                 | Reason                                           | Action                                                  |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `.env.ngrok.example` | Ngrok tunneling setup - legacy local dev pattern | **DELETE** - Modern setup uses proper Fly.io deployment |

### Infrastructure (Likely Unused)

| Item                        | Reason                                                       | Action                                                            |
| --------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `nginx/` directory          | Nginx reverse proxy config. Not used in current Fly.io stack | **DELETE** - Fly.io/Docker handles routing                        |
| `grafana/` directory        | Grafana dashboard JSON. No active monitoring setup           | **DELETE** - Requires Prometheus + Grafana running locally        |
| `docker-compose.prod.yml`   | Production Docker Compose. Not used with Fly.io              | **DELETE** - Fly.io is the production environment                 |
| `sample-answers/` directory | CS161 course sample answers                                  | **MAYBE DELETE** - Keep only if needed for course staff reference |

### Miscellaneous

| File                                   | Reason                 | Action                                                                       |
| -------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| `exam1.zip` (referenced in .gitignore) | Old course materials   | **DELETE** - If it exists, remove it                                         |
| `.idea/` directory                     | JetBrains IDE settings | **DELETE** - IDE-specific, .gitignore should prevent this from being tracked |

---

## ✓ VERIFIED FINDINGS

### Dockerfile Strategy (VERIFIED)

✅ **Confirmed**: You're using individual `Dockerfile.{service}` files

- `fly.api.toml` → `dockerfile = 'Dockerfile.api'`
- `fly.web.toml` → `dockerfile = 'Dockerfile.web'`
- `fly.worker.toml` → `dockerfile = 'Dockerfile.worker'`

**Action**: Delete the unused `Dockerfile` monolith. It creates confusion and isn't deployed.

### fly.toml Status (VERIFIED)

✅ **Confirmed**: `fly.toml` is **comments only**

- Just documents the manual deployment commands
- Not read by `flyctl` (only `fly.{service}.toml` files are)
- Can be safely deleted or converted to docs

**Action**: Delete `fly.toml` — its info can live in `DEPLOY.md`

---

## 🚀 DEFINITIVE Cleanup Checklist

### Phase 1: Safe Deletions (VERIFIED - No Impact ✅)

```bash
# 1. Delete empty directories
rmdir Frontend-examples/
rmdir xx/

# 2. Delete outdated documentation
rm SCENARIO.md                    # Duplicate of CS161.md
rm TEST_SCENARIO.md               # Outdated, info in TEST.md
rm productionization-plan-for-praxis.md  # Old strategic planning, already implemented

# 3. Delete legacy configuration
rm .env.ngrok.example             # Ngrok local dev pattern obsolete

# 4. Delete unused Dockerfile
rm Dockerfile                     # Monolith not used (verified: using Dockerfile.{service})

# 5. Delete unused Fly.io root config
rm fly.toml                       # Comments only (verified: not read by flyctl)
```

### Phase 2: Infrastructure Cleanup (ASSESS USAGE FIRST)

```bash
# Delete if you don't use local monitoring/reverse proxy
rm -rf nginx/                     # Local reverse proxy, not needed with Fly.io
rm -rf grafana/                   # Monitoring dashboard, requires Prometheus setup
rm docker-compose.prod.yml        # Production Docker Compose, not used with Fly.io
```

### Phase 3: Course Materials (OPTIONAL)

```bash
# Only delete if CS161 course is no longer active
# rm -rf sample-answers/
# You can keep CS161.md if course materials are still referenced
```

### Summary of Deletions

- **Phase 1**: 9 files/dirs (~100KB) — **SAFE TO DELETE NOW**
- **Phase 2**: 3 items (~50KB) — **DELETE IF CONFIRMED UNUSED**
- **Total cleanup**: ~150KB recovered (mostly disk clutter, code/config clarity gain)

---

## 📊 Current State Summary

### Disk Usage Estimate

- **Keep** (essential): ~200KB (configs, workflows, docs)
- **Delete** (useless): ~50KB (empty dirs, old docs)
- **Node modules** (not tracked): ~400MB (not relevant for cleanup)

### Files by Category

| Category         | Count               | Status               |
| ---------------- | ------------------- | -------------------- |
| GitHub Workflows | 3                   | ✅ All important     |
| Documentation    | 7 total, 3 outdated | ⚠️ Cleanup needed    |
| Config Files     | 15+                 | ✅ Mostly keep       |
| Dockerfiles      | 4                   | ⚠️ Duplicate/unclear |
| Infrastructure   | 3 dirs              | 🗑️ Likely unused     |

---

## 📝 Summary Table: Keep vs Delete

| Item                                            | Status     | Impact            | Action      |
| ----------------------------------------------- | ---------- | ----------------- | ----------- |
| `.github/workflows/*`                           | KEEP       | Critical          | None        |
| `apps/*, packages/*`                            | KEEP       | Critical          | None        |
| `Dockerfile.{api,web,worker}`                   | KEEP       | Critical          | None        |
| `fly.{api,web,worker}.toml`                     | KEEP       | Critical          | None        |
| `CLAUDE.md`, `DEPLOY.md`, `README.md`           | KEEP       | Important         | None        |
| `Dockerfile` (monolith)                         | **DELETE** | None (unused)     | Run Phase 1 |
| `fly.toml`                                      | **DELETE** | None (comments)   | Run Phase 1 |
| `SCENARIO.md`, `TEST_SCENARIO.md`               | **DELETE** | None (duplicate)  | Run Phase 1 |
| `productionization-plan-for-praxis.md`          | **DELETE** | None (historical) | Run Phase 1 |
| `.env.ngrok.example`                            | **DELETE** | None (obsolete)   | Run Phase 1 |
| `Frontend-examples/`, `xx/`                     | **DELETE** | None (empty)      | Run Phase 1 |
| `nginx/`, `grafana/`, `docker-compose.prod.yml` | **DELETE** | None (if unused)  | Run Phase 2 |

---

## 🎯 Next Steps

Would you like me to:

1. **Execute Phase 1 cleanup** (9 items, all verified safe)?
2. **Review Phase 2** items with you first?
3. **Update DEPLOY.md** to include the deployment commands from deleted fly.toml?
4. **Create a git commit** with the cleanup changes?
