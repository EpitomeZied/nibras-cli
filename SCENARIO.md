# CS161 Release Playbook

This document describes the current CS161 operating model for this repository.
It is written for course staff who need to release work, validate grading, and
support student submissions.

## Roles

- Course operator: maintains `.nibras.json`, release content, and the submission
  remote
- Instructor or grader: authors private grading rules and reviews edge cases
- Student: reads the task, writes answers, optionally tests locally, and
  submits

## Repo Assets

Key assets already present in this repo:

- `.nibras.json`: CS161 project catalog and grading defaults
- `CS161.md`: course task and project reference
- `Stanford Data/cs161/Exams/...`: exam folders
- `Stanford Data/cs161/sections/...`: section folders
- `sample-answers/cs161/exam1/q1.txt`
- `sample-answers/cs161/exam1/q2.txt`
- `sample-answers/cs161/exam1/q3.txt`

Configured CS161 project IDs:

- `exam1`
- `exam2`
- `exam-final`
- `section1`
- `section2`
- `section3`
- `section4`
- `section5`
- `section6`
- `section7`
- `section8`

## Core Grading Model

CS161 currently uses `check` projects only.

Important grading rules:

- `gradingRoot` only tells `nibras` where to look for private `grading.json`
  files
- A missing `grading.json` is only fatal when strict grading is enabled or
  `--grading` is passed explicitly
- `requireGrading` is resolved from project, then subject, then top-level config
- A narrower `requireGrading: false` can disable a broader `true`
- If strict grading is off and no grading file is found, `nibras` falls back to
  manual scoring from `scores.json` or `--earned/--total`

This makes mixed courses possible: one project can use strict private grading
while another uses manual scores under the same top-level `gradingRoot`.

## Staff Setup

### 1. Keep project directories in place

Expected content layout:

```text
Stanford Data/cs161/Exams/1
Stanford Data/cs161/Exams/2
Stanford Data/cs161/Exams/final
Stanford Data/cs161/sections/1
...
Stanford Data/cs161/sections/8
```

### 2. Define `.nibras.json`

Current repo pattern:

- subject task file is `CS161.md`
- projects use `type: "check"`
- each project defines `path`
- most projects define `totalPoints: 100`
- manual fallback reads `scores.json`

Example mixed configuration:

```json
{
  "gradingRoot": "/private/grading",
  "subjects": {
    "cs161": {
      "taskFile": "CS161.md",
      "projects": {
        "exam1": {
          "type": "check",
          "path": "Stanford Data/cs161/Exams/1",
          "requireGrading": true,
          "totalPoints": 100,
          "scoresFile": "scores.json"
        },
        "section1": {
          "type": "check",
          "path": "Stanford Data/cs161/sections/1",
          "requireGrading": false,
          "totalPoints": 100,
          "scoresFile": "scores.json"
        }
      }
    }
  }
}
```

In that example:

- `exam1` must find `grading.json`
- `section1` may use private grading if present
- `section1` falls back to manual scoring if no grading file exists

### 3. Store private grading outside the repo

Expected layout:

```text
<grading-root>/cs161/exam1/grading.json
<grading-root>/cs161/section1/grading.json
```

Exact-match grading example:

```json
{
  "totalPoints": 100,
  "questions": [
    {
      "id": "q1",
      "points": 45,
      "answerFile": "q1.txt",
      "solutions": ["Expected answer A", "Expected answer B"]
    },
    {
      "id": "q2",
      "points": 35,
      "answerFile": "q2.txt",
      "solutions": ["Expected answer C"]
    },
    {
      "id": "q3",
      "points": 20,
      "answerFile": "q3.txt",
      "solutions": ["Expected answer D"]
    }
  ]
}
```

The CLI enforces:

- one answer file per question
- trimmed and collapsed whitespace matching
- case-sensitive exact comparison
- full credit or zero per exact-match question

### 4. Prepare the submission remote

One local example:

```bash
git init --bare /srv/submissions/cs161.git
```

Then configure `submitRemote` at the top level, subject level, or project level.

Validate reachability:

```bash
nibras ping --remote /srv/submissions/cs161.git
```

### 5. Validate before release

Recommended pre-release checks:

```bash
nibras cs161 task exam1
NIBRAS_GRADING_ROOT=/private/grading \
nibras cs161 test exam1 --answers-dir sample-answers/cs161/exam1
nibras ping --remote /srv/submissions/cs161.git
```

This confirms:

- task resolution works
- private grading is reachable
- answer file names match the grading schema
- the submission remote is reachable

## Student Flow

### 1. Install and inspect

```bash
npm install
npm install -g .
nibras --version
```

### 2. Read the task

```bash
nibras cs161 task exam1
```

### 3. Write answers

Example answer layout:

```text
my-answers/exam1/q1.txt
my-answers/exam1/q2.txt
my-answers/exam1/q3.txt
```

### 4. Optionally test locally

If private grading is available:

```bash
NIBRAS_GRADING_ROOT=/private/grading \
nibras cs161 test exam1 --answers-dir my-answers/exam1
```

Notes:

- students do not need private grading in order to submit
- a configured grading root does not by itself force strict grading
- strict grading only blocks manual fallback when `requireGrading` resolves to
  `true`

### 5. Submit

```bash
nibras cs161 submit exam1
```

The CLI creates a temporary commit and pushes `submit/<submissionRef>`.

## Instructor Demo and Triage Flow

Use the bundled sample answers to validate `exam1` quickly:

```bash
NIBRAS_GRADING_ROOT=/private/grading \
nibras cs161 test exam1 --answers-dir sample-answers/cs161/exam1
```

Expected output shape:

- `Auto-check: earned/total (percentage%)`
- one line per question with `PASS` or `FAIL`

Use manual fallback for projects that are intentionally not strict:

```bash
nibras cs161 test section1
```

That path reads `scores.json` or explicit manual-score flags when no grading
file is active.

## Failure Modes

### Missing grading rules

If strict grading is enabled and `grading.json` cannot be found, `test` fails
immediately.

If strict grading is disabled, `test` can still succeed through manual scoring
even when `gradingRoot` is configured.

### Missing or empty answer files

If any configured `answerFile` is missing or empty, auto-checking fails.

### Missing submission remote

If `submitRemote` is not configured and no `--remote` flag is provided,
`submit` and `ping` fail.

### Missing task source

If no local task file or task URL can be resolved, `task` fails.

### No files to submit

If `submit` cannot resolve files from flags, config, `.cs50.yaml`, or tracked
Git files, submission fails.

## Notes

- `SCENARIO.md` is the CS161-specific playbook
- `README.md` is the generic command and config reference
- `CS161.md` is the course task and project map
