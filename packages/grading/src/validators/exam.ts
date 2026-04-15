// ============================================================
// Exam Validator
// يصحح امتحانات mixed (MCQ + short + long answer) مع model answer بـ JSON
// ============================================================

import { chatCompletion, chunk } from '../client';
import type {
  GradingConfig,
  ExamQuestion,
  StudentAnswer,
  ExamGradingResult,
  ExamQuestionResult,
} from '../types';

const BATCH_SIZE = 5; // أسئلة أقل في الـ batch لأن الـ answers أطول

interface AIExamBatchResponse {
  results: Array<{
    questionId: string;
    score: number;
    confidence: number;
    feedback: string;
    isFullCredit: boolean;
  }>;
}

function buildAnswerMap(studentAnswers: StudentAnswer[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const sa of studentAnswers) {
    map.set(sa.questionId, sa.answer);
  }
  return map;
}

async function gradeBatch(
  questions: ExamQuestion[],
  answerMap: Map<string, string>,
  config: GradingConfig
): Promise<ExamQuestionResult[]> {
  const systemPrompt = `You are an expert educational grader with deep subject knowledge.
Your job is to grade student exam answers by comparing them to model answers.

GRADING RULES:
- Grade strictly but fairly
- Partial credit is allowed for partially correct answers
- For MCQ: full credit or zero only
- For short/long answers: award partial credit based on concepts covered
- score must be a number between 0 and maxScore (inclusive)
- confidence must be between 0 and 1
- feedback must be constructive and specific (2-3 sentences max)
- isFullCredit = true only when score === maxScore
- Consider semantic similarity, not just exact wording
- Grade in the same language as the question/answer

Respond ONLY with valid JSON:
{
  "results": [
    {
      "questionId": "string",
      "score": number,
      "confidence": number,
      "feedback": "string",
      "isFullCredit": boolean
    }
  ]
}`;

  const payload = questions.map((q) => ({
    questionId: q.id,
    question: q.question,
    type: q.type,
    maxScore: q.maxScore,
    modelAnswer: q.modelAnswer,
    gradingCriteria: q.gradingCriteria ?? null,
    studentAnswer: answerMap.get(q.id) ?? '(no answer provided)',
  }));

  const userPrompt = `Grade these answers:\n${JSON.stringify(payload, null, 2)}`;

  const response = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    config,
    true
  );

  const parsed = response.rawJson as AIExamBatchResponse;

  if (!parsed?.results || !Array.isArray(parsed.results)) {
    throw new Error('Invalid AI response structure for exam batch');
  }

  const minConfidence = config.minConfidence ?? 0.8;

  return parsed.results.map((r) => {
    const question = questions.find((q) => q.id === r.questionId)!;
    const score = Math.max(0, Math.min(question.maxScore, r.score));
    const confidence = Math.max(0, Math.min(1, r.confidence));
    const percentage = question.maxScore > 0 ? Math.round((score / question.maxScore) * 100) : 0;

    return {
      questionId: r.questionId,
      question: question.question,
      studentAnswer: answerMap.get(r.questionId) ?? '(no answer provided)',
      modelAnswer: question.modelAnswer,
      score,
      maxScore: question.maxScore,
      percentage,
      confidence,
      feedback: r.feedback,
      isFullCredit: r.isFullCredit,
      needsHumanReview: confidence < minConfidence,
    };
  });
}

export async function gradeExam(
  questions: ExamQuestion[],
  studentAnswers: StudentAnswer[],
  config: GradingConfig
): Promise<ExamGradingResult> {
  if (questions.length === 0) {
    return {
      type: 'exam',
      totalScore: 0,
      maxScore: 0,
      percentage: 0,
      confidence: 1,
      needsHumanReview: false,
      results: [],
    };
  }

  const answerMap = buildAnswerMap(studentAnswers);
  const batches = chunk(questions, BATCH_SIZE);
  const allResults: ExamQuestionResult[] = [];

  for (const batch of batches) {
    const batchResults = await gradeBatch(batch, answerMap, config);
    allResults.push(...batchResults);
  }

  const totalScore = allResults.reduce((sum, r) => sum + r.score, 0);
  const maxScore = questions.reduce((sum, q) => sum + q.maxScore, 0);
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const avgConfidence =
    allResults.length > 0
      ? allResults.reduce((sum, r) => sum + r.confidence, 0) / allResults.length
      : 1;
  const needsHumanReview = allResults.some((r) => r.needsHumanReview);

  return {
    type: 'exam',
    totalScore,
    maxScore,
    percentage,
    confidence: Math.round(avgConfidence * 100) / 100,
    needsHumanReview,
    results: allResults,
  };
}
