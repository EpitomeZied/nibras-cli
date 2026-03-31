# TEST.md — Manual Testing Guide

End-to-end test scenarios covering the full Praxis platform from student and instructor perspectives.

---

## Prerequisites

1. Running local stack: `docker compose up` (or individual services)
2. A GitHub account for Student A, a second for Instructor A
3. GitHub App installed on at least one repository (Student A's test repo)
4. `.env` populated (see `.env.example`) — especially:
   - `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
   - `PRAXIS_AI_API_KEY` (OpenAI key), `PRAXIS_AI_MODEL=gpt-4o-mini`
   - `RESEND_API_KEY` + `PRAXIS_EMAIL_FROM` (optional — skip email assertions if absent)

---

## Scenario 1 — Instructor: Set up a course and project

### 1.1 Sign in as instructor
1. Go to `http://localhost:3000` → click **Sign in with GitHub**
2. Authorize the GitHub OAuth app
3. You should land on `/instructor`

### 1.2 Create a course
1. Click **New Course**
2. Fill in: Slug `cs101-s26`, Title `CS 101`, Term `Spring 2026`, Course Code `CS101`
3. Submit → course card appears in the list

### 1.3 Create a project
1. Open the course → **New Project**
2. Fill Title `Lab 1 – Hello World`, Status `Published`
3. Add a rubric criterion: `Code quality`, Max Score `10`
4. Add a resource: label `Docs`, URL `https://nodejs.org`
5. Save → project appears under the course

### 1.4 Add a milestone
1. Open the project → **New Milestone**
2. Title `Initial Submission`, Order `1`, Due Date (any future date), Final `true`
3. Save

### 1.5 Generate invite link
1. Course page → **Members** tab → **Invite Student**
2. Copy the invite URL (format: `http://localhost:3000/join/<code>`)

---

## Scenario 2 — Student: Join and submit

### 2.1 Join via invite
1. Open the invite URL in a new browser/incognito as Student A
2. Sign in with GitHub (Student A's account)
3. **Expected**: Preview page shows course name and role = `student`; click Accept → redirected to `/projects`

### 2.2 View project dashboard
1. `/projects` → select the course → the project card should appear
2. Click the project → milestone `Initial Submission` visible with status `Open`

### 2.3 Submit via CLI
```bash
# in Student A's repo directory (must have Praxis GitHub App installed)
npx praxis submit --milestone "Initial Submission"
```
Or via web modal:
1. Click **Submit** next to the milestone
2. Enter repo URL, branch, commit SHA
3. Click **Submit**

**Expected**:
- Toast/confirmation shown
- Milestone status changes to `Submitted` or `Queued`
- GitHub commit status badge on that SHA shows `pending` (yellow dot)

### 2.4 Watch worker process the job
Check worker logs — you should see:
```
[traceId] claimed job …
[traceId] running tests …
[traceId] finalizing job passed/failed/needs_review
```

**Expected outcomes** (depending on test results):
| Test result | Submission status | GitHub badge |
|---|---|---|
| All pass | `passed` | ✅ green `Praxis / tests passed` |
| Some fail | `failed` | ❌ red `Praxis / tests failed` |
| Needs AI review | `needs_review` | 🟡 pending `Praxis / pending review` |

### 2.5 Email notification (if RESEND_API_KEY set)
Student A's email should receive a notification with the submission result.

---

## Scenario 3 — Instructor: Review a submission

### 3.1 Review queue
1. Sign in as Instructor → `/instructor/courses/<courseId>/submissions`
2. Submission from Student A should appear

### 3.2 Open review
1. Click the submission → review form opens
2. Fill: Status `approved`, Score `9`, Feedback `Great work!`
3. Optionally fill rubric criterion scores
4. Click **Submit Review**

**Expected**:
- Submission moves out of review queue
- Student receives email: "Your submission has been reviewed"

### 3.3 View AI grading (if AI ran)
- On the review page, AI-generated criterion scores and reasoning should be pre-populated
- Instructor can override any score before submitting

---

## Scenario 4 — Student: See feedback

1. Student A → `/projects` → open project → milestone `Initial Submission`
2. **Expected feedback panel visible**:
   - Score: `9 / 10`
   - Feedback quote: `Great work!`
   - Criterion breakdown with scores and justifications (if AI ran)
3. If status is `changes_requested`: orange banner `Changes requested` shown above feedback
4. Click **Submission History** toggle → past submissions listed with SHA, branch, date, status

---

## Scenario 5 — Grade export (instructor)

```bash
curl -H "Authorization: Bearer <instructor_jwt>" \
  http://localhost:4848/v1/tracking/courses/<courseId>/grades.csv
```

**Expected CSV format**:
```
Student,GitHub Login,Milestone: Initial Submission
Alice,alice123,passed
```

---

## Scenario 6 — Webhook deduplication

1. In GitHub App settings, replay a delivery (or send the same webhook twice manually)
2. Check DB: `SELECT count(*) FROM "GithubDelivery" WHERE "deliveryId" = '<id>';`
3. **Expected**: count = 1 (second delivery silently dropped, no duplicate job created)

---

## Scenario 7 — Commit status checks (manual verify)

1. Go to Student A's GitHub repo → commit used in Scenario 2
2. Click the status dot next to the commit SHA
3. **Expected**: context name `Praxis / tests` with description matching the result

---

## Known Limitations / Not Yet Tested

- Team projects (deliveryMode = `team`)
- CLI `praxis check` / `praxis grade` commands (separate from submission flow)
- Rate limiting headers (429 responses after burst)
- Token refresh edge case when GitHub App token expires mid-job
