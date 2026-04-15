# Grading System — Implementation Guide

## Decision Tree: Which Grading Method to Use?

```
START
│
├─ Is this a multiple-choice quiz?
│  └─ YES → Use MCQ mode
│     ├─ Do you have lecture context to help AI?
│     │  └─ YES → Include lectureContext field
│     │  └─ NO → Leave empty or null
│     └─ AI will determine correct answer based on question + context
│
├─ Is this an exam/assignment with predefined model answers?
│  └─ YES → Use EXAM mode
│     ├─ Do you have a grading rubric?
│     │  └─ YES → Include gradingCriteria for better scoring
│     │  └─ NO → AI will infer scoring from question type
│     ├─ Mixed question types?
│     │  └─ YES → Set appropriate maxScore for each
│     │  └─ NO → All same length answers
│     └─ AI compares student answer to model answer
│
├─ Are students submitting files (PDF, code, text)?
│  └─ YES → Use FILE mode
│     ├─ Need to extract answers from file content?
│     │  └─ YES → File mode handles extraction automatically
│     │  └─ NO → You can pre-extract and use EXAM mode
│     ├─ Have questions that match the file?
│     │  └─ YES → File mode will semantically match
│     │  └─ NO → Add assignment instructions for context
│     └─ AI extracts answers then grades them
│
└─ END
```

---

## Grading Method Selection Matrix

| Factor                     | MCQ                 | Exam                 | File                |
| -------------------------- | ------------------- | -------------------- | ------------------- |
| **Best for**               | Objective questions | Mixed question types | File submissions    |
| **Answer source**          | Multiple choice     | Text input           | Extracted from file |
| **Model answer required?** | No (AI infers)      | Yes                  | Yes                 |
| **Partial credit**         | No (0 or full)      | Yes                  | Yes                 |
| **Confidence flagging**    | Yes                 | Yes                  | Yes                 |
| **Batch size**             | 10 questions        | 5 questions          | 1 file              |
| **Token cost**             | Lowest              | Medium               | High                |
| **Ambiguity tolerance**    | Medium              | High                 | Highest             |
| **Human review rate**      | 10-20%              | 20-30%               | 30-40%              |

---

## Implementation Checklist

### Step 1: Set Up Dependencies

```bash
# Ensure @nibras/grading is installed
npm ls @nibras/grading

# If not present
npm install @nibras/grading  # (monorepo workspace)

# Or in package.json for a new app
{
  "dependencies": {
    "@nibras/grading": "workspace:*"
  }
}
```

### Step 2: Configure AI API

#### Local Development

```bash
# Copy .env.example to .env
cp .env.example .env

# Add your API key
echo "NIBRAS_AI_API_KEY=sk-..." >> .env
echo "NIBRAS_AI_MODEL=gpt-4o-mini" >> .env
```

#### Production Deployment

```yaml
# docker-compose.yml or k8s manifest
environment:
  NIBRAS_AI_API_KEY: '${AI_API_KEY}' # From secrets
  NIBRAS_AI_MODEL: 'gpt-4o'
  NIBRAS_AI_BASE_URL: '${AI_BASE_URL}' # Optional
  NIBRAS_AI_MIN_CONFIDENCE: '0.85' # Stricter for prod
```

### Step 3: Choose Grading Method

**For MCQ Quiz**:

```typescript
import { grade } from '@nibras/grading';

const quizResult = await grade({
  type: 'mcq',
  config: { apiKey: process.env.OPENAI_API_KEY },
  questions: quizQuestions,
});
```

**For Exam**:

```typescript
const examResult = await grade({
  type: 'exam',
  config: { apiKey: process.env.OPENAI_API_KEY },
  questions: examQuestions,
  studentAnswers: studentAnswers,
});
```

**For File Upload**:

```typescript
const fileResult = await grade({
  type: 'file',
  config: { apiKey: process.env.OPENAI_API_KEY },
  input: {
    fileContent: extractedText,
    fileType: 'pdf',
    modelAnswerQuestions: questions,
  },
});
```

### Step 4: Handle Results

```typescript
if (result.needsHumanReview) {
  // Escalate to instructor
  await createReviewRequest({
    submissionId,
    aiConfidence: result.confidence,
    reason: 'Low AI confidence',
  });
} else {
  // Auto-approve
  await finalizeGrade({
    submissionId,
    score: result.totalScore,
    status: 'passed',
  });
}
```

### Step 5: Set Up Notifications

```typescript
// After grading completes
await sendStudentNotification({
  studentEmail: attempt.user.email,
  score: result.totalScore,
  feedback: generateFeedback(result),
  needsReview: result.needsHumanReview,
});
```

---

## Integration with Different Layers

### Integration with API (`apps/api`)

**Location**: `apps/api/src/features/submissions/...`

```typescript
// When submission is received
import { grade } from '@nibras/grading';

async function handleSubmission(submissionId: string) {
  const submission = await prisma.submissionAttempt.findUnique({
    where: { id: submissionId },
    include: { project: { include: { releases: true } } },
  });

  // 1. Create verification job
  const job = await prisma.verificationJob.create({
    data: {
      submissionAttemptId: submissionId,
      maxAttempts: 3,
    },
  });

  // 2. If using BullMQ, add to queue
  if (process.env.REDIS_URL) {
    await verificationQueue.add(VERIFICATION_QUEUE_NAME, {
      jobId: job.id,
      submissionAttemptId: submissionId,
      attempt: 0,
      maxAttempts: 3,
    });
  }
  // Otherwise worker polls DB

  return job;
}
```

### Integration with CLI (`apps/cli`)

**Location**: `apps/cli/src/commands/submit.ts`

```typescript
// After pushing to branch, poll for grading result
async function waitForGrading(submissionId: string) {
  let attempt = 0;
  const maxAttempts = 120; // 10 minutes at 5s intervals

  while (attempt < maxAttempts) {
    const status = await api.getSubmissionStatus(submissionId);

    if (status.verificationCompleted) {
      console.log(`✅ Grading complete: ${status.result}`);
      return status;
    }

    console.log(`⏳ Waiting for grading... (${status.progress})`);
    await sleep(5000);
    attempt++;
  }

  throw new Error('Grading timeout');
}
```

### Integration with Web (`apps/web`)

**Location**: `apps/web/src/components/SubmissionGradeDisplay.tsx`

```typescript
import { Review } from '@prisma/client';

export function GradeDisplay({ review }: { review: Review }) {
  return (
    <div className="grade-card">
      <h3>Grade: {review.score}/{review.rubricJson?.totalPoints}</h3>

      {review.aiGradedAt && (
        <div className="ai-grading">
          <p>AI Graded with {Math.round(review.aiConfidence! * 100)}% confidence</p>

          {review.aiNeedsReview && (
            <Alert variant="warning">
              This submission flagged by AI for human review
            </Alert>
          )}

          {review.aiReasoningSummary && (
            <details>
              <summary>AI Reasoning</summary>
              <p>{review.aiReasoningSummary}</p>
            </details>
          )}

          {review.aiEvidenceQuotes && (
            <blockquote>
              {(review.aiEvidenceQuotes as string[]).map((q, i) => (
                <p key={i}>"{q}"</p>
              ))}
            </blockquote>
          )}
        </div>
      )}

      {review.feedback && (
        <p className="feedback">{review.feedback}</p>
      )}
    </div>
  );
}
```

### Integration with Worker (`apps/worker`)

**Already implemented!** See `worker.ts`:

- Automatically runs AI grading when tests pass
- Creates Review records with AI results
- Handles retries and failures
- Sends notifications

---

## Real-World Examples

### Example 1: CS101 Database Assignment

**Setup** (in `.nibras/project.json`):

```json
{
  "projectKey": "cs101-db-design",
  "grading": {
    "questions": [
      {
        "id": "normalize",
        "mode": "semantic",
        "prompt": "Design a normalized schema for the student database",
        "points": 20,
        "answerFile": "design/schema.sql",
        "rubric": [
          {
            "id": "1nf",
            "description": "Schema is in 1NF (no repeating groups)",
            "points": 5
          },
          {
            "id": "2nf",
            "description": "Schema is in 2NF (no partial dependencies)",
            "points": 5
          },
          {
            "id": "3nf",
            "description": "Schema is in 3NF (no transitive dependencies)",
            "points": 10
          }
        ]
      }
    ]
  },
  "test": {
    "command": "npm test"
  }
}
```

**Worker processes this**:

```
1. Clone student repo
2. Run `npm test` → Tests pass
3. Read `design/schema.sql`
4. Call AI grader with rubric
5. AI checks: 1NF? 2NF? 3NF? → Awards points
6. Create Review with criteria breakdown
7. If confidence < 0.85 → Flag for human review
```

**Student sees**:

```
Grade: 18/20 (90%)
AI Confidence: 92%

Criteria:
✅ 1NF: 5/5 pts
✅ 2NF: 5/5 pts
⚠️  3NF: 8/10 pts (partial - missing transitive dependency for CourseOffering)

AI Notes:
"Your schema successfully normalizes most relationships. However, the CourseOffering table
contains a transitive dependency between Course and Semester through the offering ID.
Consider splitting this further."
```

---

### Example 2: Organic Chemistry Quiz

**Code** (in API route):

```typescript
import { grade } from '@nibras/grading';

app.post('/api/quiz/chem101/submit', async (req, res) => {
  const { studentAnswers, lectureDate } = req.body;

  // Fetch lecture notes for context
  const lectureContext = await db.getLectureNotes(lectureDate);

  const questions = await db.getQuizQuestions('chem101');
  const mcqQuestions = questions.map((q) => ({
    id: q.id,
    question: q.question,
    lectureContext: lectureContext[q.topic], // Context per topic
    options: q.options,
    studentAnswer: studentAnswers[q.id],
  }));

  const result = await grade({
    type: 'mcq',
    config: { apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' },
    questions: mcqQuestions,
  });

  // Store results
  await db.saveQuizResults({
    studentId: req.user.id,
    quizId: 'chem101',
    score: result.score,
    results: result.results,
  });

  res.json({
    score: result.score,
    passed: result.score >= 70,
    details: result.results.map((r) => ({
      questionId: r.questionId,
      correct: r.isCorrect,
      explanation: r.explanation, // Show student why they were wrong
    })),
  });
});
```

---

### Example 3: Code Review Assignment (File Upload)

**Code** (in submission handler):

```typescript
import { grade } from '@nibras/grading';
import * as pdf from 'pdf-parse';

app.post('/api/assignments/code-review/submit', async (req, res) => {
  const { fileBuffer, assignmentId } = req.body;

  // Extract text from PDF
  const pdfData = await pdf(fileBuffer);
  const fileContent = pdfData.text;

  // Get assignment questions
  const assignment = await db.getAssignment(assignmentId);
  const questions = assignment.grading.questions; // Predefined questions

  const result = await grade({
    type: 'file',
    config: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o', // Better for complex code review
      minConfidence: 0.9, // Stricter for critical feedback
    },
    input: {
      fileContent,
      fileType: 'pdf',
      assignmentInstructions: assignment.instructions,
      modelAnswerQuestions: questions.map((q) => ({
        id: q.id,
        question: q.prompt,
        type: 'long_answer',
        maxScore: q.points,
        modelAnswer: q.rubric.join('\n'),
        gradingCriteria: q.criteria,
      })),
    },
  });

  // Create submission record
  const submission = await db.createSubmission({
    studentId: req.user.id,
    assignmentId,
    fileUrl: fileBuffer, // Store original
    gradeResult: result,
    needsReview: result.needsHumanReview,
  });

  // Notify instructor if flagged
  if (result.needsHumanReview) {
    await notifyInstructor(
      `Submission ${submission.id} needs review. AI confidence: ${result.confidence}`
    );
  }

  res.json({
    submissionId: submission.id,
    score: result.totalScore,
    percentage: result.percentage,
    extractionNotes: result.extractionNotes,
    needsReview: result.needsHumanReview,
  });
});
```

---

## Performance Optimization

### 1. Batch Processing Strategy

**Before** (slow — 10 API calls):

```typescript
for (const question of questions) {
  const result = await grade({
    type: 'mcq',
    questions: [question], // One at a time
  });
  // Process result
}
```

**After** (fast — 1 API call):

```typescript
const result = await grade({
  type: 'mcq',
  questions: questions.slice(0, 10), // Batch of 10
  // Automatically batches internally with chunk()
});
```

### 2. Confidence-Based Escalation

**Reduce human review load**:

```typescript
const result = await grade({...});

// Only escalate low-confidence cases
if (result.confidence >= 0.85) {
  // Auto-pass (80% are confident)
  await autoApprove(submission);
} else {
  // Flag for review (20% need human check)
  await flagForReview(submission);
}
```

### 3. Model Selection

| Accuracy        | Speed | Cost | Best For                                  |
| --------------- | ----- | ---- | ----------------------------------------- |
| **gpt-4o**      | Slow  | High | Critical grading, complex rubrics         |
| **gpt-4o-mini** | Fast  | Low  | Quick feedback, straightforward questions |

**Strategy**:

- Use `gpt-4o-mini` by default (faster, cheaper)
- Switch to `gpt-4o` if confidence < 0.7 (retry with better model)

```typescript
const result = await grade({
  type: 'exam',
  config: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini', // Try fast first
  },
  questions,
  studentAnswers,
});

if (result.confidence < 0.7) {
  // Retry with better model
  const retryResult = await grade({
    ...result,
    config: { ...result.config, model: 'gpt-4o' },
  });
  return retryResult;
}
```

### 4. Caching & Deduplication

```typescript
// Cache model answers to avoid re-grading identical submissions
const cacheKey = `exam:${examId}:${studentAnswersHash}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return cached;  // Return cached result
}

const result = await grade({...});

await redis.setex(cacheKey, 3600, result);  // Cache 1 hour
return result;
```

---

## Testing Strategy

### Unit Tests

```typescript
// test/grading.test.ts
import { grade } from '@nibras/grading';
import { describe, it, expect } from 'vitest';

describe('MCQ Grading', () => {
  it('should grade correct answers', async () => {
    const result = await grade({
      type: 'mcq',
      config: { apiKey: process.env.OPENAI_API_KEY },
      questions: [
        {
          id: 'q1',
          question: 'What is 2+2?',
          options: ['A. 3', 'B. 4', 'C. 5'],
          studentAnswer: 'B. 4',
        },
      ],
    });

    expect(result.type).toBe('mcq');
    expect(result.correctCount).toBe(1);
    expect(result.results[0].isCorrect).toBe(true);
  });

  it('should flag low-confidence ambiguous questions', async () => {
    const result = await grade({
      type: 'mcq',
      config: { apiKey: process.env.OPENAI_API_KEY },
      questions: [
        {
          id: 'q1',
          question: 'Is Python better?', // Ambiguous
          options: ['A. Yes', 'B. No'],
          studentAnswer: 'A. Yes',
        },
      ],
    });

    // Ambiguous question should have lower confidence
    expect(result.results[0].confidence).toBeLessThan(0.9);
  });
});
```

### Integration Tests

```typescript
// test/integration/worker.test.ts
import { runAiGrading } from '@nibras/worker';

describe('Worker AI Grading', () => {
  it('should create Review record after successful grading', async () => {
    const submissionId = 'test-submission-123';

    const result = await runAiGrading(submissionId, prisma);

    expect(result).not.toBeNull();
    expect(result!.gradeResult.score).toBeGreaterThanOrEqual(0);

    // Verify Review was created
    const review = await prisma.review.findFirst({
      where: { submissionAttemptId: submissionId },
    });
    expect(review).toBeDefined();
    expect(review!.aiModel).toBe(process.env.NIBRAS_AI_MODEL);
  });
});
```

### E2E Tests

```typescript
// test/e2e/submission-flow.test.ts
describe('Full Submission to Grade Flow', () => {
  it('should grade a complete submission', async () => {
    // 1. Create submission
    const submission = await api.createSubmission({...});

    // 2. Wait for verification
    await waitFor(() => submission.verified, { timeout: 30000 });

    // 3. Check grade
    const graded = await api.getSubmission(submission.id);
    expect(graded.status).toBe('passed');
    expect(graded.review).toBeDefined();
    expect(graded.review.aiModel).toBe('gpt-4o-mini');
  });
});
```

---

## Monitoring & Observability

### Key Metrics to Track

```typescript
// Emit metrics after grading
const metrics = {
  grading_type: 'exam',
  total_score: result.totalScore,
  max_score: result.maxScore,
  percentage: result.percentage,
  ai_confidence: result.confidence,
  needs_human_review: result.needsHumanReview,
  processing_time_ms: Date.now() - startTime,
  ai_model: config.model,
};

// Send to monitoring service (Datadog, New Relic, etc.)
sendMetrics(metrics);
```

### Sentry Integration (already in worker)

```typescript
import * as Sentry from '@sentry/node';

try {
  const result = await grade({...});
} catch (err) {
  Sentry.captureException(err, {
    tags: {
      grading_type: 'exam',
      submission_id: submissionId,
    },
    extra: {
      ai_model: config.model,
      batch_size: questions.length,
    },
  });
}
```

### Logging

```typescript
// Structured logging for debugging
log('info', 'Grading completed', {
  submissionId,
  gradingType: result.type,
  score: result.totalScore,
  confidence: result.confidence,
  needsReview: result.needsHumanReview,
  durationMs: Date.now() - startTime,
});
```

---

## Migration Guide: From Old to New API

### Old API (Legacy)

```typescript
import { gradeSemanticAnswer } from '@nibras/grading';

const result = await gradeSemanticAnswer({
  aiConfig: { apiKey: 'sk-...', model: 'gpt-4o' },
  question: { id: 'q1', prompt: '...', points: 10, rubric: [...] },
  answerText: 'Student answer here',
});
```

### New API (Recommended)

```typescript
import { grade } from '@nibras/grading';

const result = await grade({
  type: 'exam',
  config: { apiKey: 'sk-...', model: 'gpt-4o' },
  questions: [
    {
      id: 'q1',
      question: '...',
      type: 'long_answer',
      maxScore: 10,
      modelAnswer: 'Reference answer',
      gradingCriteria: 'Rubric description',
    },
  ],
  studentAnswers: [
    {
      questionId: 'q1',
      answer: 'Student answer here',
    },
  ],
});
```

### Migration Steps

1. **Identify legacy calls** to `gradeSemanticAnswer`
2. **Convert questions**:
   - Old `prompt` → New `question`
   - Old `rubric` → New `gradingCriteria` + `modelAnswer`
   - Old `examples` → New `modelAnswer` + context
3. **Update config**:
   - Old `aiConfig` → New `GradingConfig`
   - Old `baseUrl` → New `baseURL`
4. **Handle results**:
   - Old `criterionScores` → New `results[i].feedback`
   - Old `needsReview` → New `needsHumanReview`
5. **Test thoroughly** before deploying

---

## FAQ

**Q: Can I use different AI models?**
A: Yes, set `model: 'gpt-4o'` or `'gpt-3.5-turbo'` or any OpenAI-compatible model.

**Q: What if AI API fails?**
A: Worker catches the error and continues with verification results only. Review record not created.

**Q: Can I grade without AI?**
A: Yes, unset `NIBRAS_AI_API_KEY` — only verification tests run.

**Q: How do I handle non-English submissions?**
A: Set `language: 'ar'` in config — AI responds in that language.

**Q: What's the recommended confidence threshold?**
A: Default 0.8 (80%) is good. Use 0.9+ for critical courses, 0.7 for lenient grading.

**Q: How long does grading take?**
A: Typically 5-30 seconds depending on batch size and model. Exam slower than MCQ.

---

## Next Steps

1. **Start with MCQ**: Simplest mode, good for testing
2. **Try EXAM mode**: Most flexible, best for real assignments
3. **Add FILE grading**: For document submissions
4. **Monitor results**: Track confidence scores and human review rates
5. **Optimize**: Adjust minConfidence based on actual instructor feedback
6. **Scale**: Enable BullMQ mode for production deployments

---

## Support & Debugging

**Issue**: "Invalid API key"

- Check `NIBRAS_AI_API_KEY` env var exists
- Verify key format: should start with `sk-`
- Test with `curl` directly to API

**Issue**: "AI returned invalid JSON"

- Reduce batch size
- Try `gpt-4o` instead of `gpt-4o-mini`
- Check system prompt is clear

**Issue**: Low confidence scores\*\*

- Question might be ambiguous
- Add more context (lectureContext for MCQ)
- Provide better model answer (for exam)
- Use stricter model (gpt-4o vs gpt-4o-mini)

**Issue**: Grading too slow\*\*

- Enable BullMQ mode (Redis-based queue)
- Reduce batch size (trades off for slower)
- Use `gpt-4o-mini` (cheaper, slightly less accurate)
- Implement caching for duplicate submissions

---

## See Also

- `GRADING_SYSTEM_ANALYSIS.md` — Deep dive into architecture
- `GRADING_QUICK_REFERENCE.md` — Code snippets and common patterns
- `packages/grading/src/` — Source code
- `apps/worker/src/worker.ts` — Job processor implementation
