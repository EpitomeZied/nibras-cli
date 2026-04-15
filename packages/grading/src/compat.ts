// ============================================================
// Backwards Compatibility Layer
// Provides the old semantic grading API for @nibras/worker
// ============================================================

import { chatCompletion } from './client';

// ────────────────────────────────────────────────────────────
// Old API Types (for backwards compatibility)
// ────────────────────────────────────────────────────────────

export type AiConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  minConfidence?: number;
};

export type GradingRubricItem = {
  id: string;
  description: string;
  points: number;
};

export type GradingExample = {
  label: string;
  answer: string;
};

export type GradingQuestion = {
  id: string;
  prompt: string;
  points: number;
  rubric: GradingRubricItem[];
  examples?: GradingExample[];
  minConfidence?: number;
};

export type CriterionScore = {
  id: string;
  points: number;
  earned: number;
  justification: string;
};

export type AiGradeResult = {
  score: number;
  confidence: number;
  needsReview: boolean;
  criterionScores: CriterionScore[];
  reasoningSummary: string;
  evidenceQuotes: string[];
};

// ────────────────────────────────────────────────────────────
// Old API Implementation (using new grading infrastructure)
// ────────────────────────────────────────────────────────────

interface SemanticGradeResponse {
  criterionScores: Array<{
    id: string;
    points: number;
    earned: number;
    justification: string;
  }>;
  reasoningSummary: string;
  evidenceQuotes: string[];
  confidence: number;
  needsReview: boolean;
}

/**
 * Grade a semantic/long-answer question using AI
 * This is the legacy API used by @nibras/worker
 */
export async function gradeSemanticAnswer(input: {
  aiConfig: AiConfig;
  subject: string;
  project: string;
  question: GradingQuestion;
  answerText: string;
}): Promise<AiGradeResult> {
  const { aiConfig, subject, project, question, answerText } = input;

  // Build rubric description
  const rubricDescription = question.rubric
    .map((r) => `- [${r.points} pts] ${r.description}`)
    .join('\n');

  const examplesText =
    question.examples && question.examples.length > 0
      ? `\n\nExample Answers:\n${question.examples.map((e) => `- "${e.label}": ${e.answer}`).join('\n')}`
      : '';

  const systemPrompt = `You are an expert academic grader specializing in ${subject}.
Your task is to grade student answers against a rubric and model answer.

You must:
1. Evaluate the student answer against each rubric criterion
2. Award points for each criterion based on how well the student addressed it
3. Be fair but rigorous - partial credit is OK but not inflated
4. Provide clear justifications for each criterion score
5. Extract direct quotes from the answer that support your grading
6. Assess your confidence in the grade (0-1)
7. Flag if human review is recommended (confidence < 0.7 or edge cases)

IMPORTANT: Return ONLY valid JSON matching the schema below, no other text.`;

  const userPrompt = `Grade this answer:

**Question:** ${question.prompt}
**Max Points:** ${question.points}

**Rubric (score each):**
${rubricDescription}
${examplesText}

**Student Answer:**
${answerText}

Respond with ONLY this JSON (no markdown, no explanation):
{
  "criterionScores": [
    {
      "id": "string (rubric item id)",
      "points": number (max points for this criterion),
      "earned": number (points awarded, 0 to points),
      "justification": "string (1-2 sentences explaining the score)"
    }
  ],
  "reasoningSummary": "string (2-3 sentence overall summary of the grade)",
  "evidenceQuotes": ["string (exact quotes from answer supporting the grade)"],
  "confidence": number (0-1, how confident you are),
  "needsReview": boolean (true if uncertain or edge case)
}`;

  const response = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      baseURL: aiConfig.baseUrl,
      minConfidence: aiConfig.minConfidence,
    },
    true // jsonMode
  );

  const parsed = response.rawJson as SemanticGradeResponse;

  // Compute total score
  const totalEarned = parsed.criterionScores.reduce((sum, c) => sum + c.earned, 0);

  return {
    score: totalEarned,
    confidence: parsed.confidence,
    needsReview: parsed.needsReview || parsed.confidence < (aiConfig.minConfidence ?? 0.7),
    criterionScores: parsed.criterionScores,
    reasoningSummary: parsed.reasoningSummary,
    evidenceQuotes: parsed.evidenceQuotes || [],
  };
}
