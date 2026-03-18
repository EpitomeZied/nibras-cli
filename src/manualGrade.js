const fs = require("fs");
const path = require("path");
const { resolveProjectPath } = require("./gradingPaths");

function readJsonIfExists(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

function sumScores(scores) {
  let earned = 0;
  let total = 0;
  for (const score of scores) {
    const earnedValue = Number(score.earned);
    const totalValue = Number(score.points);
    if (Number.isFinite(earnedValue)) earned += earnedValue;
    if (Number.isFinite(totalValue)) total += totalValue;
  }
  return { earned, total };
}

function validateScoresArray(scores, scoresPath) {
  if (!Array.isArray(scores)) return;
  scores.forEach((score, index) => {
    const earnedValue = Number(score.earned);
    const totalValue = Number(score.points);
    if (!Number.isFinite(totalValue) || totalValue < 0) {
      throw new Error(`scores[${index}].points must be a non-negative number (${scoresPath}).`);
    }
    if (!Number.isFinite(earnedValue) || earnedValue < 0) {
      throw new Error(`scores[${index}].earned must be a non-negative number (${scoresPath}).`);
    }
    if (earnedValue > totalValue) {
      throw new Error(`scores[${index}].earned exceeds points (${scoresPath}).`);
    }
  });
}

function validateTotals(earnedPoints, totalPoints, scoresPath) {
  if (!Number.isFinite(earnedPoints) || earnedPoints < 0) {
    throw new Error(`earnedPoints must be a non-negative number (${scoresPath}).`);
  }
  if (!Number.isFinite(totalPoints) || totalPoints <= 0) {
    throw new Error(`totalPoints must be a positive number (${scoresPath}).`);
  }
  if (earnedPoints > totalPoints) {
    throw new Error(`earnedPoints exceeds totalPoints (${scoresPath}).`);
  }
}

function resolveManualScore({
  cwd,
  project,
  projectConfig,
  earnedOverride,
  totalOverride,
  scoresPathOverride
}) {
  const projectPath = resolveProjectPath(cwd, projectConfig.path || project);
  const scoresPath = scoresPathOverride
    ? path.isAbsolute(scoresPathOverride)
      ? scoresPathOverride
      : path.join(cwd, scoresPathOverride)
    : path.join(projectPath, projectConfig.scoresFile || "scores.json");
  const scoresExists = fs.existsSync(scoresPath);
  const scoresData = scoresExists ? readJsonIfExists(scoresPath) : null;

  if (!scoresExists && !Number.isFinite(Number(earnedOverride)) && !Number.isFinite(Number(totalOverride))) {
    throw new Error(`scores.json not found at ${scoresPath}. Provide --earned/--total or create the file.`);
  }

  if (scoresData && scoresData.scores) {
    validateScoresArray(scoresData.scores, scoresPath);
  }

  let earnedPoints = Number(earnedOverride);
  if (!Number.isFinite(earnedPoints)) {
    if (scoresData && Number.isFinite(scoresData.earnedPoints)) {
      earnedPoints = Number(scoresData.earnedPoints);
    } else if (scoresData && Array.isArray(scoresData.scores)) {
      earnedPoints = sumScores(scoresData.scores).earned;
    }
  }

  let totalPoints = Number(totalOverride);
  if (!Number.isFinite(totalPoints)) {
    if (Number.isFinite(projectConfig.totalPoints)) {
      totalPoints = Number(projectConfig.totalPoints);
    } else if (scoresData && Number.isFinite(scoresData.totalPoints)) {
      totalPoints = Number(scoresData.totalPoints);
    } else if (scoresData && Array.isArray(scoresData.scores)) {
      totalPoints = sumScores(scoresData.scores).total;
    }
  }

  if (!Number.isFinite(earnedPoints)) {
    throw new Error("earnedPoints not found. Provide --earned or set it in scores.json.");
  }
  if (!Number.isFinite(totalPoints) || totalPoints <= 0) {
    throw new Error("totalPoints not found. Provide --total or set it in config or scores.json.");
  }

  validateTotals(earnedPoints, totalPoints, scoresPath);

  return { earnedPoints, totalPoints, projectPath, scoresPath };
}

function computePercentage(earnedPoints, totalPoints) {
  return Math.round((earnedPoints / totalPoints) * 100);
}

module.exports = { resolveManualScore, computePercentage };
