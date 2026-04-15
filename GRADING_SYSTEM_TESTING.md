# 🧪 Grading System Testing Guide

## Overview

The grading system in `@nibras/grading` is integrated with the worker service to automatically grade student submissions. This guide shows how to test all grading capabilities.

---

## ✅ Deployment Status

**Current Status on Fly.io:**

- ✅ API: https://nibras-api.fly.dev (running)
- ✅ Worker: Processing grading jobs (internal service)
- ✅ Web: https://nibras-web.fly.dev (running)
- ✅ Database: PostgreSQL 16 (running)

---

## Part 1: Local Testing (Recommended First)

### Prerequisites

```bash
# Build the grading package
npm run build --workspace=@nibras/grading

# Ensure dependencies installed
npm ci
```

### Test 1️⃣: MCQ (Multiple Choice) Grading

Create `test-mcq.js`:

```javascript
const { grade } = require('./packages/grading/dist/index.js');

async function testMCQ() {
  const result = await grade({
    type: 'mcq',
    config: {
      apiKey: process.env.NIBRAS_AI_API_KEY,
      model: 'gpt-4o-mini',
    },
    questions: [
      {
        id: 'q1',
        question: 'What is the capital of France?',
        options: ['A. London', 'B. Paris', 'C. Berlin', 'D. Madrid'],
        studentAnswer: 'B. Paris',
      },
    ],
  });

  console.log('Result:', {
    score: result.score,
    correctCount: result.correctCount,
    totalQuestions: result.totalQuestions,
  });
}

testMCQ().catch(console.error);
```

Run:

```bash
NIBRAS_AI_API_KEY=sk-... node test-mcq.js
```

**Expected Output:**

```
Result: { score: 100, correctCount: 1, totalQuestions: 1 }
```

---

### Test 2️⃣: Exam Grading (with Model Answers)

Create `test-exam.js`:

```javascript
const { grade } = require('./packages/grading/dist/index.js');

async function testExam() {
  const result = await grade({
    type: 'exam',
    config: {
      apiKey: process.env.NIBRAS_AI_API_KEY,
      model: 'gpt-4o-mini',
    },
    questions: [
      {
        id: 'q1',
        question: 'Explain recursion',
        type: 'long_answer',
        maxScore: 10,
        modelAnswer: 'A function that calls itself with a base case and recursive case.',
        gradingCriteria: 'Mention base case and recursive case',
      },
    ],
    studentAnswers: [
      {
        questionId: 'q1',
        answer: 'Recursion is when a function calls itself. You need a base case to stop.',
      },
    ],
  });

  console.log('Result:', {
    totalScore: result.totalScore,
    maxScore: result.maxScore,
    percentage: result.percentage,
    confidence: result.confidence,
  });
}

testExam().catch(console.error);
```

Run:

```bash
NIBRAS_AI_API_KEY=sk-... node test-exam.js
```

---

### Test 3️⃣: File Grading

Create `test-file.js`:

```javascript
const { grade } = require('./packages/grading/dist/index.js');

async function testFile() {
  const result = await grade({
    type: 'file',
    config: {
      apiKey: process.env.NIBRAS_AI_API_KEY,
      model: 'gpt-4o-mini',
    },
    input: {
      fileContent: 'Question: What is recursion?\nAnswer: A function calling itself.',
      fileType: 'text',
      modelAnswerQuestions: [
        {
          id: 'q1',
          question: 'What is recursion?',
          type: 'short_answer',
          maxScore: 5,
          modelAnswer: 'A function that calls itself.',
        },
      ],
    },
  });

  console.log('Result:', {
    totalScore: result.totalScore,
    maxScore: result.maxScore,
    percentage: result.percentage,
  });
}

testFile().catch(console.error);
```

---

### Test 4️⃣: Backwards Compatibility (Worker Integration)

Create `test-compat.js`:

```javascript
const { gradeSemanticAnswer } = require('./packages/grading/dist/index.js');

async function testCompat() {
  const result = await gradeSemanticAnswer({
    aiConfig: {
      apiKey: process.env.NIBRAS_AI_API_KEY,
      model: 'gpt-4o-mini',
    },
    subject: 'Computer Science',
    project: 'assignment-1',
    question: {
      id: 'q1',
      prompt: 'Explain recursion',
      points: 10,
      rubric: [
        { id: 'r1', description: 'Defines recursion', points: 5 },
        { id: 'r2', description: 'Provides example', points: 5 },
      ],
    },
    answerText:
      'Recursion is when a function calls itself. Example: factorial(n) = n * factorial(n-1).',
  });

  console.log('Result:', {
    score: result.score,
    confidence: result.confidence,
    needsReview: result.needsReview,
  });
}

testCompat().catch(console.error);
```

---

## Part 2: API Integration Testing

### API Endpoints Available

The grading system works through the following flow:

1. **Student submits code** → `/v1/tracking/submissions` (via CLI or Web)
2. **Worker receives job** → Processes with grading system
3. **Grades stored** → In database with confidence scores
4. **Review queue** → Shows submissions needing human review

### Test Endpoints

#### 1️⃣ Verify API is Running

```bash
curl https://nibras-api.fly.dev/healthz | jq .
# Expected: { "ok": true }
```

#### 2️⃣ List Available Courses

```bash
curl -X GET https://nibras-api.fly.dev/v1/tracking/courses \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Note:** Requires authentication token from device flow or GitHub OAuth

#### 3️⃣ View Submission Queue

```bash
curl -X GET https://nibras-api.fly.dev/v1/tracking/submissions \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## Part 3: End-to-End Testing via CLI

### Setup CLI with Fly.io

```bash
# Configure CLI to point to your Fly.io deployment
export NIBRAS_API_BASE_URL=https://nibras-api.fly.dev

# Authenticate via device flow
npx @nibras/cli login

# Follow the device flow prompts to authorize
```

### Submit Assignment for Grading

```bash
# In your assignment directory
npx @nibras/cli submit

# The submission will:
# 1. Stage files
# 2. Commit to GitHub
# 3. Push to remote
# 4. Poll API for verification
# 5. Trigger worker grading job
```

### Check Submission Status

```bash
npx @nibras/cli status

# Shows:
# - Verification results
# - Grading status
# - AI confidence scores (if grading enabled)
# - Human review flag (if confidence < threshold)
```

---

## Part 4: Monitor Grading in Progress

### View Worker Logs

```bash
# Check worker processing logs
flyctl logs -a nibras-worker --tail 100

# Look for lines like:
# "AI grading: answer file found"
# "AI grading failed for question" (if errors)
# "AI confidence:" (showing confidence scores)
```

### Check Submissions Needing Review

```bash
# Via API (requires auth)
curl https://nibras-api.fly.dev/v1/tracking/review-queue \
  -H "Authorization: Bearer TOKEN"

# Shows submissions with low confidence scores
# that need human review
```

---

## Part 5: Configuration for Production

### Environment Variables (in Fly.io)

Set these in your Fly deployment:

```bash
# For AI grading
NIBRAS_AI_API_KEY=sk-...              # OpenAI or compatible API key
NIBRAS_AI_MODEL=gpt-4o-mini           # Model to use (default)
NIBRAS_AI_BASE_URL=https://api.openai.com/v1  # Override endpoint
NIBRAS_AI_MIN_CONFIDENCE=0.8          # Confidence threshold (0-1)

# Optional for other providers
# NIBRAS_AI_BASE_URL=https://your-azure.openai.azure.com/v1  # Azure
# NIBRAS_AI_BASE_URL=http://localhost:8000/v1  # Local Ollama
```

### Set Environment Variables on Fly.io

```bash
# For API app
flyctl secrets set NIBRAS_AI_API_KEY=sk-... -a nibras-api

# For Worker app (where grading actually runs)
flyctl secrets set NIBRAS_AI_API_KEY=sk-... -a nibras-worker
```

---

## Part 6: Troubleshooting

### Issue: "Cannot find module '@nibras/grading'"

**Solution:**

```bash
npm run build --workspace=@nibras/grading
npm ci
```

### Issue: AI Grading Returns 401 Error

**Solution:**

- Verify `NIBRAS_AI_API_KEY` is set
- Check key is valid with: `curl https://api.openai.com/v1/models -H "Authorization: Bearer YOUR_KEY"`
- Use valid OpenAI key or compatible provider

### Issue: Worker Not Grading Submissions

**Solution:**

```bash
# 1. Check worker is running
flyctl status -a nibras-worker

# 2. Check logs for errors
flyctl logs -a nibras-worker

# 3. Verify grading config in project
cat .nibras/project.json | jq .grading

# 4. Ensure submission has questions marked for grading
```

### Issue: Low Confidence Scores

**Solution:**

- Increase `NIBRAS_AI_MIN_CONFIDENCE` if threshold too strict
- Review grading rubric clarity
- Provide better model answers
- Use more specific grading criteria

---

## Part 7: Performance Considerations

### Latency

- **Local grading**: < 2 seconds per question
- **Fly.io (with OpenAI)**: 3-10 seconds per submission
- **Batch processing**: Worker queues handle multiple submissions

### Limits

- **Max questions per batch**: 10 (to avoid token limits)
- **Max submission size**: 10 MB
- **Confidence scores**: 0-1 range (0 = not confident, 1 = very confident)

### Cost Optimization

```bash
# Use gpt-4o-mini for cost savings
export NIBRAS_AI_MODEL=gpt-4o-mini  # ~$0.15 per 1M tokens

# Disable AI grading if not needed
# (just don't set NIBRAS_AI_API_KEY)

# Batch questions together
# Reduces API calls
```

---

## Part 8: Success Indicators

### ✅ System is Working Correctly If:

- [x] API responds to `/healthz` endpoint
- [x] Worker processes submission jobs
- [x] Grading results appear in database
- [x] Confidence scores range from 0-1
- [x] High-confidence answers pass quickly
- [x] Low-confidence answers flag for review
- [x] Questions are graded in correct language

### 🚀 Ready for Production If:

- [x] All local tests pass
- [x] Fly.io deployments successful
- [x] AI API key configured
- [x] Grading thresholds tuned to course needs
- [x] Instructor can review flagged submissions
- [x] Student feedback is clear and helpful
- [x] Performance meets requirements

---

## Next Steps

1. **Start with local tests** - Run `test-*.js` files with your API key
2. **Deploy to Fly.io** - Use fixed Dockerfiles (already done ✅)
3. **Configure AI** - Set `NIBRAS_AI_API_KEY` secrets
4. **Test via CLI** - Submit real assignment for grading
5. **Monitor results** - Check worker logs and confidence scores
6. **Tune thresholds** - Adjust `NIBRAS_AI_MIN_CONFIDENCE` as needed
7. **Go live** - Enable grading for your courses

---

## Support

For issues:

- Check worker logs: `flyctl logs -a nibras-worker`
- Check API logs: `flyctl logs -a nibras-api`
- Verify grading config: Check `.nibras/project.json`
- Test locally first before debugging in production
