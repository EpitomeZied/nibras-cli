// ============================================================
// File Upload Validator
// يصحح assignments المرفوعة كـ files (PDF, text, code)
// بيعمل match بين محتوى الملف والـ model answer
// ============================================================

import { chatCompletion } from '../client';
import { gradeExam } from './exam';
import type { GradingConfig, FileGradingInput, FileGradingResult, StudentAnswer } from '../types';

// ----------------------------------------------------------------
// Step 1: استخراج إجابات الطالب من محتوى الملف
// ----------------------------------------------------------------

interface ExtractedAnswers {
  answers: Array<{ questionId: string; answer: string }>;
  extractionNotes: string;
}

async function extractAnswersFromFile(
  fileContent: string,
  questions: Array<{ id: string; question: string }>,
  config: GradingConfig,
  assignmentInstructions?: string
): Promise<ExtractedAnswers> {
  const instructionsSection = assignmentInstructions
    ? `\nAssignment Instructions:\n${assignmentInstructions}\n`
    : '';

  const systemPrompt = `You are an expert at extracting student answers from uploaded assignment files.${instructionsSection}
Given the file content and a list of questions, extract the student's answer for each question.

RULES:
- Match answers to questions by semantic relevance
- If an answer is not found, set it to "(not answered)"
- Keep extracted answers verbatim from the file — do not paraphrase
- extractionNotes should briefly describe the file structure and any issues

Respond ONLY with valid JSON:
{
  "answers": [
    { "questionId": "string", "answer": "string" }
  ],
  "extractionNotes": "string"
}`;

  const userPrompt = `Questions to match:
${JSON.stringify(questions, null, 2)}

File content:
---
${fileContent.slice(0, 8000)} ${fileContent.length > 8000 ? '\n[...content truncated...]' : ''}
---`;

  const response = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    config,
    true
  );

  const parsed = response.rawJson as ExtractedAnswers;

  if (!parsed?.answers || !Array.isArray(parsed.answers)) {
    throw new Error('Failed to extract answers from file');
  }

  return parsed;
}

// ----------------------------------------------------------------
// Step 2: تصحيح الإجابات المستخرجة (نفس منطق الـ exam)
// ----------------------------------------------------------------

export async function gradeFile(
  input: FileGradingInput,
  config: GradingConfig
): Promise<FileGradingResult> {
  const { fileContent, modelAnswerQuestions, assignmentInstructions } = input;

  if (!fileContent || fileContent.trim().length === 0) {
    return {
      type: 'file',
      totalScore: 0,
      maxScore: modelAnswerQuestions.reduce((s, q) => s + q.maxScore, 0),
      percentage: 0,
      confidence: 0,
      needsHumanReview: true,
      results: [],
      extractionNotes: 'File content is empty or could not be read.',
    };
  }

  // Step 1: استخراج الإجابات
  const questionSummaries = modelAnswerQuestions.map((q) => ({
    id: q.id,
    question: q.question,
  }));

  const { answers, extractionNotes } = await extractAnswersFromFile(
    fileContent,
    questionSummaries,
    config,
    assignmentInstructions
  );

  const studentAnswers: StudentAnswer[] = answers.map((a) => ({
    questionId: a.questionId,
    answer: a.answer,
  }));

  // Step 2: تصحيح بنفس الـ exam grader
  const examResult = await gradeExam(modelAnswerQuestions, studentAnswers, config);

  return {
    type: 'file',
    totalScore: examResult.totalScore,
    maxScore: examResult.maxScore,
    percentage: examResult.percentage,
    confidence: examResult.confidence,
    needsHumanReview: examResult.needsHumanReview,
    results: examResult.results,
    extractionNotes,
  };
}
