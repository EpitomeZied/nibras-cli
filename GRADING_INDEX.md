# Nibras Grading System — Complete Documentation Index

## 📚 Documentation Overview

This directory contains comprehensive documentation of the Nibras grading system, including architecture, implementation guides, and quick references.

### Documents

| Document                            | Purpose                           | Audience                | Read Time |
| ----------------------------------- | --------------------------------- | ----------------------- | --------- |
| **GRADING_SYSTEM_ANALYSIS.md**      | Complete technical analysis       | Architects, Senior Devs | 40 min    |
| **GRADING_QUICK_REFERENCE.md**      | Code snippets & quick lookup      | Developers              | 15 min    |
| **GRADING_IMPLEMENTATION_GUIDE.md** | Integration & setup guide         | DevOps, Backend Devs    | 30 min    |
| **GRADING_INDEX.md**                | This file — navigation & overview | Everyone                | 5 min     |

---

## 🎯 Start Here

### By Role

**🏗️ Software Architect**

1. Read: `GRADING_SYSTEM_ANALYSIS.md` — Architecture Overview section
2. Review: Database schema section
3. Understand: Integration points with other systems

**👨‍💻 Backend Developer (Adding Grading)**

1. Read: `GRADING_IMPLEMENTATION_GUIDE.md` — Decision Tree
2. Find: Example matching your use case
3. Reference: `GRADING_QUICK_REFERENCE.md` for code snippets

**🔧 DevOps Engineer (Setting Up)**

1. Read: `GRADING_IMPLEMENTATION_GUIDE.md` — Setup Checklist
2. Configure: Environment variables section
3. Monitor: Monitoring & Observability section

**👨‍🏫 Course Instructor (Using Grading)**

1. Read: `GRADING_IMPLEMENTATION_GUIDE.md` — Real-World Examples
2. Configure: Manifest configuration section
3. Monitor: Dashboard integration section

**🐛 Debugging Issues**

1. Check: `GRADING_SYSTEM_ANALYSIS.md` — Error Handling & Edge Cases
2. Look up: `GRADING_IMPLEMENTATION_GUIDE.md` — FAQ section
3. Reference: `GRADING_QUICK_REFERENCE.md` — Troubleshooting

---

## 📖 What You'll Learn

### From GRADING_SYSTEM_ANALYSIS.md

- ✅ Complete architecture overview
- ✅ Three grading methods explained:
  - MCQ (Multiple Choice Questions)
  - Exam (Mixed question types with model answers)
  - File (PDF/text upload grading)
- ✅ AI integration (OpenAI-compatible APIs)
- ✅ Worker job processing flow
- ✅ Database schema details
- ✅ Configuration and manifest structure
- ✅ Core design patterns (batching, confidence scoring, semantic similarity)
- ✅ Performance considerations
- ✅ Security considerations
- ✅ Limitations and future improvements
- ✅ Troubleshooting guide

**Best for:** Understanding the "why" and "how" of the system

---

### From GRADING_QUICK_REFERENCE.md

- ✅ 30-second overview
- ✅ When to use each grading mode
- ✅ API configuration (minimal & full)
- ✅ Environment variables for worker
- ✅ Code examples for all three modes
- ✅ Backward compatible semantic grading API
- ✅ Common patterns (batching, error handling, retries)
- ✅ Testing examples
- ✅ Manifest configuration template
- ✅ Supported AI providers
- ✅ Worker integration points
- ✅ Performance tips
- ✅ Debugging checklist

**Best for:** Copy-paste code snippets and quick lookup

---

### From GRADING_IMPLEMENTATION_GUIDE.md

- ✅ Decision tree for choosing grading method
- ✅ Grading method selection matrix
- ✅ Implementation checklist (step-by-step)
- ✅ Integration with API, CLI, Web, Worker layers
- ✅ Real-world examples:
  - CS101 Database Assignment (rubric-based)
  - Organic Chemistry Quiz (MCQ with context)
  - Code Review Assignment (file upload)
- ✅ Performance optimization techniques
- ✅ Testing strategy (unit, integration, E2E)
- ✅ Monitoring & observability
- ✅ Migration guide from old to new API
- ✅ FAQ with common questions
- ✅ Support & debugging

**Best for:** "How do I implement this?" and "What's the best approach?"

---

## 🗂️ Source Code Map

```
packages/grading/          Main grading engine
├── src/
│   ├── index.ts           Public API exports
│   ├── types.ts           Type definitions (MCQQuestion, ExamQuestion, etc.)
│   ├── runner.ts          Routes to correct validator
│   ├── client.ts          OpenAI-compatible API client
│   ├── compat.ts          Legacy API for backward compatibility
│   └── validators/
│       ├── mcq.ts         MCQ grading logic
│       ├── exam.ts        Exam grading with model answers
│       └── file.ts        File upload grading
└── package.json

apps/worker/               Job processor
├── src/
│   ├── worker.ts         Main job processing (verification + AI grading)
│   ├── queue.ts          BullMQ queue configuration
│   ├── sandbox.ts        Sandboxed test execution
│   └── email.ts          Notification service
└── package.json

apps/api/                  REST API (uses grading indirectly)
├── src/
│   └── features/
│       └── submissions/   Submission endpoints

apps/web/                  Dashboard (displays grading results)
└── src/components/
    └── SubmissionGradeDisplay.tsx

prisma/
└── schema.prisma         Database schema (Review, VerificationJob, etc.)
```

---

## 🔑 Key Concepts

### Three Grading Methods

```typescript
// 1. MCQ — Objective questions without model answer
await grade({
  type: 'mcq',
  config: { apiKey: '...' },
  questions: [{
    id: 'q1',
    question: 'What is a database?',
    options: ['A. ...', 'B. ...'],
    studentAnswer: 'B. ...',
    lectureContext: '...',  // Optional context
  }],
});

// 2. EXAM — Mixed questions with model answers
await grade({
  type: 'exam',
  config: { apiKey: '...', minConfidence: 0.8 },
  questions: [{
    id: 'q1',
    question: 'Explain normalization',
    type: 'long_answer',
    maxScore: 10,
    modelAnswer: 'Normalization is...',
    gradingCriteria: '5 pts for definition, 5 pts for examples',
  }],
  studentAnswers: [{
    questionId: 'q1',
    answer: 'Student response...',
  }],
});

// 3. FILE — Extract answers from document
await grade({
  type: 'file',
  config: { apiKey: '...' },
  input: {
    fileContent: '...',      // Extracted from PDF/text
    fileType: 'pdf',
    modelAnswerQuestions: [...],
  },
});
```

### Confidence Scoring & Human Review Escalation

```
AI Grade → Confidence Score (0–1)
           ↓
           < minConfidence (default 0.8)?
           ├─ YES → Flag for human review
           │        (Status: needs_review)
           │        (Review record created with aiConfidence)
           │
           └─ NO → Auto-approve
                   (Status: passed)
                   (No human review needed)
```

### Worker Job Flow

```
1. Submission created → VerificationJob (queued)
2. Worker claims job  → VerificationJob (running)
3. Tests run          → VerificationRun record created
4. Tests PASS?
   ├─ NO  → Job fails
   └─ YES → AI grading (if enabled)
            ├─ AI grades  → Review record created
            └─ No AI      → Skip grading
5. Finalize          → SubmissionAttempt status updated
                     → Notifications sent
```

---

## 💡 Common Questions

**Q: How do I choose between MCQ, Exam, and File?**
A: See `GRADING_IMPLEMENTATION_GUIDE.md` → Decision Tree section

**Q: Can I use GPT-4 instead of GPT-4o-mini?**
A: Yes, set `model: 'gpt-4o'` in config (better accuracy, higher cost)

**Q: What if the AI API is down?**
A: Worker continues with verification tests only; grading skipped gracefully

**Q: How do I integrate grading into my assignment?**
A: See `GRADING_IMPLEMENTATION_GUIDE.md` → Real-World Examples

**Q: How accurate is the AI grading?**
A: Depends on assignment clarity. Well-defined rubrics = 90%+ accuracy

**Q: Can I disable AI grading?**
A: Yes, unset `NIBRAS_AI_API_KEY` — only verification tests run

---

## 📊 System Components

### Grading Package (@nibras/grading)

- **Purpose**: Pure grading logic (no DB, no side effects)
- **Used by**: Worker, API, CLI
- **Models**: MCQ, Exam, File
- **Dependencies**: OpenAI-compatible API client

### Worker (apps/worker)

- **Purpose**: Async job processor
- **Triggers**: Verification jobs from API
- **Process**:
  1. Run tests (verification)
  2. Run AI grading (if tests pass)
  3. Create Review records
  4. Send notifications
- **Deployment**: Docker container, scales horizontally with Redis

### API (apps/api)

- **Endpoints**: Submit assignment, fetch results
- **Triggers**: Creates VerificationJob
- **Queries**: Fetches grading results
- **Integration**: Uses @nibras/grading indirectly via worker

### Web (apps/web)

- **Display**: Shows grades and feedback to students
- **Fields**: score, confidence, reasoning, evidence quotes
- **Flags**: needsHumanReview indicator

---

## 🚀 Quick Start

### 1. Add Grading to Your Assignment

```typescript
import { grade } from '@nibras/grading';

const result = await grade({
  type: 'exam',
  config: { apiKey: process.env.OPENAI_API_KEY },
  questions: examQuestions,
  studentAnswers: studentAnswers,
});

console.log(`Score: ${result.totalScore}/${result.maxScore}`);
console.log(`Needs review: ${result.needsHumanReview}`);
```

### 2. Configure Manifest

```json
{
  "grading": {
    "questions": [
      {
        "id": "q1",
        "mode": "semantic",
        "prompt": "Your question",
        "points": 10,
        "answerFile": "answers/q1.txt",
        "rubric": [{ "id": "criterion1", "description": "...", "points": 5 }]
      }
    ]
  }
}
```

### 3. Set Environment Variables

```bash
NIBRAS_AI_API_KEY="sk-..."
NIBRAS_AI_MODEL="gpt-4o-mini"
NIBRAS_AI_MIN_CONFIDENCE="0.8"
```

### 4. Deploy Worker

```bash
npm run build
docker build -t nibras-worker .
docker run -e NIBRAS_AI_API_KEY=... nibras-worker
```

---

## 🔗 Related Documentation

- **Database Schema**: `prisma/schema.prisma` (Review, VerificationJob, VerificationRun models)
- **Environment Variables**: `.env.example`
- **Architecture Decisions**: `CLAUDE.md` (project instructions)
- **CLI Commands**: `apps/cli/README.md`

---

## 📈 System Statistics

| Metric                   | Value                                        |
| ------------------------ | -------------------------------------------- |
| **Grading Modes**        | 3 (MCQ, Exam, File)                          |
| **Batch Size**           | 5–10 questions per API call                  |
| **Default Model**        | gpt-4o-mini                                  |
| **Confidence Threshold** | 0.8 (0–1 scale)                              |
| **Max Retry Attempts**   | 3                                            |
| **AI Response Format**   | JSON (structured)                            |
| **Supported Languages**  | 40+ (auto-detected)                          |
| **Database Models**      | 3 (Review, VerificationJob, VerificationRun) |

---

## ✅ Checklist: "Is My Grading Integrated?"

- [ ] Read decision tree to choose grading method
- [ ] Added grading config to `.nibras/project.json`
- [ ] Set `NIBRAS_AI_API_KEY` and `NIBRAS_AI_MODEL` env vars
- [ ] Tested locally with sample submission
- [ ] Verified AI API is working (check logs)
- [ ] Tested with low confidence score (verify human review escalation)
- [ ] Set appropriate `minConfidence` threshold for course
- [ ] Configured instructor notifications
- [ ] Tested E2E (submit → grade → see results in dashboard)
- [ ] Monitored first real submissions
- [ ] Collected feedback from instructors
- [ ] Adjusted rubrics based on results

---

## 🎓 Learning Path

**Beginner**:

1. Read GRADING_QUICK_REFERENCE.md (15 min)
2. Copy-paste an example and run it locally
3. Adjust for your use case

**Intermediate**:

1. Read GRADING_SYSTEM_ANALYSIS.md — Understanding section (20 min)
2. Review GRADING_IMPLEMENTATION_GUIDE.md — Decision Tree (10 min)
3. Implement a full assignment with grading
4. Deploy to staging and test

**Advanced**:

1. Read all three documents thoroughly
2. Study source code in `packages/grading/src/`
3. Understand worker job processing
4. Optimize for your specific course needs
5. Contribute improvements to grading system

---

## 🆘 Getting Help

| Problem                          | Solution                                              |
| -------------------------------- | ----------------------------------------------------- |
| "How do I grade MCQs?"           | See GRADING_QUICK_REFERENCE.md → Code Examples        |
| "My assignment needs grading"    | See GRADING_IMPLEMENTATION_GUIDE.md → Decision Tree   |
| "Grades aren't being created"    | See GRADING_SYSTEM_ANALYSIS.md → Troubleshooting      |
| "AI confidence is too low"       | See FAQ → "How do I improve confidence?"              |
| "I need to set up in production" | See GRADING_IMPLEMENTATION_GUIDE.md → Setup Checklist |

---

## 📝 Notation Guide

Throughout the documentation:

- **`type: 'mcq'`** — Code block (copy-paste friendly)
- **→** — Flow arrow
- **✅ / ❌** — Status indicators
- **Q:** / **A:** — Questions and answers
- **`bold code`** — Important identifiers
- **_Italics_** — Emphasis
- **[Link](#)** — Cross-references

---

## 🔄 Version History

| Version | Date       | Changes               |
| ------- | ---------- | --------------------- |
| 1.0     | 2026-04-09 | Initial documentation |

---

## 📄 Document Metadata

**Created**: 2026-04-09
**Based on**: Nibras codebase analysis
**Covers**: `@nibras/grading` package, `apps/worker`, integration points
**Scope**: Grading system only (not auth, submission, verification)

---

## 🎯 Next Steps

1. **Pick your starting document** based on your role (see "By Role" section above)
2. **Search for your use case** (MCQ, Exam, File grading)
3. **Copy and adapt** the code examples
4. **Test locally** before deploying
5. **Reference the docs** when you hit an issue

**Good luck! Happy grading! 🎓**
