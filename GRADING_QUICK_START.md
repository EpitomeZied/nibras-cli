# ⚡ Grading System Quick Start

## 🚀 Get Started in 5 Minutes

### 1. Set Your OpenAI API Key

```bash
flyctl secrets set NIBRAS_AI_API_KEY=sk-your-key -a nibras-worker
```

### 2. Test Locally (Optional)

```bash
# Install if needed
npm ci

# Create test file
cat > test-quick.js << 'SCRIPT'
const { grade } = require('./packages/grading/dist/index.js');

(async () => {
  const result = await grade({
    type: 'mcq',
    config: { apiKey: process.env.NIBRAS_AI_API_KEY },
    questions: [{
      id: 'q1',
      question: 'What is 2+2?',
      options: ['A. 3', 'B. 4', 'C. 5'],
      studentAnswer: 'B. 4',
    }],
  });
  console.log(`Score: ${result.score}/100`);
})();
SCRIPT

# Run it
NIBRAS_AI_API_KEY=sk-your-key node test-quick.js
```

### 3. Enable Grading in Your Course

Create `.nibras/project.json`:

```json
{
  "grading": {
    "questions": [
      {
        "id": "q1",
        "mode": "semantic",
        "prompt": "Explain recursion",
        "points": 10,
        "rubric": [
          { "id": "r1", "description": "Defines concept", "points": 5 },
          { "id": "r2", "description": "Gives example", "points": 5 }
        ]
      }
    ]
  }
}
```

### 4. Submit for Grading

```bash
# Configure CLI
export NIBRAS_API_BASE_URL=https://nibras-api.fly.dev

# Login
npx @nibras/cli login

# Submit assignment
npx @nibras/cli submit

# Check status
npx @nibras/cli status
```

### 5. Monitor Grading

```bash
# Watch worker process grades
flyctl logs -a nibras-worker --tail 50

# Check API submissions
curl https://nibras-api.fly.dev/v1/tracking/submissions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Grading Types

### MCQ (Multiple Choice)

```javascript
{
  type: 'mcq',
  questions: [{
    id: 'q1',
    question: 'Which is correct?',
    options: ['A. ...', 'B. ...', 'C. ...'],
    studentAnswer: 'B. ...'
  }]
}
```

### Exam (with Model Answer)

```javascript
{
  type: 'exam',
  questions: [{
    id: 'q1',
    question: 'Explain X',
    type: 'long_answer',
    maxScore: 10,
    modelAnswer: 'Expected answer...',
    gradingCriteria: 'Must mention A and B'
  }],
  studentAnswers: [{
    questionId: 'q1',
    answer: 'Student answer...'
  }]
}
```

### File Upload

```javascript
{
  type: 'file',
  input: {
    fileContent: '...extracted text...',
    fileType: 'text',
    modelAnswerQuestions: [...]
  }
}
```

## ⚙️ Configuration

| Variable                   | Default                   | Purpose                |
| -------------------------- | ------------------------- | ---------------------- |
| `NIBRAS_AI_API_KEY`        | (required)                | OpenAI API key         |
| `NIBRAS_AI_MODEL`          | gpt-4o-mini               | Model to use           |
| `NIBRAS_AI_MIN_CONFIDENCE` | 0.8                       | Review threshold (0-1) |
| `NIBRAS_AI_BASE_URL`       | https://api.openai.com/v1 | API endpoint           |

## 🔗 Links

- 📖 Full Testing Guide: `GRADING_SYSTEM_TESTING.md`
- 🌐 API: https://nibras-api.fly.dev
- 🌐 Web: https://nibras-web.fly.dev
- 📚 Code: `packages/grading/src/`

## ✅ Verify It Works

```bash
# Health check
curl https://nibras-api.fly.dev/healthz

# Worker is running
flyctl status -a nibras-worker

# All functions exported
node -e "const g = require('./packages/grading/dist/index.js');
console.log('✅ grade' + (typeof g.grade) +
           ' ✅ gradeSemanticAnswer' + (typeof g.gradeSemanticAnswer))"
```

## 🆘 Troubleshooting

| Issue               | Fix                                         |
| ------------------- | ------------------------------------------- |
| "No module grading" | `npm run build --workspace=@nibras/grading` |
| "401 Unauthorized"  | Check `NIBRAS_AI_API_KEY` is valid          |
| Worker not grading  | Check logs: `flyctl logs -a nibras-worker`  |
| Low confidence      | Review rubric clarity, use better model     |

## 📞 Support

Check the full guide:

```bash
cat GRADING_SYSTEM_TESTING.md
```

---

**You're all set!** Start with step 1 and you'll have AI grading working in minutes. 🚀
