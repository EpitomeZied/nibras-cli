const fs = require("fs");
const path = require("path");
const { gradeSemanticAnswer } = require("./aiGrade");
const { resolveProjectPath, resolveRelativeToProjectOrAbsolute } = require("./gradingPaths");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function normalizeText(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function normalizeQuestion(question) {
  return {
    ...question,
    mode: question.mode || "exact"
  };
}

function validateSemanticQuestion(question, gradingPath) {
  if (question.mode !== "semantic") return;
  if (!question.prompt || typeof question.prompt !== "string" || !question.prompt.trim()) {
    throw new Error(`Question ${question.id} must have a non-empty prompt (${gradingPath}).`);
  }
  if (!Array.isArray(question.rubric) || question.rubric.length === 0) {
    throw new Error(`Question ${question.id} must have a non-empty rubric (${gradingPath}).`);
  }

  const seenRubricIds = new Set();
  let rubricPoints = 0;
  question.rubric.forEach((criterion) => {
    if (!criterion.id || typeof criterion.id !== "string") {
      throw new Error(`Question ${question.id} rubric items must have an id (${gradingPath}).`);
    }
    if (seenRubricIds.has(criterion.id)) {
      throw new Error(`Duplicate rubric id "${criterion.id}" in question ${question.id} (${gradingPath}).`);
    }
    seenRubricIds.add(criterion.id);
    if (!criterion.description || typeof criterion.description !== "string" || !criterion.description.trim()) {
      throw new Error(`Question ${question.id} rubric ${criterion.id} must have a description (${gradingPath}).`);
    }
    if (!Number.isFinite(Number(criterion.points)) || Number(criterion.points) <= 0) {
      throw new Error(`Question ${question.id} rubric ${criterion.id} must have positive points (${gradingPath}).`);
    }
    rubricPoints += Number(criterion.points);
  });

  if (Math.abs(rubricPoints - Number(question.points)) > 1e-9) {
    throw new Error(
      `Question ${question.id} rubric points (${rubricPoints}) must equal question points (${question.points}) (${gradingPath}).`
    );
  }

  if (question.examples !== undefined) {
    if (!Array.isArray(question.examples)) {
      throw new Error(`Question ${question.id} examples must be an array (${gradingPath}).`);
    }
    question.examples.forEach((example, index) => {
      if (!example || typeof example !== "object") {
        throw new Error(`Question ${question.id} example ${index} must be an object (${gradingPath}).`);
      }
      if (!example.label || typeof example.label !== "string" || !example.label.trim()) {
        throw new Error(`Question ${question.id} example ${index} must have a label (${gradingPath}).`);
      }
      if (!example.answer || typeof example.answer !== "string" || !example.answer.trim()) {
        throw new Error(`Question ${question.id} example ${index} must have a non-empty answer (${gradingPath}).`);
      }
    });
  }

  if (question.minConfidence !== undefined) {
    const minConfidence = Number(question.minConfidence);
    if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
      throw new Error(`Question ${question.id} minConfidence must be between 0 and 1 (${gradingPath}).`);
    }
  }
}

function validateExactQuestion(question, gradingPath) {
  if (question.mode !== "exact") return;
  if (!Array.isArray(question.solutions) || question.solutions.length === 0) {
    throw new Error(`Question ${question.id} must have solutions array (${gradingPath}).`);
  }
  const hasSolution = question.solutions.some((solution) => typeof solution === "string" && solution.trim());
  if (!hasSolution) {
    throw new Error(`Question ${question.id} solutions must contain non-empty strings (${gradingPath}).`);
  }
}

function validateGradingSchema(grading, gradingPath) {
  if (!grading || typeof grading !== "object") {
    throw new Error(`Invalid grading.json format (${gradingPath}).`);
  }
  if (!Number.isFinite(Number(grading.totalPoints)) || Number(grading.totalPoints) <= 0) {
    throw new Error(`grading.json totalPoints must be a positive number (${gradingPath}).`);
  }
  if (!Array.isArray(grading.questions) || grading.questions.length === 0) {
    throw new Error(`grading.json must include a non-empty questions array (${gradingPath}).`);
  }

  const seenIds = new Set();
  let sumPoints = 0;
  const questions = grading.questions.map(normalizeQuestion);

  questions.forEach((question) => {
    if (!question.id || typeof question.id !== "string") {
      throw new Error(`Each question must have an id (${gradingPath}).`);
    }
    if (seenIds.has(question.id)) {
      throw new Error(`Duplicate question id "${question.id}" (${gradingPath}).`);
    }
    seenIds.add(question.id);
    if (!Number.isFinite(Number(question.points)) || Number(question.points) <= 0) {
      throw new Error(`Question ${question.id} must have positive points (${gradingPath}).`);
    }
    sumPoints += Number(question.points);
    if (!question.answerFile || typeof question.answerFile !== "string") {
      throw new Error(`Question ${question.id} must have answerFile (${gradingPath}).`);
    }
    if (!["exact", "semantic"].includes(question.mode)) {
      throw new Error(`Question ${question.id} has unsupported mode "${question.mode}" (${gradingPath}).`);
    }
    validateExactQuestion(question, gradingPath);
    validateSemanticQuestion(question, gradingPath);
  });

  const totalPoints = Number(grading.totalPoints);
  const delta = Math.abs(sumPoints - totalPoints);
  if (delta > 1e-9) {
    throw new Error(
      `Sum of question points (${sumPoints}) must equal totalPoints (${totalPoints}) (${gradingPath}).`
    );
  }

  return {
    ...grading,
    questions
  };
}

function resolveAnswerBase(cwd, projectPath, answersDir) {
  if (!answersDir) {
    return resolveProjectPath(cwd, projectPath);
  }
  return path.isAbsolute(answersDir) ? answersDir : path.join(cwd, answersDir);
}

function readAnswerFile(answerBase, question) {
  const answerPath = path.join(answerBase, question.answerFile);
  if (!fs.existsSync(answerPath)) {
    throw new Error(`Missing answer file for ${question.id} (${answerPath}).`);
  }

  const answerText = fs.readFileSync(answerPath, "utf8");
  if (!answerText.trim()) {
    throw new Error(`Answer file is empty for ${question.id} (${answerPath}).`);
  }

  return { answerPath, answerText };
}

function gradeExactQuestion(question, answerText, answerPath) {
  const normalizedAnswer = normalizeText(answerText);
  const matched = question.solutions.some((solution) => {
    if (typeof solution !== "string") return false;
    const normalizedSolution = normalizeText(solution);
    return normalizedSolution && normalizedSolution === normalizedAnswer;
  });

  const points = Number(question.points);
  return {
    id: question.id,
    mode: "exact",
    points,
    earned: matched ? points : 0,
    matched,
    needsReview: false,
    confidence: null,
    criterionScores: [],
    reasoningSummary: "",
    evidenceQuotes: [],
    answerPath
  };
}

async function gradeSemanticQuestion({
  question,
  answerText,
  answerPath,
  aiConfig,
  aiGrader,
  subject,
  project,
  aiEnabled
}) {
  if (!aiEnabled) {
    throw new Error(`Question ${question.id} requires AI grading, but AI is disabled (--no-ai).`);
  }

  const graded = await aiGrader({
    aiConfig,
    subject,
    project,
    question,
    answerText
  });

  const minConfidence = question.minConfidence !== undefined
    ? Number(question.minConfidence)
    : Number.isFinite(Number(aiConfig.minConfidence))
      ? Number(aiConfig.minConfidence)
      : 0.8;

  return {
    id: question.id,
    mode: "semantic",
    points: Number(question.points),
    earned: graded.score,
    matched: null,
    needsReview: graded.needsReview || graded.confidence < minConfidence,
    confidence: graded.confidence,
    criterionScores: graded.criterionScores,
    reasoningSummary: graded.reasoningSummary,
    evidenceQuotes: graded.evidenceQuotes,
    answerPath
  };
}

async function autoCheck({
  cwd,
  projectPath,
  gradingFile,
  answersDir,
  requireGrading,
  aiConfig = {},
  aiEnabled = true,
  aiGrader = gradeSemanticAnswer,
  subject = "",
  project = ""
}) {
  const gradingPath = resolveRelativeToProjectOrAbsolute(cwd, projectPath, gradingFile);

  if (!fs.existsSync(gradingPath)) {
    if (requireGrading) {
      throw new Error(`grading.json not found (${gradingPath}).`);
    }
    return { used: false };
  }

  const grading = validateGradingSchema(readJson(gradingPath), gradingPath);
  const answerBase = resolveAnswerBase(cwd, projectPath, answersDir);

  const results = [];
  let earnedPoints = 0;

  for (const question of grading.questions) {
    const { answerPath, answerText } = readAnswerFile(answerBase, question);
    const result = question.mode === "semantic"
      ? await gradeSemanticQuestion({
          question,
          answerText,
          answerPath,
          aiConfig,
          aiGrader,
          subject,
          project,
          aiEnabled
        })
      : gradeExactQuestion(question, answerText, answerPath);

    earnedPoints += result.earned;
    results.push(result);
  }

  const totalPoints = Number(grading.totalPoints);
  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const reviewRequired = results.some((result) => result.needsReview);

  return {
    used: true,
    gradingPath,
    earnedPoints,
    totalPoints,
    percentage,
    reviewRequired,
    results
  };
}

module.exports = { autoCheck };
