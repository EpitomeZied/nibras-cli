# Project Tracking

The `xx` project-tracking prototype now lives inside the main Nibras monorepo as a first-class API and web feature.

## What moved

- Student project tracking UI now lives at `apps/web/app/projects/`.
- Tracking API routes now live under `/v1/tracking/*`.
- Shared tracking contracts live in `packages/contracts/src/tracking.ts`.
- Tracking data is backed by Prisma/Postgres when `DATABASE_URL` is set, and by the file-backed store for local test flows.

## Main routes

- `GET /v1/tracking/dashboard/student`
- `GET /v1/tracking/courses`
- `GET /v1/tracking/courses/:courseId/projects`
- `POST /v1/tracking/projects`
- `POST /v1/tracking/projects/:projectId/milestones`
- `POST /v1/tracking/milestones/:milestoneId/submissions`
- `POST /v1/tracking/submissions/:submissionId/review`
- `GET /v1/tracking/submissions/:submissionId/commits`

## Roles

- `student`: can view enrolled course data and create their own milestone submissions.
- `instructor` / `ta`: can manage projects and milestones inside their course and review submissions.
- `admin`: bypasses per-course checks.

## Current scope

- The `/projects` page reproduces the student-facing dashboard from `xx`.
- Instructor/admin web screens are still API-first in this pass.
- Submission types supported in the tracking UI are `github`, `link`, and `text`.
- File uploads and team/group modeling are intentionally out of scope for this migration.

## Local development

```bash
npm run db:generate
npm run build
npm run api:dev
npm run web:dev
```

Open `http://127.0.0.1:3000/projects` after signing in through the existing GitHub auth flow.
