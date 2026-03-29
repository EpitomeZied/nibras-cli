// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Validation helpers ────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return String(text).replace(/\s+/g, " ").trim();
}

function assertNonEmptyString(value: unknown, message: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
}

function validateCriterionScore(
  entry: unknown,
  rubricItem: GradingRubricItem,
  questionId: string
): CriterionScore {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`AI response criterion score must be an object for ${questionId}.`);
  }
  const e = entry as Record<string, unknown>;
  if (e["id"] !== rubricItem.id) {
    throw new Error(`AI criterion id mismatch for ${questionId}: expected "${rubricItem.id}".`);
  }
  const points = Number(e["points"]);
  const earned = Number(e["earned"]);
  if (!Number.isFinite(points) || Math.abs(points - rubricItem.points) > 1e-9) {
    throw new Error(`AI criterion points mismatch for ${questionId}/${rubricItem.id}.`);
  }
  if (!Number.isFinite(earned) || earned < 0 || earned - points > 1e-9) {
    throw new Error(`AI criterion earned is invalid for ${questionId}/${rubricItem.id}.`);
  }
  assertNonEmptyString(e["justification"], `AI criterion justification required for ${questionId}/${rubricItem.id}.`);
  return {
    id: rubricItem.id,
    points,
    earned,
    justification: String(e["justification"]).trim()
  };
}

function validateEvidenceQuotes(
  evidenceQuotes: unknown,
  answerText: string,
  questionId: string
): string[] {
  if (!Array.isArray(evidenceQuotes)) {
    throw new Error(`AI response evidenceQuotes must be an array for ${questionId}.`);
  }
  const normalizedAnswer = normalizeText(answerText);
  return evidenceQuotes.map((quote, index) => {
    assertNonEmptyString(quote, `AI evidence quote ${index} is invalid for ${questionId}.`);
    const normalizedQuote = normalizeText(String(quote));
    if (!normalizedAnswer.includes(normalizedQuote)) {
      throw new Error(`AI evidence quote ${index} not found in answer for ${questionId}.`);
    }
    return String(quote).trim();
  });
}

function validateAiGradeResponse(
  raw: unknown,
  question: GradingQuestion,
  answerText: string
): AiGradeResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`AI response must be an object for ${question.id}.`);
  }
  const r = raw as Record<string, unknown>;

  const confidence = Number(r["confidence"]);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`AI response confidence is invalid for ${question.id}.`);
  }
  if (typeof r["needsReview"] !== "boolean") {
    throw new Error(`AI response needsReview must be a boolean for ${question.id}.`);
  }
  assertNonEmptyString(r["reasoningSummary"], `AI response reasoningSummary required for ${question.id}.`);

  if (!Array.isArray(r["criterionScores"]) || r["criterionScores"].length !== question.rubric.length) {
    throw new Error(`AI response criterionScores are incomplete for ${question.id}.`);
  }

  const byId = new Map<string, unknown>(
    (r["criterionScores"] as unknown[]).map((entry) => {
      const e = entry as Record<string, unknown>;
      return [String(e["id"]), entry];
    })
  );

  const criterionScores = question.rubric.map((rubricItem) => {
    const entry = byId.get(rubricItem.id);
    return validateCriterionScore(entry, rubricItem, question.id);
  });

  const score = Number(r["score"]);
  if (!Number.isFinite(score) || score < 0 || score - question.points > 1e-9) {
    throw new Error(`AI response score is invalid for ${question.id}.`);
  }

  const computedScore = criterionScores.reduce((sum, entry) => sum + entry.earned, 0);
  if (Math.abs(computedScore - score) > 1e-9) {
    throw new Error(`AI response score does not match criterion totals for ${question.id}.`);
  }

  const evidenceQuotes = validateEvidenceQuotes(r["evidenceQuotes"], answerText, question.id);

  return {
    score: computedScore,
    confidence,
    needsReview: r["needsReview"] as boolean,
    criterionScores,
    reasoningSummary: String(r["reasoningSummary"]).trim(),
    evidenceQuotes
  };
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return [
    "You are a grading assistant for written answers.",
    "Grade only from the rubric and the student's answer.",
    "Do not invent facts or assume unstated intent.",
    "Score each rubric criterion independently.",
    "Return strict JSON only.",
    "Set needsReview=true if the answer is ambiguous, contradictory, off-rubric, or unclear.",
    "Each evidence quote must be copied verbatim from the student's answer."
  ].join(" ");
}

function buildUserPrompt(params: {
  subject: string;
  project: string;
  question: GradingQuestion;
  answerText: string;
}): string {
  const { subject, project, question, answerText } = params;
  const rubric = question.rubric
    .map((item) => `- ${item.id} (${item.points} pts): ${item.description}`)
    .join("\n");
  const examples =
    Array.isArray(question.examples) && question.examples.length > 0
      ? question.examples.map((ex) => `- ${ex.label}: ${ex.answer}`).join("\n")
      : "None";

  return [
    `Subject: ${subject}`,
    `Project: ${project}`,
    `Question ID: ${question.id}`,
    `Question prompt: ${question.prompt}`,
    `Question max points: ${question.points}`,
    "Rubric:",
    rubric,
    "Examples:",
    examples,
    "Student answer:",
    answerText
  ].join("\n");
}

function buildJsonSchema(question: GradingQuestion): object {
  return {
    name: "semantic_grade",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "number" },
        confidence: { type: "number" },
        needsReview: { type: "boolean" },
        criterionScores: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              points: { type: "number" },
              earned: { type: "number" },
              justification: { type: "string" }
            },
            required: ["id", "points", "earned", "justification"]
          }
        },
        reasoningSummary: { type: "string" },
        evidenceQuotes: { type: "array", items: { type: "string" } }
      },
      required: ["score", "confidence", "needsReview", "criterionScores", "reasoningSummary", "evidenceQuotes"]
    }
  };
  // suppress unused-variable warning for question
  void question;
}

// ── API call ──────────────────────────────────────────────────────────────────

type RetryableError = Error & { status?: number; retryable?: boolean };

async function callOpenAiCompatibleApi(params: {
  aiConfig: AiConfig;
  subject: string;
  project: string;
  question: GradingQuestion;
  answerText: string;
  timeoutMs: number;
}): Promise<unknown> {
  const { aiConfig, subject, project, question, answerText, timeoutMs } = params;

  if (!aiConfig.apiKey) {
    throw new Error("NIBRAS_AI_API_KEY is required for semantic grading.");
  }
  if (!aiConfig.model) {
    throw new Error("NIBRAS_AI_MODEL is required for semantic grading.");
  }

  const baseUrl = (aiConfig.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: aiConfig.model,
        temperature: 0,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt({ subject, project, question, answerText }) }
        ],
        response_format: {
          type: "json_schema",
          json_schema: buildJsonSchema(question)
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      const err = new Error(`AI provider request failed (${response.status}).${body ? ` ${body}` : ""}`.trim()) as RetryableError;
      err.status = response.status;
      err.retryable = response.status === 429 || response.status >= 500;
      throw err;
    }

    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error(`AI provider returned an empty response for ${question.id}.`);
    }
    return JSON.parse(content) as unknown;
  } catch (err) {
    const e = err as RetryableError;
    if (e.name === "AbortError") {
      const timeoutErr = new Error(`AI provider request timed out after ${timeoutMs}ms.`) as RetryableError;
      timeoutErr.retryable = true;
      throw timeoutErr;
    }
    if (e.status === undefined) {
      e.retryable = Boolean(e.retryable);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function gradeSemanticAnswer(params: {
  aiConfig: AiConfig;
  subject: string;
  project: string;
  question: GradingQuestion;
  answerText: string;
}): Promise<AiGradeResult> {
  const { aiConfig, subject, project, question, answerText } = params;

  const timeoutMs = Number.isFinite(Number(aiConfig.timeoutMs)) ? Number(aiConfig.timeoutMs) : 30_000;
  const maxRetries = Number.isFinite(Number(aiConfig.maxRetries)) ? Number(aiConfig.maxRetries) : 2;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw = await callOpenAiCompatibleApi({ aiConfig, subject, project, question, answerText, timeoutMs });
      return validateAiGradeResponse(raw, question, answerText);
    } catch (err) {
      lastError = err;
      const retryable = Boolean((err as RetryableError).retryable);
      if (!retryable || attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error(`AI grading failed for ${question.id}.`);
}

export { validateAiGradeResponse };
