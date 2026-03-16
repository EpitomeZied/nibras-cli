# Nibras CLI Process (Instructor Workflow)

This document describes the end-to-end process for preparing materials,
running setup, and grading with instructor-only rules.

## 1) Prepare Exam Bundle

1. Create the project folder (example for exam1):
   - `Stanford Data/cs161/Exams/1/`
2. Add `scores.json` for manual fallback:
```json
{
  "earnedPoints": 0,
  "totalPoints": 100
}
```
3. Zip the folder:
```
cd "Stanford Data/cs161/Exams"
zip -r /home/zied/nibras-cli/exam1.zip "1"
```

## 2) Upload to GitHub Release

Create or update Release `v1` and upload `exam1.zip`.

Using GitHub CLI:
```
gh release create v1 /home/zied/nibras-cli/exam1.zip \
  -R EpitomeZied/nibras-cli \
  -t "CS161 Exam1" \
  -n "Exam1 setup bundle"
```

## 3) Configure Setup URL

In `.nibras.json`, ensure the project has:
```json
{
  "setupUrl": "https://github.com/EpitomeZied/nibras-cli/releases/download/v1/exam1.zip",
  "setupZipName": "exam1.zip",
  "setupDir": "."
}
```

Now students can run:
```
nibras cs161 setup exam1
```

## 4) Private Grading Rules (Instructor-only)

Store grading rules outside the student repo:
```
/private/grading/cs161/exam1/grading.json
```

Example `grading.json` schema:
```json
{
  "totalPoints": 100,
  "questions": [
    {
      "id": "q1",
      "points": 45,
      "answerFile": "q1.txt",
      "solutions": ["Full expected answer variant 1"]
    }
  ]
}
```

Rules:
- Trim + collapse whitespace.
- Case-sensitive exact match.
- No partial credit.

## 5) Collect Student Answers

Students provide one file per question (e.g., `q1.txt`, `q2.txt`, `q3.txt`).
Keep answers in any directory, for example:
```
/home/zied/answers/cs161/exam1/q1.txt
/home/zied/answers/cs161/exam1/q2.txt
/home/zied/answers/cs161/exam1/q3.txt
```

## 6) Run Grading

```
NIBRAS_GRADING_ROOT=/private/grading \
nibras cs161 test exam1 --answers-dir /home/zied/answers/cs161/exam1
```

Output includes per-question PASS/FAIL and total percentage.

## 7) Validation Behavior

The checker fails if:
- `grading.json` is missing (when grading root is set).
- Question IDs are duplicated.
- Sum of question points does not equal `totalPoints`.
- Any answer file is missing or empty.

