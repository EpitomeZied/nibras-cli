# nibras CLI

CLI for college subjects and projects with percentage grading. Supports `check`
grading (earned points / total points) and optional `check50`-backed projects.

## Install

```bash
npm install
```

## Configuration

Create `.nibras.json` in your project root:

```json
{
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

Create `Stanford Data/cs161/Exams/1/scores.json`:

```json
{
  "earnedPoints": 60,
  "totalPoints": 100
}
```

## Usage

```bash
nibras cs161 test exam1
nibras cs161 test exam1 --earned 60 --total 100
nibras cs161 submit exam1
nibras cs161 task exam1
nibras ping
```

## Grading

`check` grading uses `earnedPoints / totalPoints * 100`. You can set
`totalPoints` in `.nibras.json` or in `scores.json`. Validation rules:
- `earnedPoints` must be >= 0
- `totalPoints` must be > 0
- `earnedPoints` must be <= `totalPoints`
