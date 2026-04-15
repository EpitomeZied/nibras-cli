# Nibras Grading System — Complete Analysis

## Executive Summary

The Nibras platform implements a **modular, AI-powered grading system** that supports three distinct grading methods:

1. **MCQ (Multiple Choice)** — automated grading with confidence scoring
2. **Exam/Assignment** — semantic grading with rubric-based scoring and partial credit
3. **File Upload** — extract answers from PDFs/text and grade against model answers

The system uses **OpenAI-compatible APIs** (supporting OpenAI, Azure, Ollama, or any compatible provider) and features intelligent **confidence scoring** to flag submissions needing human review.

---

## Architecture Overview

### Package Structure

```
packages/grading/              # Core grading engine (@nibras/grading)
├── src/
│   ├── index.ts              # Public API exports
│   ├── types.ts              # Type definitions for all grading modes
│   ├── runner.ts             # Router for different grading types
│   ├── client.ts             # OpenAI-compatible API client
│   ├── compat.ts             # Legacy semantic grading API
│   └── validators/
│       ├── mcq.ts            # MCQ grading logic
│       ├── exam.ts           # Exam grading with model answers
│       └── file.ts           # File upload grading
│
apps/worker/                   # Job processor
├── src/
│   ├── worker.ts            # Main job processor (runs verification & AI grading)
│   ├── queue.ts             # Queue constants & Redis parsing
│   ├── sandbox.ts           # Sandboxed test execution
│   └── email.ts             # Notification service
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     API / CLI / Web                          │
│              (Submission triggers grading)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  VerificationJob (DB)         │
         │  - status: queued/running     │
         │  - submissionAttemptId        │
         │  - maxAttempts                │
         └────────────┬──────────────────┘
                      │
         ┌────────────▼──────────────────┐
         │  Worker: tick() or BullMQ     │
         │  1. Claims job from DB/Redis  │
         │  2. Runs verification tests   │
         │  3. Runs AI grading (if pass) │
         │  4. Finalizes job             │
         └────────┬──────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   ┌────▼────┐      ┌──────▼──────┐
   │ Verify  │      │ AI Grade    │
   │ Tests   │      │ (Optional)  │
   └────┬────┘      └──────┬──────┘
        │                  │
   Exit code = 0?    @nibras/grading
        │                  │
        └─────────┬────────┘
                  │
        ┌─────────▼──────────┐
        │  Update SubmissionAttempt
        │  - status: passed/failed/needs_review
        │  - Create Review record (if AI ran)
        │  - Send notifications
        └──────────────────────┘
```

---

## The Three Grading Methods

### 1. MCQ Grading (Multiple Choice Questions)

**Purpose**: Automatically grade objective questions without a pre-defined model answer.

**Type Signature**:

```typescript
type GradingInput = {
  type: 'mcq';
  questions: MCQQuestion[];
  config: GradingConfig;
};

interface MCQQuestion {
  id: string;
  question: string;
  lectureContext?: string; // Optional lecture notes for context
  options: string[]; // ["A. ...", "B. ...", ...]
  studentAnswer: string; // Full text of selected option
}
```

**AI Behavior**:

- AI determines the correct answer based on **question semantics + lecture context**
- **Batch processing**: Groups questions in batches of 10 to avoid context limit overflows
- **Confidence scoring**: AI outputs confidence (0–1) — ambiguous questions get lower confidence
- **Language-aware**: Responds in the question's language

**Output**:

```typescript
interface MCQGradingResult {
  type: 'mcq';
  totalQuestions: number;
  correctCount: number;
  score: number; // 0–100
  results: MCQResult[];
}

interface MCQResult {
  questionId: string;
  isCorrect: boolean;
  confidence: number; // 0–1
  correctAnswer: string; // AI's answer
  explanation: string; // Justification
}
```

**Implementation** (`validators/mcq.ts`):

```typescript
async function gradeBatch(questions: MCQQuestion[], config: GradingConfig): Promise<MCQResult[]>;
```

---

### 2. Exam / Assignment Grading

**Purpose**: Grade mixed-type exams (MCQ + short/long answer) using model answers and rubrics.

**Type Signature**:

```typescript
type GradingInput = {
  type: 'exam';
  questions: ExamQuestion[];
  studentAnswers: StudentAnswer[];
  config: GradingConfig;
};

interface ExamQuestion {
  id: string;
  question: string;
  type: 'mcq' | 'short_answer' | 'long_answer' | 'true_false';
  maxScore: number;
  modelAnswer: string; // Reference answer
  gradingCriteria?: string; // Optional rubric description
}

interface StudentAnswer {
  questionId: string;
  answer: string;
}
```

**AI Behavior**:

- Compares student answer to **model answer** using semantic similarity
- **Partial credit** allowed for partially correct answers
- **Rules**:
  - MCQ: full credit (maxScore) or zero only
  - Short/long answers: award partial credit based on concepts covered
- **Batch processing**: Groups in batches of 5 (fewer than MCQ due to longer answers)
- **Confidence threshold**: Flags for human review if confidence < `minConfidence` (default 0.8)

**Output**:

```typescript
interface ExamGradingResult {
  type: 'exam';
  totalScore: number;
  maxScore: number;
  percentage: number; // 0–100
  confidence: number; // Average confidence across questions
  needsHumanReview: boolean; // True if any question confidence < threshold
  results: ExamQuestionResult[];
}

interface ExamQuestionResult {
  questionId: string;
  question: string;
  studentAnswer: string;
  modelAnswer: string;
  score: number;
  maxScore: number;
  percentage: number; // 0–100
  confidence: number; // 0–1
  feedback: string; // Constructive feedback (2-3 sentences)
  isFullCredit: boolean; // score === maxScore
  needsHumanReview: boolean; // confidence < minConfidence
}
```

**Implementation** (`validators/exam.ts`):

```typescript
async function gradeBatch(
  questions: ExamQuestion[],
  answerMap: Map<string, string>,
  config: GradingConfig
): Promise<ExamQuestionResult[]>;
```

---

### 3. File Upload Grading

**Purpose**: Grade assignments submitted as files (PDF, text, code) by:

1. **Extracting** student answers from file content
2. **Matching** extracted answers to questions
3. **Grading** using the exam grading logic

**Type Signature**:

```typescript
type GradingInput = {
  type: 'file';
  input: FileGradingInput;
  config: GradingConfig;
};

interface FileGradingInput {
  fileContent: string; // Text extracted from file (PDF/text/code)
  fileType: 'pdf' | 'text' | 'code' | 'other';
  modelAnswerQuestions: ExamQuestion[];
  assignmentInstructions?: string; // Context for extraction
}
```

**Two-Step Process**:

**Step 1: Answer Extraction**

```typescript
async function extractAnswersFromFile(
  fileContent: string,
  questions: Array<{ id: string; question: string }>,
  config: GradingConfig
): Promise<ExtractedAnswers>;
```

- AI reads file content and identifies answers for each question
- **Semantic matching**: Doesn't require exact order or formatting
- **Outputs**:
  - `answers`: Array of `{ questionId, answer }`
  - `extractionNotes`: Notes on file structure/issues (e.g., "PDF scanned with 3 typos")

**Step 2: Grading**

- Reuses `gradeExam()` with extracted answers
- Same output as exam grading

**Output**:

```typescript
interface FileGradingResult {
  type: 'file';
  totalScore: number;
  maxScore: number;
  percentage: number;
  confidence: number;
  needsHumanReview: boolean;
  results: ExamQuestionResult[];
  extractionNotes?: string; // File parsing notes
}
```

**Implementation** (`validators/file.ts`):

```typescript
export async function gradeFile(
  input: FileGradingInput,
  config: GradingConfig
): Promise<FileGradingResult>;
```

---

## AI Integration

### OpenAI-Compatible API Client

**File**: `src/client.ts`

```typescript
export async function chatCompletion(
  messages: Message[],
  config: GradingConfig,
  jsonMode = true
): Promise<ChatResponse>;
```

**Configuration**:

```typescript
interface GradingConfig {
  apiKey: string;
  model?: string; // default: "gpt-4o-mini"
  baseURL?: string; // default: "https://api.openai.com/v1"
  minConfidence?: number; // default: 0.8
  language?: 'ar' | 'en' | 'auto'; // default: "auto"
}
```

**Supported Providers**:

- ✅ **OpenAI** (gpt-4o, gpt-4o-mini, etc.)
- ✅ **Azure OpenAI** (via custom baseURL)
- ✅ **Ollama** (self-hosted, via baseURL)
- ✅ **Any OpenAI-compatible API** (e.g., vLLM, LocalAI)

**Key Features**:

- **JSON mode**: Enforces structured JSON responses
- **Deterministic**: `temperature: 0` for consistent grading
- **Error handling**: Throws on invalid JSON or API errors
- **Batching helper**: `chunk<T>(arr, size)` for context management

---

### Backwards Compatibility: Legacy Semantic Grading API

**File**: `src/compat.ts`

For existing code using the old semantic grading system:

```typescript
export async function gradeSemanticAnswer(input: {
  aiConfig: AiConfig;
  subject: string;
  project: string;
  question: GradingQuestion;
  answerText: string;
}): Promise<AiGradeResult>;
```

**Old Types** (still supported):

```typescript
type GradingQuestion = {
  id: string;
  prompt: string;
  points: number;
  rubric: GradingRubricItem[]; // Criterion-based rubric
  examples?: GradingExample[];
  minConfidence?: number;
};

type AiGradeResult = {
  score: number;
  confidence: number;
  needsReview: boolean;
  criterionScores: CriterionScore[]; // Per-rubric scores
  reasoningSummary: string;
  evidenceQuotes: string[];
};
```

**Why Keep It?**

- Maintains API compatibility with `@nibras/worker` (older deployments)
- Allows gradual migration to new grading methods
- Used for legacy CS161 course configurations

---

## Worker Integration

### Job Flow in `apps/worker/src/worker.ts`

**Setup**:

```typescript
// Two modes of operation
if (process.env.REDIS_URL) {
  // BullMQ mode: instant dispatch via Redis
  new BullWorker(VERIFICATION_QUEUE_NAME, processBullJob, { ... })
} else {
  // DB polling mode: fallback (tick every WORKER_POLL_INTERVAL_MS)
  while (!shuttingDown) await tick(prisma)
}
```

### Main Job Processing: `tick()` Function

```
1. claimJob()
   ├─ Claim next queued/stale VerificationJob
   └─ Update status to "running"

2. runVerification()
   ├─ Fetch submission context + manifest
   ├─ Clone repo to temp directory
   ├─ Run test command in sandbox
   └─ Return { exitCode, log }

3. IF exitCode === 0:
   └─ runAiGrading()
      ├─ Load AI config from env (NIBRAS_AI_API_KEY, NIBRAS_AI_MODEL)
      ├─ Parse grading questions from manifest
      ├─ For each semantic question:
      │  ├─ Read answer file
      │  └─ Call gradeSemanticAnswer() (legacy API)
      └─ Aggregate results

4. finalizeJob() / failJob()
   ├─ Update VerificationJob status
   ├─ Update SubmissionAttempt status
   ├─ Create Review record (if AI ran)
   └─ Send notifications
```

### AI Grading in Worker

**Configuration** (environment variables):

```bash
NIBRAS_AI_API_KEY="sk-..."              # Required
NIBRAS_AI_MODEL="gpt-4o"                # Required
NIBRAS_AI_BASE_URL="https://..."        # Optional
NIBRAS_AI_TIMEOUT_MS="30000"            # Optional
NIBRAS_AI_MAX_RETRIES="3"               # Optional
NIBRAS_AI_MIN_CONFIDENCE="0.8"          # Optional
```

**AI Grading Workflow**:

```typescript
async function runAiGrading(
  submissionAttemptId: string,
  prisma: PrismaClient
): Promise<AiRunResult | null>;
```

1. **Load AI config** (return `null` if not configured)
2. **Fetch manifest** grading configuration
3. **Filter semantic questions** (`mode === "semantic"`)
4. **Clone repo** to temp directory
5. **For each question**:
   - Read answer file (e.g., `answers/q1.txt`)
   - Call `gradeSemanticAnswer()`
   - Aggregate criterion scores
6. **Create Review record** with AI results:
   ```typescript
   await tx.review.create({
     data: {
       submissionAttemptId,
       reviewerUserId: submission.userId, // System grader
       status: 'pending', // Awaits human review
       score: aggregated.score,
       feedback: aggregated.reasoningSummary,
       aiConfidence: aggregated.confidence,
       aiNeedsReview: aggregated.needsReview,
       aiReasoningSummary: aggregated.reasoningSummary,
       aiCriterionScores: aggregated.criterionScores,
       aiEvidenceQuotes: aggregated.evidenceQuotes,
       aiModel: aiConfig.model,
       aiGradedAt: new Date(),
     },
   });
   ```

### Final Job Status

| Verification Result | AI Result               | Final Status                             | Notes                    |
| ------------------- | ----------------------- | ---------------------------------------- | ------------------------ |
| ✅ Pass (exit 0)    | AI ran, high confidence | `passed`                                 | Auto-approved            |
| ✅ Pass             | AI ran, low confidence  | `needs_review`                           | Flagged for human review |
| ✅ Pass             | No AI config            | `passed`                                 | Verification only        |
| ❌ Fail             | N/A                     | `failed`                                 | Submission rejected      |
| ⚠️ Error            | N/A                     | `queued` (retry) or `failed` (exhausted) | Retry up to maxAttempts  |

---

## Database Schema

### VerificationJob (Job Queue)

```sql
model VerificationJob {
  id                  String            @id
  submissionAttemptId String            @unique
  traceId             String
  status              SubmissionStatus  @default(queued)
  attempt             Int               @default(0)
  maxAttempts         Int               @default(3)
  claimedAt           DateTime?         -- Last claim time (for stale detection)
  finishedAt          DateTime?
  createdAt           DateTime
  updatedAt           DateTime
}
```

**States**:

- `queued`: Waiting for worker
- `running`: Worker has claimed it
- `passed`: Verification passed
- `failed`: Verification failed
- `needs_review`: Verification passed, AI flagged for human review

---

### VerificationRun (Per-Attempt Log)

```sql
model VerificationRun {
  id                  String            @id
  submissionAttemptId String
  attempt             Int               -- Attempt number (1, 2, 3, ...)
  status              SubmissionStatus  -- Final status for this attempt
  log                 String            -- Test output / error message
  startedAt           DateTime?
  finishedAt          DateTime?
  createdAt           DateTime
  updatedAt           DateTime

  @@unique([submissionAttemptId, attempt])
}
```

---

### Review (Grading Results)

```sql
model Review {
  id                  String            @id
  submissionAttemptId String
  reviewerUserId      String            -- Who graded (system user for AI)
  status              ReviewStatus      -- pending, approved, rejected
  score               Float?            -- Final score
  feedback            String            -- Human feedback
  rubricJson          Json?             -- Rubric scores
  reviewedAt          DateTime?         -- Timestamp of human review
  createdAt           DateTime
  updatedAt           DateTime

  -- AI grading fields (all nullable)
  aiConfidence        Float?            -- 0–1
  aiNeedsReview       Boolean?          -- AI flagged this
  aiReasoningSummary  String?           -- AI explanation
  aiCriterionScores   Json?             -- [{id, points, earned, justification}]
  aiEvidenceQuotes    Json?             -- Quotes from answer
  aiModel             String?           -- e.g., "gpt-4o"
  aiGradedAt          DateTime?         -- Timestamp of AI grading
}
```

---

## Configuration & Manifest

### Project Manifest (`.nibras/project.json`)

Grading configuration lives in the project manifest:

```json
{
  "projectKey": "cs101-p1",
  "grading": {
    "questions": [
      {
        "id": "q1",
        "mode": "semantic", // or "mcq", "exam", "file"
        "prompt": "Explain OOP",
        "points": 10,
        "answerFile": "answers/q1.txt",
        "rubric": [
          {
            "id": "encapsulation",
            "description": "Correctly explains encapsulation",
            "points": 5
          },
          {
            "id": "inheritance",
            "description": "Correctly explains inheritance",
            "points": 5
          }
        ],
        "examples": [
          {
            "label": "Excellent",
            "answer": "OOP uses encapsulation to hide internal state..."
          }
        ],
        "minConfidence": 0.85
      }
    ]
  },
  "test": {
    "command": "npm test"
  }
}
```

---

## Core Design Patterns

### 1. **Batching for Context Management**

Problem: Large numbers of questions would exceed LLM context windows.

Solution:

```typescript
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
```

Usage:

- **MCQ**: Batch size = 10
- **Exam**: Batch size = 5 (longer answers)
- **Sequential processing**: Process each batch, collect results

---

### 2. **Confidence Scoring for Human Review Escalation**

**Problem**: AI grading can be uncertain; need to flag edge cases for humans.

**Solution**: Multi-level confidence checks:

```typescript
// Per-question level
const needsHumanReview = confidence < minConfidence;

// Exam-level (aggregate)
const needsHumanReview = allResults.some((r) => r.needsHumanReview);

// Worker-level (final status)
const finalStatus = aiResult?.reviewRequired
  ? SubmissionStatus.needs_review
  : SubmissionStatus.passed;
```

**Default threshold**: `minConfidence = 0.8` (80% certainty)

---

### 3. **Semantic Similarity Over Exact Matching**

**Problem**: Students may answer correctly but with different wording.

**Solution**: AI evaluates **semantic similarity** not string equality:

```
"INNER JOIN returns only common rows"
vs.
"INNER JOIN gets matching records from both tables"
→ Both marked correct (different wording, same concept)
```

**Implementation**: System prompt explicitly instructs:

> "Consider semantic similarity, not just exact wording"

---

### 4. **Backwards Compatibility Layer**

**Problem**: Legacy code uses old `gradeSemanticAnswer()` API.

**Solution**: Implement `compat.ts` wrapper:

```typescript
// Old API → New client
export async function gradeSemanticAnswer(input: {
  aiConfig: AiConfig;      // Old types
  question: GradingQuestion;
  answerText: string;
}): Promise<AiGradeResult> {
  // Internally calls chatCompletion() with GradingConfig
  const response = await chatCompletion(
    [{ role: "system", content: systemPrompt }, ...],
    { apiKey: aiConfig.apiKey, model: aiConfig.model, ... },
    true  // jsonMode
  );
  // Transform response to old AiGradeResult format
}
```

---

### 5. **Three-Layer Job Processing**

1. **API/CLI**: Trigger submission
2. **Database**: Persist job + attempts
3. **Worker**: Claim, execute, finalize

```
Submission → VerificationJob (queued)
          ↓ (worker claims)
          → VerificationJob (running)
          ↓ (worker runs tests)
          → VerificationRun (attempt 1, passed)
          ↓ (if tests pass & AI enabled)
          → Review (AI grading results)
          ↓ (worker finalizes)
          → SubmissionAttempt (passed/failed/needs_review)
          ↓ (send notifications)
          → Email + Dashboard update
```

---

## Configuration Examples

### Example 1: MCQ Quiz

```typescript
const result = await grade({
  type: 'mcq',
  config: {
    apiKey: 'sk-...',
    model: 'gpt-4o-mini',
  },
  questions: [
    {
      id: 'q1',
      question: 'What is a database?',
      lectureContext: 'In lecture 3, we defined databases as...',
      options: [
        'A. A collection of organized data',
        'B. A single file',
        'C. A programming language',
      ],
      studentAnswer: 'A. A collection of organized data',
    },
  ],
});

console.log(`Score: ${result.score}%`);
console.log(`Correct: ${result.correctCount}/${result.totalQuestions}`);
```

### Example 2: Mixed Exam

```typescript
const result = await grade({
  type: 'exam',
  config: {
    apiKey: 'sk-...',
    model: 'gpt-4o',
    minConfidence: 0.9, // Stricter threshold
  },
  questions: [
    {
      id: 'q1',
      question: 'What is normalization?',
      type: 'long_answer',
      maxScore: 10,
      modelAnswer: 'Normalization reduces redundancy by splitting tables...',
      gradingCriteria: 'Award 5 pts for definition, 5 pts for benefits',
    },
  ],
  studentAnswers: [
    {
      questionId: 'q1',
      answer: 'Normalization splits large tables into smaller ones to remove duplicate data...',
    },
  ],
});

console.log(`Total: ${result.totalScore}/${result.maxScore}`);
console.log(`Needs review: ${result.needsHumanReview}`);
```

### Example 3: File Upload

```typescript
const pdfText = await extractTextFromPDF('assignment.pdf'); // External tool

const result = await grade({
  type: 'file',
  config: { apiKey: 'sk-...', model: 'gpt-4o-mini' },
  input: {
    fileContent: pdfText,
    fileType: 'pdf',
    assignmentInstructions: 'Database Design Assignment — Week 5',
    modelAnswerQuestions: [
      {
        id: 'q1',
        question: 'Explain normalization',
        type: 'long_answer',
        maxScore: 10,
        modelAnswer: 'Normalization is...',
      },
    ],
  },
});

console.log(`Extracted notes: ${result.extractionNotes}`);
console.log(`Score: ${result.totalScore}/${result.maxScore}`);
```

---

## Error Handling & Edge Cases

### Handling Empty Submissions

```typescript
if (fileContent.trim().length === 0) {
  return {
    type: 'file',
    totalScore: 0,
    maxScore: questions.reduce((s, q) => s + q.maxScore, 0),
    percentage: 0,
    confidence: 0,
    needsHumanReview: true,
    results: [],
    extractionNotes: 'File content is empty or could not be read.',
  };
}
```

### Missing Answer Files

```typescript
try {
  answerText = await readFile(answerPath, 'utf8');
} catch {
  log('warn', 'AI grading: answer file not found', {
    answerFile: q.answerFile,
    questionId: q.id,
  });
  continue; // Skip this question, aggregate partial results
}
```

### API Failures (Non-Fatal)

```typescript
try {
  aiResult = await runAiGrading(job.submissionAttemptId, prisma);
} catch (err) {
  log('warn', 'AI grading error (non-fatal)', {
    jobId: job.id,
    error: err instanceof Error ? err.message : String(err),
  });
  // Continue with verification results only
  aiResult = null;
}
```

### Job Retry Logic

```typescript
async function failJob(
  jobId: string,
  submissionAttemptId: string,
  attempt: number,
  maxAttempts: number,
  errorMessage: string,
  prisma: PrismaClient
): Promise<void> {
  const nextAttempt = attempt + 1;
  const exhausted = nextAttempt >= maxAttempts;
  const nextStatus = exhausted ? SubmissionStatus.failed : SubmissionStatus.queued;

  // Update job and create next attempt record
  // Default maxAttempts = 3
}
```

---

## Performance Considerations

### Batch Processing

| Grading Type    | Batch Size | Rationale                                          |
| --------------- | ---------- | -------------------------------------------------- |
| MCQ             | 10         | Shorter answers, less context usage                |
| Exam            | 5          | Longer answers + model answers consume more tokens |
| File extraction | 1          | File content can be large (8KB truncation)         |

### Token Cost Optimization

1. **Batch MCQs**: 10 per request reduces API calls
2. **Confidence thresholds**: Only escalate uncertain cases to humans (saves review time)
3. **gpt-4o-mini**: Default model (cheaper than gpt-4o)
4. **JSON mode**: Enforced structured output reduces parsing errors

### Worker Scaling

- **BullMQ mode**: Scales via Redis (horizontal scaling)
- **DB polling mode**: Single worker (vertical scaling only)
- **Concurrency control**: `WORKER_CONCURRENCY` env var (default: 1)

---

## Integration Points

### 1. **API Layer** (`apps/api`)

Triggers grading by creating `VerificationJob`:

```typescript
await prisma.verificationJob.create({
  data: {
    submissionAttemptId: attemptId,
    status: SubmissionStatus.queued,
    maxAttempts: 3,
  },
});

// Push to queue if Redis available
if (redisAvailable) {
  await verificationQueue.add(VERIFICATION_QUEUE_NAME, {
    jobId,
    submissionAttemptId,
    attempt: 0,
    maxAttempts: 3,
  });
}
```

### 2. **CLI** (`apps/cli`)

Submits assignments and polls for results:

```typescript
// 1. Stage & commit changes
// 2. Push to branch
// 3. Create submission attempt
// 4. Poll VerificationJob until finished
while (job.status === 'running') {
  await sleep(2000);
  job = await fetchJobStatus(jobId);
}
```

### 3. **Web Dashboard** (`apps/web`)

Displays grading results:

```typescript
// Show Review with AI results
const review = await prisma.review.findUnique({
  where: { id: reviewId },
});

// Display:
// - aiConfidence (%)
// - aiNeedsReview (bool)
// - aiReasoningSummary (text)
// - aiCriterionScores (rubric breakdown)
// - aiEvidenceQuotes (citations from answer)
```

### 4. **Notifications** (`apps/worker/src/email.ts`)

Sends email when grading completes (via Resend API):

```typescript
// Triggered in finalizeJob()
await sendSubmissionStatusEmail({
  studentEmail: attempt.user.email,
  submissionId: attempt.id,
  status: finalStatus, // passed / failed / needs_review
  score: review?.score,
  feedback: review?.feedback,
});
```

---

## Security Considerations

### 1. **API Key Management**

```typescript
// Keys stored in environment variables only
const apiKey = process.env.NIBRAS_AI_API_KEY;

// Never logged or exposed
log('debug', 'AI config loaded', {
  model: aiConfig.model,
  // NOT logging apiKey
});
```

### 2. **Sandboxed Test Execution**

```typescript
// Tests run in isolated Docker container
return runSandboxed(
  cloneUrl, // Git repo
  branch, // Submission branch
  testCommand // npm test / python test.py / etc.
);
```

### 3. **Model Answer Confidentiality**

```typescript
// Model answers are in manifest, not exposed to students
const manifest = await getProjectManifest(projectId);
// Manifest fetched server-side only
// Students see only their submitted code
```

### 4. **Evidence Quotes from Submissions**

```typescript
// AI extracts quotes directly from student submission
aiEvidenceQuotes: [
  "The student wrote: 'Encapsulation hides implementation details...'",
  // Direct citations, no fabrication
];
```

---

## Limitations & Future Improvements

### Current Limitations

1. **File extraction**: Text truncated at 8KB (PDFs with long answers may be cut off)
2. **Single language per config**: Can't mix English/Arabic in same batch
3. **No stream processing**: Entire file must be loaded into memory
4. **Stateless grading**: No memory of previous submissions for consistency

### Potential Improvements

1. **Multi-language support**: Process batches by detected language
2. **Streaming file processing**: Handle large files with iterative chunk processing
3. **Grading history**: Cache model answers and student patterns for consistency
4. **Rubric templates**: Pre-defined rubrics for common assignment types
5. **Plagiarism detection**: Integrate with MOSS/Copyleaks before grading
6. **Adaptive confidence**: Learn per-question confidence thresholds from human reviews
7. **Custom LLM fine-tuning**: Train models on course-specific rubrics

---

## Troubleshooting

### "AI returned invalid JSON"

```
Error: AI returned invalid JSON: The AI response wasn't valid JSON
```

**Cause**: LLM returned text instead of JSON (rare with `response_format: {type: "json_object"}`)

**Fix**:

1. Check `minConfidence` threshold (lower = more certain)
2. Verify system prompt is clear
3. Retry with `gpt-4o` instead of `gpt-4o-mini`

### "Invalid AI response structure"

```
Error: Invalid AI response structure for MCQ batch
```

**Cause**: JSON response doesn't match expected schema

**Fix**:

1. Verify all required fields present in response
2. Check batch size (10 for MCQ, 5 for exam)
3. Log the raw response to debug

### "Failed to extract answers from file"

**Cause**: File content doesn't match questions

**Fix**:

1. Check `fileContent` is properly extracted (PDFs need text extraction tool)
2. Ensure questions are clear and questions match file content
3. Try with simpler assignment first

### AI grading returns null / not running

**Cause**: `NIBRAS_AI_API_KEY` or `NIBRAS_AI_MODEL` not set

**Fix**:

```bash
export NIBRAS_AI_API_KEY="sk-..."
export NIBRAS_AI_MODEL="gpt-4o-mini"
npm run worker  # Or deployed worker
```

---

## Summary

The Nibras grading system is a **production-ready, AI-powered assessment platform** featuring:

✅ **Three grading modes**: MCQ, Exam, File Upload
✅ **Semantic understanding**: Not just string matching
✅ **Confidence scoring**: Flags uncertain cases for human review
✅ **OpenAI-compatible**: Works with any LLM API
✅ **Backwards compatible**: Legacy API still supported
✅ **Scalable**: BullMQ + Redis for distributed processing
✅ **Secure**: Sandboxed execution, encrypted keys, server-side validation
✅ **Observable**: Detailed logging, Sentry integration, audit trails

The system gracefully degrades when AI is disabled (`NIBRAS_AI_API_KEY` not set) and can operate in polling or queue-based modes depending on infrastructure.
