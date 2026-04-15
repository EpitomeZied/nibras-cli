import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possiblePaths = [
  path.resolve(__dirname, '../.env'), // packages/grading/.env
  path.resolve(process.cwd(), '.env'), // المجلد الحالي
  path.resolve(__dirname, '../../.env'), // root/.env
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.parsed) {
      console.log(`✅ Loaded .env from: ${envPath}`);
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  console.warn('⚠️ Warning: Could not load .env file from any expected location');
}

console.log('🔍 Debug - API Key exists:', !!process.env.NIBRAS_AI_API_KEY);
if (process.env.NIBRAS_AI_API_KEY) {
  console.log(
    '🔍 Debug - Key starts with:',
    process.env.NIBRAS_AI_API_KEY.substring(0, 15) + '...'
  );
} else {
  console.log(
    '🔍 Debug - Available env keys:',
    Object.keys(process.env).filter((k) => k.includes('NIBRAS'))
  );
}

import { grade, type GradingConfig } from './index.js';

const config: GradingConfig = {
  apiKey: process.env.NIBRAS_AI_API_KEY!,
  model: process.env.NIBRAS_AI_MODEL ?? 'gpt-4o-mini',
  baseURL: process.env.NIBRAS_AI_BASE_URL,
  minConfidence: parseFloat(process.env.NIBRAS_AI_MIN_CONFIDENCE ?? '0.8'),
  language: 'en',
};

// ================================================================
// Example 1: Mini Quiz (MCQ)
// ================================================================
async function exampleMCQ() {
  const result = await grade({
    type: 'mcq',
    config,
    questions: [
      {
        id: 'q1',
        question: 'What is a primary key in a database?',
        lectureContext:
          "In today's lecture, we discussed relational databases and the importance of primary keys in uniquely identifying records.",
        options: [
          'A. A column that stores the table name',
          'B. A column or set of columns that uniquely identifies each row',
          'C. A column that contains the date',
          'D. A column used only for encryption',
        ],
        studentAnswer: 'B. A column or set of columns that uniquely identifies each row',
      },
      {
        id: 'q2',
        question: 'What is the difference between SQL and NoSQL?',
        lectureContext:
          'We discussed database types: SQL uses structured schema with fixed tables, while NoSQL offers flexible schema for unstructured data.',
        options: [
          'A. There is no difference',
          'B. SQL is always faster',
          'C. SQL uses structured schema, NoSQL uses flexible schema',
          'D. NoSQL is only used in mobile apps',
        ],
        studentAnswer: 'D. NoSQL is only used in mobile apps',
      },
    ],
  });

  if (result.type === 'mcq') {
    console.log('MCQ Result:');
    console.log(`Score: ${result.score}/100`);
    console.log(`Correct: ${result.correctCount}/${result.totalQuestions}`);
    result.results.forEach((r) => {
      console.log(`  [${r.questionId}] ${r.isCorrect ? '✅' : '❌'} — ${r.explanation}`);
    });
  }
}

// ================================================================
// Example 2: Exam (Mixed Question Types)
// ================================================================
async function exampleExam() {
  const modelAnswerJSON = {
    questions: [
      {
        id: 'e1',
        question: 'Explain the concept of normalization in databases.',
        type: 'long_answer' as const,
        maxScore: 10,
        modelAnswer:
          'Normalization is the process of organizing data in a database to reduce redundancy and improve data integrity. It involves dividing large tables into smaller ones and defining relationships between them. The basic normal forms are 1NF, 2NF, and 3NF.',
        gradingCriteria:
          '1. Correct definition (3 points) 2. Mention goal of reducing redundancy (3 points) 3. List normal forms (4 points)',
      },
      {
        id: 'e2',
        question: 'What is the difference between INNER JOIN and LEFT JOIN?',
        type: 'short_answer' as const,
        maxScore: 5,
        modelAnswer:
          'INNER JOIN returns only the rows that have matching values in both tables. LEFT JOIN returns all rows from the left table, plus the matched rows from the right table (with NULLs for non-matches).',
      },
      {
        id: 'e3',
        question: 'Does NULL equal zero?',
        type: 'true_false' as const,
        maxScore: 2,
        modelAnswer:
          'No, NULL represents an unknown or missing value, which is fundamentally different from zero or an empty string.',
      },
    ],
  };

  const result = await grade({
    type: 'exam',
    config,
    questions: modelAnswerJSON.questions,
    studentAnswers: [
      {
        questionId: 'e1',
        answer:
          'Normalization reduces data redundancy and improves integrity by splitting tables. It includes 1NF, 2NF, and 3NF.',
      },
      {
        questionId: 'e2',
        answer:
          'INNER JOIN gets common records between tables, LEFT JOIN gets everything from the left table.',
      },
      {
        questionId: 'e3',
        answer: 'No, they are not the same thing.',
      },
    ],
  });

  if (result.type === 'exam') {
    console.log('\nExam Result:');
    console.log(`Total: ${result.totalScore}/${result.maxScore} (${result.percentage}%)`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Needs human review: ${result.needsHumanReview}`);
    result.results.forEach((r) => {
      console.log(`  [${r.questionId}] ${r.score}/${r.maxScore} — ${r.feedback}`);
    });
  }
}

// ================================================================
// Example 3: File Upload (Assignment Submission)
// ================================================================
async function exampleFile() {
  const extractedFileContent = `
Assignment: Database Design

Question 1 - Normalization:
Normalization organizes data and reduces redundancy by splitting large tables into smaller ones.
1NF requires that each cell contains only a single atomic value.

Question 2 - JOIN Types:
INNER JOIN returns only records that exist in both tables.
LEFT JOIN returns all records from the left table, plus matching records from the right.

Question 3:
NULL is not the same as zero; NULL means no value exists.
  `;

  const result = await grade({
    type: 'file',
    config,
    input: {
      fileContent: extractedFileContent,
      fileType: 'text',
      assignmentInstructions: 'Database Design Assignment — Week 5',
      modelAnswerQuestions: [
        {
          id: 'e1',
          question: 'Explain the concept of normalization',
          type: 'long_answer',
          maxScore: 10,
          modelAnswer:
            'Normalization is the process of organizing data to reduce redundancy and improve data integrity, including 1NF, 2NF, and 3NF.',
        },
        {
          id: 'e2',
          question: 'Difference between INNER JOIN and LEFT JOIN',
          type: 'short_answer',
          maxScore: 5,
          modelAnswer:
            'INNER JOIN: only matching rows. LEFT JOIN: all rows from left table + matches from right.',
        },
        {
          id: 'e3',
          question: 'Does NULL equal zero?',
          type: 'true_false',
          maxScore: 2,
          modelAnswer: 'No, NULL is an unknown value, not zero.',
        },
      ],
    },
  });

  if (result.type === 'file') {
    console.log('\nFile Grading Result:');
    console.log(`Total: ${result.totalScore}/${result.maxScore} (${result.percentage}%)`);
    console.log(`Extraction notes: ${result.extractionNotes}`);
    console.log(`Needs human review: ${result.needsHumanReview}`);
  }
}

(async () => {
  try {
    await exampleMCQ();
    await exampleExam();
    await exampleFile();
    console.log('\n✅ All examples completed!');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
  }
})();
