# Grading System — Quick Reference for Developers

## 30-Second Overview

```typescript
import { grade } from '@nibras/grading';

// Three grading modes available:
await grade({ type: 'mcq', questions: [...], config: {...} })
await grade({ type: 'exam', questions: [...], studentAnswers: [...], config: {...} })
await grade({ type: 'file', input: {...}, config: {...} })
```

---

## Cheat Sheet: When to Use Each Mode

| Use Case                 | Mode     | Input                                 | Output                      |
| ------------------------ | -------- | ------------------------------------- | --------------------------- |
| Quiz questions (A/B/C/D) | **MCQ**  | Questions + student choices           | Correct answer + confidence |
| Mixed exam (short/long)  | **Exam** | Questions + model answers + responses | Score with partial credit   |
| PDF/text assignments     | **File** | File content + expected questions     | Score + extraction notes    |

---

## API Configuration

### Minimal Setup

```typescript
const config = {
  apiKey: 'sk-...', // Required
};
await grade({ type: 'mcq', questions, config });
// Uses defaults: gpt-4o-mini, OpenAI API, minConfidence=0.8
```

### Full Setup

```typescript
const config = {
  apiKey: 'sk-...', // Required
  model: 'gpt-4o', // Optional (default: gpt-4o-mini)
  baseURL: 'https://api.openai.com/v1', // Optional (for Azure/Ollama)
  minConfidence: 0.85, // Optional (default: 0.8)
  language: 'ar' | 'en' | 'auto', // Optional (default: auto)
};
```

### Environment Variables (Worker)

```bash
NIBRAS_AI_API_KEY="sk-..."           # Required to enable AI grading
NIBRAS_AI_MODEL="gpt-4o-mini"        # Required if API_KEY set
NIBRAS_AI_BASE_URL="https://..."     # Optional (Azure, Ollama, etc.)
NIBRAS_AI_MIN_CONFIDENCE="0.8"       # Optional (default: 0.8)
NIBRAS_AI_TIMEOUT_MS="30000"         # Optional
```

---

## Code Examples

### 1. MCQ Grading

```typescript
import { grade } from '@nibras/grading';

const result = await grade({
  type: 'mcq',
  config: { apiKey: process.env.OPENAI_API_KEY },
  questions: [
    {
      id: 'q1',
      question: 'What is a database?',
      lectureContext: 'Databases store organized data...', // Optional context
      options: [
        'A. A file on disk',
        'B. A collection of organized data',
        'C. A programming language',
      ],
      studentAnswer: 'B. A collection of organized data',
    },
  ],
});

// Output:
// {
//   type: 'mcq',
//   totalQuestions: 1,
//   correctCount: 1,
//   score: 100,
//   results: [{
//     questionId: 'q1',
//     isCorrect: true,
//     confidence: 0.98,
//     correctAnswer: 'B. A collection of organized data',
//     explanation: 'The student correctly identified...',
//   }],
// }

if (result.type === 'mcq') {
  console.log(`Score: ${result.score}%`);
  console.log(`Correct: ${result.correctCount}/${result.totalQuestions}`);
}
```

### 2. Exam Grading

```typescript
const result = await grade({
  type: 'exam',
  config: { apiKey: 'sk-...', minConfidence: 0.9 },
  questions: [
    {
      id: 'q1',
      question: 'Explain normalization in databases',
      type: 'long_answer',
      maxScore: 10,
      modelAnswer: 'Normalization reduces redundancy by splitting tables into smaller ones...',
      gradingCriteria: '5 pts for definition, 5 pts for benefits',
    },
    {
      id: 'q2',
      question: 'What is an INNER JOIN?',
      type: 'short_answer',
      maxScore: 5,
      modelAnswer: 'INNER JOIN returns only matching rows from both tables',
    },
  ],
  studentAnswers: [
    {
      questionId: 'q1',
      answer: 'Normalization splits tables to remove duplicate data and improve data integrity.',
    },
    {
      questionId: 'q2',
      answer: 'INNER JOIN gets common records between two tables.',
    },
  ],
});

if (result.type === 'exam') {
  console.log(`Total: ${result.totalScore}/${result.maxScore} (${result.percentage}%)`);
  console.log(`Needs review: ${result.needsHumanReview}`);

  result.results.forEach((r) => {
    console.log(`Q${r.questionId}: ${r.score}/${r.maxScore} — ${r.feedback}`);
  });
}
```

### 3. File Upload Grading

```typescript
import { readFile } from 'fs/promises';
import { grade } from '@nibras/grading';

// Step 1: Extract text from PDF (use pdfjs-dist or similar)
const pdfText = await extractTextFromPDF('submission.pdf');

// Step 2: Grade
const result = await grade({
  type: 'file',
  config: { apiKey: 'sk-...', model: 'gpt-4o' },
  input: {
    fileContent: pdfText,
    fileType: 'pdf',
    assignmentInstructions: 'Database Assignment - Due Friday', // Optional
    modelAnswerQuestions: [
      {
        id: 'q1',
        question: 'What is normalization?',
        type: 'long_answer',
        maxScore: 10,
        modelAnswer: 'Normalization is...',
      },
    ],
  },
});

if (result.type === 'file') {
  console.log(`Score: ${result.totalScore}/${result.maxScore}`);
  console.log(`Extraction notes: ${result.extractionNotes}`);
  console.log(`Needs review: ${result.needsHumanReview}`);
}
```

### 4. Backward Compatible Semantic Grading

```typescript
import { gradeSemanticAnswer } from '@nibras/grading';

// Legacy API (still supported)
const result = await gradeSemanticAnswer({
  aiConfig: {
    apiKey: 'sk-...',
    model: 'gpt-4o-mini',
    minConfidence: 0.8,
  },
  subject: 'Computer Science',
  project: 'cs101-p1',
  question: {
    id: 'q1',
    prompt: 'Explain object-oriented programming',
    points: 10,
    rubric: [
      {
        id: 'encapsulation',
        description: 'Correctly explains encapsulation',
        points: 5,
      },
      {
        id: 'inheritance',
        description: 'Correctly explains inheritance',
        points: 5,
      },
    ],
    examples: [
      {
        label: 'Excellent',
        answer: 'OOP encapsulates data and behavior...',
      },
    ],
  },
  answerText: 'Object-oriented programming bundles data and methods together...',
});

// Output:
// {
//   score: 9,
//   confidence: 0.92,
//   needsReview: false,
//   criterionScores: [
//     { id: 'encapsulation', points: 5, earned: 5, justification: '...' },
//     { id: 'inheritance', points: 5, earned: 4, justification: '...' },
//   ],
//   reasoningSummary: '...',
//   evidenceQuotes: ['...'],
// }
```

---

## Common Patterns

### Pattern 1: Batch Multiple Questions

```typescript
// MCQ: Group up to 10 per request
const questions = [q1, q2, q3, ..., q10];
const result = await grade({
  type: 'mcq',
  config,
  questions,  // All processed in one batch
});

// Exam: Group up to 5 per request (longer answers)
const questions = [q1, q2, q3, q4, q5];
const result = await grade({
  type: 'exam',
  config,
  questions,
  studentAnswers,
});
```

### Pattern 2: Handle "Needs Review" Cases

```typescript
const result = await grade({...});

if (result.needsHumanReview) {
  // Flag for instructor review
  await notifyInstructor({
    submissionId,
    reason: 'AI confidence low',
    aiConfidence: result.confidence,
  });
}
```

### Pattern 3: Process Retries

```typescript
async function gradeWithRetry(input, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await grade(input);
    } catch (err) {
      console.warn(`Attempt ${attempt} failed:`, err.message);
      if (attempt === maxRetries) throw err;
      await sleep(1000 * attempt);  // Exponential backoff
    }
  }
}

const result = await gradeWithRetry({ type: 'exam', ... });
```

### Pattern 4: Custom Model/Provider

```typescript
// Use different AI provider (Azure, Ollama, etc.)
const result = await grade({
  type: 'exam',
  config: {
    apiKey: 'your-azure-key',
    model: 'gpt-4-deployment-name',
    baseURL: 'https://your-azure-instance.openai.azure.com/v1',
  },
  questions,
  studentAnswers,
});
```

---

## Error Handling

### Common Errors & Fixes

| Error                                   | Cause                   | Fix                                           |
| --------------------------------------- | ----------------------- | --------------------------------------------- |
| `"Invalid API key"`                     | Missing or wrong apiKey | Check `NIBRAS_AI_API_KEY` env var             |
| `"AI returned invalid JSON"`            | LLM didn't output JSON  | Reduce batch size, retry with different model |
| `"Failed to extract answers from file"` | File content malformed  | Ensure file is properly extracted to text     |
| `"Unknown grading type"`                | Wrong type string       | Use `'mcq'`, `'exam'`, or `'file'` exactly    |

### Safe Error Handling Pattern

```typescript
try {
  const result = await grade({...});
  return result;
} catch (err) {
  if (err.message.includes('AI API error')) {
    // Retry with simpler model or escalate to human
    return { needsHumanReview: true, error: err.message };
  }
  throw err;  // Other errors should bubble up
}
```

---

## Testing

### Test MCQ Grading Locally

```typescript
// test/grading.test.js
import { grade } from '@nibras/grading';

test('MCQ grading', async () => {
  const result = await grade({
    type: 'mcq',
    config: { apiKey: process.env.OPENAI_API_KEY },
    questions: [
      {
        id: 'test1',
        question: 'What is 2+2?',
        options: ['A. 3', 'B. 4', 'C. 5'],
        studentAnswer: 'B. 4',
      },
    ],
  });

  assert.equal(result.type, 'mcq');
  assert.equal(result.correctCount, 1);
  assert(result.results[0].isCorrect);
});
```

### Test Without API Key (Mock)

```typescript
// Mock the chatCompletion function
jest.mock('@nibras/grading/client', () => ({
  chatCompletion: jest.fn().mockResolvedValue({
    rawJson: {
      results: [
        {
          questionId: 'q1',
          isCorrect: true,
          confidence: 0.95,
          correctAnswer: 'B',
          explanation: 'Correct!',
        },
      ],
    },
  }),
}));

test('MCQ with mocked AI', async () => {
  const result = await grade({...});
  expect(result.correctCount).toBe(1);
});
```

---

## Manifest Configuration

### Grading Section in `.nibras/project.json`

```json
{
  "projectKey": "cs101-assignment-1",
  "grading": {
    "questions": [
      {
        "id": "semantic-q1",
        "mode": "semantic",
        "prompt": "Explain the concept of normalization",
        "points": 10,
        "answerFile": "answers/q1.txt",
        "rubric": [
          {
            "id": "definition",
            "description": "Provides correct definition of normalization",
            "points": 5
          },
          {
            "id": "normal-forms",
            "description": "Lists and explains 1NF, 2NF, 3NF",
            "points": 5
          }
        ],
        "examples": [
          {
            "label": "Perfect Answer",
            "answer": "Normalization is the process of organizing database schema to reduce redundancy..."
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

## Supported Providers

### OpenAI (Default)

```typescript
const config = {
  apiKey: 'sk-...',
  model: 'gpt-4o-mini', // or gpt-4o
  // baseURL defaults to https://api.openai.com/v1
};
```

### Azure OpenAI

```typescript
const config = {
  apiKey: 'your-azure-key',
  model: 'your-deployment-name',
  baseURL: 'https://your-resource.openai.azure.com/v1',
};
```

### Ollama (Local)

```typescript
const config = {
  apiKey: 'dummy', // Ollama doesn't need a real key
  model: 'neural-chat', // or mistral, llama2, etc.
  baseURL: 'http://localhost:11434/v1',
};
```

### Any OpenAI-Compatible API

```typescript
const config = {
  apiKey: 'key',
  model: 'model-name',
  baseURL: 'https://api-provider.com/v1',
};
```

---

## Worker Integration

### Triggering AI Grading (in `apps/worker`)

```typescript
// Worker automatically grades when:
// 1. VerificationJob exists for submission
// 2. Tests pass (exitCode === 0)
// 3. NIBRAS_AI_API_KEY is set
// 4. Manifest has grading config

async function runAiGrading(submissionAttemptId, prisma) {
  const aiConfig = loadAiConfig();  // From env vars
  if (!aiConfig) return null;       // AI disabled

  const attempt = await fetchAttempt(submissionAttemptId);
  const manifest = attempt.project.releases[0].manifestJson;
  const gradingConfig = manifest?.grading;
  if (!gradingConfig) return null;  // No grading config

  // Process each semantic question...
  for (const q of gradingConfig.questions) {
    const result = await gradeSemanticAnswer({...});
    // Aggregate results...
  }

  // Create Review record
  await prisma.review.create({...});
}
```

### Job Status Flow

```
submission → VerificationJob (queued)
          ↓ (worker claims)
          ↓ (tests run)
          ↓ IF tests PASS
          ↓ (AI grading runs)
          ↓
          → Review record created
          → SubmissionAttempt status = passed/needs_review
```

---

## Performance Tips

1. **Batch MCQs in groups of 10** — Reduces API calls
2. **Use gpt-4o-mini** — Cheaper than gpt-4o, sufficient for grading
3. **Set minConfidence threshold** — Avoid unnecessary human reviews
4. **Enable BullMQ mode** — Horizontal scaling via Redis
5. **Disable AI if not needed** — Unset `NIBRAS_AI_API_KEY`

---

## Debugging

### Enable Verbose Logging

```typescript
// In worker.ts, all events logged to stdout as JSON
function log(level: 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>) {
  const entry = {
    level,
    time: new Date().toISOString(),
    pid: process.pid,
    msg: message,
    ...extra,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// View logs: docker logs <worker-container> | jq '.msg'
```

### Inspect AI Response

```typescript
const response = await chatCompletion(messages, config, true);
console.log('Raw AI response:', JSON.stringify(response.rawJson, null, 2));
```

### Test Single Question

```typescript
const result = await grade({
  type: 'exam',
  config: {...},
  questions: [singleQuestion],  // Test one at a time
  studentAnswers: [singleAnswer],
});
console.log(JSON.stringify(result, null, 2));
```

---

## See Also

- **Full Analysis**: `GRADING_SYSTEM_ANALYSIS.md`
- **Source Code**: `packages/grading/src/`
- **Worker Code**: `apps/worker/src/worker.ts`
- **Type Definitions**: `packages/grading/src/types.ts`
