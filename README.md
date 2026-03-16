# nibras CLI

CLI for college subjects and projects with percentage grading. Supports strict
auto-checking (instructor-only rules) plus optional `check50` projects.

## Install

```bash
npm install
npm install -g .
```

## Configuration

Create `.nibras.json` in your project root:

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
          "setupUrl": "https://github.com/EpitomeZied/nibras-cli/releases/download/v1/exam1.zip",
          "setupZipName": "exam1.zip",
          "setupDir": "."
        }
      }
    }
  }
}
```

For auto-checking, keep `grading.json` in a private grading repo and point
`nibras` to it using `--grading-root` or `NIBRAS_GRADING_ROOT`. Students only
need to submit their answer files. When `requireGrading` is true, missing
`grading.json` is an error and manual scoring is disabled.

Expected layout:
`<grading-root>/<subject>/<project>/grading.json`

Example `grading.json` (strict exact match; multiple full-answer variants):

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

## Usage

```bash
nibras cs161 test exam1
nibras cs161 test exam1 --answers-dir /path/to/answers
nibras cs161 test exam1 --grading-root /path/to/private/grading --answers-dir /path/to/answers
nibras cs161 submit exam1
nibras cs161 task exam1
nibras cs161 setup exam1
nibras ping
```

## Grading

`check` grading uses `grading.json` for auto-checking. When `requireGrading` is
true, `grading.json` is required and manual scoring is disabled.

Auto-checking rules:
- Answers are compared to solutions after trimming and collapsing whitespace.
- Case-sensitive exact match.
- No partial credit (full points or zero).

Validation rules:
- `grading.json` must exist when `requireGrading` is true or when `NIBRAS_GRADING_ROOT`
  or `--grading-root` is set.
- Question IDs must be unique.
- Sum of question points must equal `totalPoints`.
- Each `answerFile` must exist and be non-empty.

## Instructor Workflow

See `SCENARIO.md` for the full instructor and student flow, including setup
bundles and sample answers.
