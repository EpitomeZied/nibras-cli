# CS161 Operational Scenario

This document describes the concrete CS161 workflow for this repository.

Roles:
- Course operator or instructor: prepares content, private grading rules, and
  submission infrastructure
- Student: downloads materials, reads the task, writes answers, optionally
  checks locally, and submits

Assumptions:
- `.nibras.json` already contains the CS161 project catalog
- Private grading files live outside the student-facing repo
- A submission remote exists or will be created before release
- `exam1` strict grading is validated with sample answers and a private grading
  root

## Repo Assets and Paths

This repo already contains the main CS161 assets:

- `.nibras.json`: project catalog and current course configuration
- `CS161.md`: CS161 project IDs and task overview
- `Stanford Data/cs161/Exams/...`: exam directories
- `Stanford Data/cs161/sections/...`: section directories
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

## Instructor Setup Workflow

### 1. Prepare course content

Keep one folder per project under the CS161 tree:

```text
Stanford Data/cs161/Exams/1
Stanford Data/cs161/Exams/2
Stanford Data/cs161/Exams/final
Stanford Data/cs161/sections/1
...
Stanford Data/cs161/sections/8
```

### 2. Define `.nibras.json`

Map each project ID to its directory and grading defaults.

Current repo pattern:
- `taskFile` is `CS161.md`
- each project uses `type: "check"`
- each project sets `path`
- each project sets `totalPoints: 100`
- each project sets `scoresFile: "scores.json"`

Example from the current repo:

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
        }
      }
    }
  }
}
```

### 3. Prepare private grading rules

Keep grading outside the student repo.

Expected layout:

```text
<grading-root>/cs161/exam1/grading.json
```

Example:

```json
{
  "totalPoints": 100,
  "questions": [
    {
      "id": "q1",
      "points": 40,
      "answerFile": "q1.txt",
      "solutions": ["Expected answer for question 1"]
    },
    {
      "id": "q2",
      "points": 30,
      "answerFile": "q2.txt",
      "solutions": ["Expected answer for question 2"]
    },
    {
      "id": "q3",
      "points": 30,
      "answerFile": "q3.txt",
      "solutions": ["Expected answer for question 3"]
    }
  ]
}
```

Rules enforced by the CLI:
- One answer file per question
- Whitespace is trimmed and collapsed before matching
- Matching is case-sensitive
- A question gets full credit or zero
- For `exam1`, the expected answer-file contract is `q1.txt`, `q2.txt`, and
  `q3.txt`

### 4. Prepare the submission remote

Create a Git remote that will receive submission branches.

One simple local example:

```bash
git init --bare /srv/submissions/cs161.git
```

Then configure `submitRemote`:
- globally at the top level
- at the subject level
- or at the project level

You can verify reachability with:

```bash
nibras ping --remote /srv/submissions/cs161.git
```

### 5. Validate the release flow

Before release, test the entire path:

```bash
nibras cs161 task exam1
NIBRAS_GRADING_ROOT=/private/grading \
nibras cs161 test exam1 --answers-dir sample-answers/cs161/exam1
nibras ping --remote /srv/submissions/cs161.git
```

This confirms:
- task text resolves correctly
- grading rules load
- answer files are found
- the submission remote is reachable

## Student Workflow

Students only need the student-facing repo, the CLI, and a submission remote
configured by the course.

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

Store one file per question:

```text
my-answers/exam1/q1.txt
my-answers/exam1/q2.txt
my-answers/exam1/q3.txt
```

### 4. Optionally test locally

If the student has access to the grading rules:

```bash
NIBRAS_GRADING_ROOT=/private/grading \
nibras cs161 test exam1 --answers-dir my-answers/exam1
```

Important:
- Students do not need the private grading repo in order to submit
- When `requireGrading` is enabled, strict local auto-checking only works if
  grading rules are available

### 5. Submit

```bash
nibras cs161 submit exam1
```

The CLI creates a temporary commit and pushes a branch named
`submit/<submissionRef>`.

## Instructor Grading and Demo Workflow

This repo already includes sample answer files for `exam1`:

```text
sample-answers/cs161/exam1/q1.txt
sample-answers/cs161/exam1/q2.txt
sample-answers/cs161/exam1/q3.txt
```

Use them to validate the grading path:

```bash
NIBRAS_GRADING_ROOT=/private/grading \
nibras cs161 test exam1 --answers-dir sample-answers/cs161/exam1
```

The CLI prints:
- a total line in the form `Auto-check: earned/total (percentage%)`
- one line per question showing PASS or FAIL and earned points

This is the fastest way to verify that:
- your `grading.json` file is reachable
- question IDs and point totals are valid
- answer file names match the grading schema

## Failure Scenarios

### Missing grading rules

If `requireGrading` is enabled and `grading.json` cannot be found, `test`
fails immediately.

### Missing or empty answer files

If any configured `answerFile` is missing or empty, auto-checking fails.

### Missing submission remote

If `submitRemote` is not configured and no `--remote` flag is provided,
`submit` and `ping` fail.

### Missing task source

If no `--file`, `taskFile`, `taskUrl`, or `taskUrlBase + slug` source is
available, `task` fails.

### No files to submit

If `submit` cannot resolve files from `--files`, project config,
`.cs50.yaml`, or `git ls-files`, submission fails.

## Operational Notes

- `SCENARIO.md` is intentionally CS161-specific; use `README.md` for the generic
  command and configuration reference.
- `CS161.md` is the project map for course operators and students.
- The repo currently uses `check` projects only; `check50` remains optional and
  is documented in `README.md`.
