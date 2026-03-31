const { runCommand } = require("./exec");

function parseCheck50Json(raw) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("No JSON output from check50.");
  let parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.checks)) return parsed.checks;
  if (parsed && Array.isArray(parsed.results)) return parsed.results;
  throw new Error("Unexpected check50 JSON structure.");
}

function summarizeChecks(checks) {
  const summary = {
    pass: 0,
    fail: 0,
    skip: 0,
    total: 0
  };
  for (const check of checks) {
    const status = String(check.status || "").toLowerCase();
    if (status === "pass") summary.pass += 1;
    else if (status === "fail") summary.fail += 1;
    else if (status === "skip") summary.skip += 1;
  }
  summary.total = summary.pass + summary.fail + summary.skip;
  return summary;
}

function computePercentage(summary) {
  const graded = summary.pass + summary.fail;
  if (graded === 0) return 0;
  return Math.round((summary.pass / graded) * 100);
}

async function runCheck50({ slug, localChecks, previous }) {
  const args = [];
  if (localChecks) args.push("--local");
  args.push(slug, "-o", "json");
  const env = { ...process.env };
  if (previous) env.NIBRAS_PREVIOUS = "1";
  const result = await runCommand("check50", args, { env });
  return result;
}

module.exports = {
  parseCheck50Json,
  summarizeChecks,
  computePercentage,
  runCheck50
};
