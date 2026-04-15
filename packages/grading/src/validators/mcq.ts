// ============================================================
// MCQ Validator
// يصحح MCQ بدون model answer — الـ AI بيحدد الإجابة الصح من السياق
// ============================================================

import { chatCompletion, chunk } from '../client';
import type { GradingConfig, MCQQuestion, MCQGradingResult, MCQResult } from '../types';

const BATCH_SIZE = 10; // عدد الأسئلة في كل request

interface AIBatchResponse {
  results: Array<{
    questionId: string;
    isCorrect: boolean;
    confidence: number;
    correctAnswer: string;
    explanation: string;
  }>;
}

async function gradeBatch(questions: MCQQuestion[], config: GradingConfig): Promise<MCQResult[]> {
  const systemPrompt = `You are an expert educational assessment AI.
Your job is to evaluate MCQ answers submitted by students.
You will determine the correct answer based on your knowledge and the provided lecture context.
You do NOT have a model answer — you must reason from the question, options, and context.

IMPORTANT RULES:
- Be objective and accurate
- confidence must be between 0 and 1
- If a question is ambiguous, lower your confidence score
- explanation must be concise (1-2 sentences max)
- Always respond in the same language as the question

Respond ONLY with valid JSON matching this schema:
{
  "results": [
    {
      "questionId": "string",
      "isCorrect": boolean,
      "confidence": number,
      "correctAnswer": "string (the full text of the correct option)",
      "explanation": "string"
    }
  ]
}`;

  const questionsPayload = questions.map((q) => ({
    questionId: q.id,
    question: q.question,
    options: q.options,
    studentAnswer: q.studentAnswer,
    lectureContext: q.lectureContext ?? null,
  }));

  const userPrompt = `Grade these MCQ answers:\n${JSON.stringify(questionsPayload, null, 2)}`;

  const response = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    config,
    true
  );

  const parsed = response.rawJson as AIBatchResponse;

  if (!parsed?.results || !Array.isArray(parsed.results)) {
    throw new Error('Invalid AI response structure for MCQ batch');
  }

  return parsed.results.map((r) => ({
    questionId: r.questionId,
    isCorrect: r.isCorrect,
    confidence: Math.max(0, Math.min(1, r.confidence)),
    correctAnswer: r.correctAnswer,
    explanation: r.explanation,
  }));
}

export async function gradeMCQ(
  questions: MCQQuestion[],
  config: GradingConfig
): Promise<MCQGradingResult> {
  if (questions.length === 0) {
    return {
      type: 'mcq',
      totalQuestions: 0,
      correctCount: 0,
      score: 0,
      results: [],
    };
  }

  // بنقسم الأسئلة لـ batches عشان ما نعدّيش الـ context limit
  const batches = chunk(questions, BATCH_SIZE);
  const allResults: MCQResult[] = [];

  for (const batch of batches) {
    const batchResults = await gradeBatch(batch, config);
    allResults.push(...batchResults);
  }

  const correctCount = allResults.filter((r) => r.isCorrect).length;
  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  return {
    type: 'mcq',
    totalQuestions: questions.length,
    correctCount,
    score,
    results: allResults,
  };
}
