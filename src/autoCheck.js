const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stripPunctuation(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseSolutions(rawSolutions) {
  if (rawSolutions.length === 0) return [];
  if (Array.isArray(rawSolutions[0])) {
    return rawSolutions.map((variant) => ensureArray(variant));
  }
  return [ensureArray(rawSolutions)];
}

function matchItem(answer, solution) {
  const normalizedAnswer = normalizeText(answer);
  const normalizedSolution = normalizeText(solution);
  if (!normalizedSolution) return false;
  if (normalizedAnswer.includes(normalizedSolution)) return true;

  const strippedAnswer = stripPunctuation(answer);
  const strippedSolution = stripPunctuation(solution);
  if (!strippedSolution) return false;
  return strippedAnswer.includes(strippedSolution);
}

function scoreVariant(answer, solutionItems) {
  if (solutionItems.length === 0) return { matched: 0, total: 0 };
  let matched = 0;
  for (const item of solutionItems) {
    if (matchItem(answer, item)) matched += 1;
  }
  return { matched, total: solutionItems.length };
}

function validateGradingSchema(grading, gradingPath) {
  if (!grading || typeof grading !== "object") {
    throw new Error(`Invalid grading.json format (${gradingPath}).`);
  }
  if (!Array.isArray(grading.questions) || grading.questions.length === 0) {
    throw new Error(`grading.json must include a non-empty questions array (${gradingPath}).`);
  }
  grading.questions.forEach((question) => {
    if (!question.id || typeof question.id !== "string") {
      throw new Error(`Each question must have an id (${gradingPath}).`);
    }
    if (!Number.isFinite(Number(question.points)) || Number(question.points) <= 0) {
      throw new Error(`Question ${question.id} must have positive points (${gradingPath}).`);
    }
    if (!question.answerFile || typeof question.answerFile !== "string") {
      throw new Error(`Question ${question.id} must have answerFile (${gradingPath}).`);
    }
    if (!Array.isArray(question.solutions) || question.solutions.length === 0) {
      throw new Error(`Question ${question.id} must have solutions array (${gradingPath}).`);
    }
  });
}

function autoCheck({ cwd, projectPath, gradingFile }) {
  const gradingPath = path.isAbsolute(gradingFile)
    ? gradingFile
    : path.join(cwd, projectPath, gradingFile);

  if (!fs.existsSync(gradingPath)) {
    return { used: false };
  }

  const grading = readJson(gradingPath);
  validateGradingSchema(grading, gradingPath);

  const results = [];
  let earnedPoints = 0;
  let totalPoints = 0;

  grading.questions.forEach((question) => {
    const answerPath = path.join(cwd, projectPath, question.answerFile);
    const points = Number(question.points);
    totalPoints += points;

    if (!fs.existsSync(answerPath)) {
      results.push({
        id: question.id,
        points,
        earned: 0,
        matched: 0,
        totalItems: question.solutions.length,
        missing: true,
        answerPath
      });
      return;
    }

    const answerText = fs.readFileSync(answerPath, "utf8");
    const variants = parseSolutions(question.solutions);
    let best = { matched: 0, total: 0 };

    variants.forEach((variant) => {
      const score = scoreVariant(answerText, variant);
      if (score.total === 0) return;
      const bestRatio = best.total === 0 ? 0 : best.matched / best.total;
      const ratio = score.matched / score.total;
      if (ratio > bestRatio) best = score;
    });

    const ratio = best.total === 0 ? 0 : best.matched / best.total;
    const earned = Number((points * ratio).toFixed(2));
    earnedPoints += earned;

    results.push({
      id: question.id,
      points,
      earned,
      matched: best.matched,
      totalItems: best.total,
      missing: false,
      answerPath
    });
  });

  const configuredTotal = Number(grading.totalPoints);
  if (Number.isFinite(configuredTotal) && configuredTotal > 0) {
    totalPoints = configuredTotal;
  }

  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  return { used: true, gradingPath, earnedPoints, totalPoints, percentage, results };
}

module.exports = { autoCheck };
