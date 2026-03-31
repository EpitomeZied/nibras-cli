function normalizeText(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function assertNonEmptyString(value, message) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
}

function validateCriterionScore(entry, rubricItem, questionId) {
  if (!entry || typeof entry !== "object") {
    throw new Error(`AI response criterion score must be an object for ${questionId}.`);
  }
  if (entry.id !== rubricItem.id) {
    throw new Error(`AI response criterion id mismatch for ${questionId}: expected "${rubricItem.id}".`);
  }
  const points = Number(entry.points);
  const earned = Number(entry.earned);
  if (!Number.isFinite(points) || Math.abs(points - Number(rubricItem.points)) > 1e-9) {
    throw new Error(`AI response criterion points mismatch for ${questionId}/${rubricItem.id}.`);
  }
  if (!Number.isFinite(earned) || earned < 0 || earned - points > 1e-9) {
    throw new Error(`AI response criterion earned is invalid for ${questionId}/${rubricItem.id}.`);
  }
  assertNonEmptyString(
    entry.justification,
    `AI response criterion justification is required for ${questionId}/${rubricItem.id}.`
  );
  return {
    id: rubricItem.id,
    points,
    earned,
    justification: entry.justification.trim()
  };
}

function validateEvidenceQuotes(evidenceQuotes, answerText, questionId) {
  if (!Array.isArray(evidenceQuotes)) {
    throw new Error(`AI response evidenceQuotes must be an array for ${questionId}.`);
  }
  const normalizedAnswer = normalizeText(answerText);
  return evidenceQuotes.map((quote, index) => {
    assertNonEmptyString(quote, `AI response evidence quote ${index} is invalid for ${questionId}.`);
    const normalizedQuote = normalizeText(quote);
    if (!normalizedAnswer.includes(normalizedQuote)) {
      throw new Error(`AI response evidence quote ${index} was not found in the answer for ${questionId}.`);
    }
    return quote.trim();
  });
}

function validateAiGradeResponse(raw, question, answerText) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`AI response must be an object for ${question.id}.`);
  }

  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`AI response confidence is invalid for ${question.id}.`);
  }

  if (typeof raw.needsReview !== "boolean") {
    throw new Error(`AI response needsReview must be a boolean for ${question.id}.`);
  }

  assertNonEmptyString(raw.reasoningSummary, `AI response reasoningSummary is required for ${question.id}.`);

  if (!Array.isArray(raw.criterionScores) || raw.criterionScores.length !== question.rubric.length) {
    throw new Error(`AI response criterionScores are incomplete for ${question.id}.`);
  }

  const byId = new Map(raw.criterionScores.map((entry) => [entry && entry.id, entry]));
  const criterionScores = question.rubric.map((rubricItem) => {
    const entry = byId.get(rubricItem.id);
    return validateCriterionScore(entry, rubricItem, question.id);
  });

  const score = Number(raw.score);
  if (!Number.isFinite(score) || score < 0 || score - Number(question.points) > 1e-9) {
    throw new Error(`AI response score is invalid for ${question.id}.`);
  }

  const computedScore = criterionScores.reduce((sum, entry) => sum + entry.earned, 0);
  if (Math.abs(computedScore - score) > 1e-9) {
    throw new Error(`AI response score does not match criterion totals for ${question.id}.`);
  }

  const evidenceQuotes = validateEvidenceQuotes(raw.evidenceQuotes, answerText, question.id);

  return {
    score: computedScore,
    confidence,
    needsReview: raw.needsReview,
    criterionScores,
    reasoningSummary: raw.reasoningSummary.trim(),
    evidenceQuotes
  };
}

function buildSystemPrompt() {
  return [
    "You are a grading assistant for written answers.",
    "Grade only from the rubric and the student's answer.",
    "Do not invent facts or assume unstated intent.",
    "Score each rubric criterion independently.",
    "Return strict JSON only.",
    "Set needsReview=true if the answer is ambiguous, contradictory, off-rubric, or unclear.",
    "Each evidence quote must be copied from the student's answer."
  ].join(" ");
}

function buildUserPrompt({ subject, project, question, answerText }) {
  const rubric = question.rubric
    .map((item) => `- ${item.id} (${item.points} pts): ${item.description}`)
    .join("\n");
  const examples = Array.isArray(question.examples) && question.examples.length > 0
    ? question.examples
        .map((example) => `- ${example.label}: ${example.answer}`)
        .join("\n")
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

function buildJsonSchema(question) {
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
        evidenceQuotes: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["score", "confidence", "needsReview", "criterionScores", "reasoningSummary", "evidenceQuotes"]
    }
  };
}

function resolveBaseUrl(aiConfig) {
  const baseUrl = aiConfig.baseUrl || "https://api.openai.com/v1";
  return baseUrl.replace(/\/$/, "");
}

async function callOpenAiCompatibleApi({ aiConfig, subject, project, question, answerText, timeoutMs }) {
  if (!aiConfig.apiKey) {
    throw new Error("NIBRAS_AI_API_KEY is required for semantic grading.");
  }
  if (!aiConfig.model) {
    throw new Error("AI model is required for semantic grading. Set it in config, env, or --ai-model.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${resolveBaseUrl(aiConfig)}/chat/completions`, {
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
          {
            role: "user",
            content: buildUserPrompt({ subject, project, question, answerText })
          }
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
      const detail = body ? ` ${body}` : "";
      const error = new Error(`AI provider request failed (${response.status}).${detail}`.trim());
      error.status = response.status;
      error.retryable = response.status === 429 || response.status >= 500;
      throw error;
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error(`AI provider returned an empty response for ${question.id}.`);
    }
    return JSON.parse(content);
  } catch (err) {
    if (err && err.name === "AbortError") {
      const timeoutError = new Error(`AI provider request timed out after ${timeoutMs}ms.`);
      timeoutError.retryable = true;
      throw timeoutError;
    }
    if (err && err.status === undefined) {
      err.retryable = Boolean(err.retryable);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function gradeSemanticAnswer({ aiConfig, subject, project, question, answerText }) {
  const provider = aiConfig.provider || "openai";
  if (provider !== "openai") {
    throw new Error(`Unsupported AI provider "${provider}".`);
  }

  const timeoutMs = Number.isFinite(Number(aiConfig.timeoutMs)) ? Number(aiConfig.timeoutMs) : 30000;
  const maxRetries = Number.isFinite(Number(aiConfig.maxRetries)) ? Number(aiConfig.maxRetries) : 2;

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const raw = await callOpenAiCompatibleApi({
        aiConfig,
        subject,
        project,
        question,
        answerText,
        timeoutMs
      });
      return validateAiGradeResponse(raw, question, answerText);
    } catch (err) {
      lastError = err;
      const retryable = Boolean(err && err.retryable);
      if (!retryable || attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error(`AI grading failed for ${question.id}.`);
}

module.exports = {
  gradeSemanticAnswer,
  validateAiGradeResponse
};
