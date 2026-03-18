const { Command } = require("commander");
const pkg = require("../package.json");
const { loadConfig } = require("./config");
const { runCheck50, parseCheck50Json, summarizeChecks, computePercentage } = require("./check50");
const { submit } = require("./submit");
const { loadTask } = require("./task");
const { pingRemote } = require("./ping");
const { updateBuildpack } = require("./updateBuildpack");
const { resolveManualScore, computePercentage: computeManualPercentage } = require("./manualGrade");
const { autoCheck } = require("./autoCheck");
const { setupProject } = require("./setup");
const { writeReviewOutput } = require("./reviewOutput");
const {
  resolveNearestDefined,
  resolveProjectPath,
  resolveRelativeToProjectOrAbsolute,
  resolveRelativeToCwdOrAbsolute
} = require("./gradingPaths");
const path = require("path");

function printUsage() {
  // eslint-disable-next-line no-console
  console.log(`

███╗   ██╗██╗██████╗ ██████╗  █████╗ ███████╗
████╗  ██║██║██╔══██╗██╔══██╗██╔══██╗██╔════╝
██╔██╗ ██║██║██████╔╝██████╔╝███████║███████╗
██║╚██╗██║██║██╔══██╗██╔══██╗██╔══██║╚════██║
██║ ╚████║██║██████╔╝██║  ██║██║  ██║███████║
╚═╝  ╚═══╝╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝

nibras <subject> <command> <project> [options]

Commands
  test              Run checks or grading
  submit            Commit changes & submit
  task              View current stage instructions
  setup             Download and unzip project materials

Global commands
  ping              Test the connection to a submission remote
  update-buildpack  Update language version

Example
  nibras cs161 test exam1
  nibras cs161 test exam1 --earned 60
  nibras cs161 submit exam1
  nibras cs161 setup exam1
`);
}

function resolveProject(config, subject, project) {
  const subjectConfig = config.subjects?.[subject];
  if (!subjectConfig) {
    throw new Error(`Unknown subject "${subject}". Configure it in .nibras.json.`);
  }
  const projectConfig = subjectConfig.projects?.[project];
  if (!projectConfig) {
    throw new Error(`Unknown project "${project}" for subject "${subject}". Configure it in .nibras.json.`);
  }
  return { subjectConfig, projectConfig };
}

function resolveSlug(optsSlug, config, projectConfig) {
  return optsSlug || projectConfig.slug || projectConfig.check50Slug || config.slug || "";
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function runTest(argv, subject, project, config) {
  const cmd = new Command();
  cmd
    .option("--previous", "Run tests for all previous stages and the current stage")
    .option("--min-score <number>", "Minimum percentage required", "100")
    .option("--slug <slug>", "Problem slug (org/repo/branch/path)")
    .option("--local", "Run checks locally (default true)")
    .option("--earned <number>", "Earned points for check grading")
    .option("--total <number>", "Total points for check grading")
    .option("--scores <path>", "Scores JSON file for check grading")
    .option("--grading <path>", "grading.json file for auto-checking")
    .option("--grading-root <path>", "Root directory for private grading files")
    .option("--answers-dir <path>", "Directory that contains answer files")
    .option("--ai-model <model>", "AI model override for semantic grading")
    .option("--review-file <path>", "Write semantic grading review output to a JSON file")
    .option("--fail-on-review", "Exit non-zero if any semantic question requires review")
    .option("--no-ai", "Disable AI semantic grading");
  cmd.parse(["node", "nibras", ...argv], { from: "user" });
  const opts = cmd.opts();

  const { subjectConfig, projectConfig } = resolveProject(config, subject, project);
  const projectType = projectConfig.type || (projectConfig.check50Slug ? "check50" : "check");

  if (projectType === "check50") {
    const slug = resolveSlug(opts.slug, config, projectConfig);
    if (!slug) throw new Error("slug is required. Set it in .nibras.json or NIBRAS_SLUG.");

    const localChecks =
      typeof opts.local === "boolean" ? opts.local : projectConfig.localChecks ?? config.localChecks;

    return runCheck50({ slug, localChecks, previous: opts.previous }).then((result) => {
      if (!result.stdout.trim()) {
        throw new Error(result.stderr || "check50 did not return JSON output.");
      }

      const checks = parseCheck50Json(result.stdout);
      const summary = summarizeChecks(checks);
      const score = computePercentage(summary);
      const minScore = toNumber(opts.minScore, 100);

      // eslint-disable-next-line no-console
      console.log(`Checks: pass ${summary.pass}, fail ${summary.fail}, skip ${summary.skip}`);
      // eslint-disable-next-line no-console
      console.log(`Score: ${score}% (min ${minScore}%)`);

      if (result.code !== 0 || score < minScore) {
        process.exitCode = 1;
      }
    });
  }

  if (projectType !== "check") {
    throw new Error(`Unsupported project type "${projectType}". Use "check" or "check50".`);
  }

  const cwd = process.cwd();
  const projectPath = projectConfig.path || project;
  const resolvedProjectPath = resolveProjectPath(cwd, projectPath);
  const gradingFile = opts.grading || projectConfig.gradingFile || "grading.json";
  const gradingRoot =
    opts.gradingRoot ||
    projectConfig.gradingRoot ||
    (config.subjects?.[subject] && config.subjects[subject].gradingRoot) ||
    config.gradingRoot;
  const strictGrading = Boolean(
    opts.grading ||
      resolveNearestDefined(
        projectConfig.requireGrading,
        subjectConfig.requireGrading,
        config.requireGrading,
        false
      )
  );

  let gradingPath = gradingFile;
  if (path.isAbsolute(gradingFile)) {
    gradingPath = gradingFile;
  } else if (gradingRoot) {
    const root = resolveRelativeToCwdOrAbsolute(cwd, gradingRoot);
    gradingPath = path.join(root, subject, project, gradingFile);
  } else {
    gradingPath = resolveRelativeToProjectOrAbsolute(cwd, projectPath, gradingFile);
  }
  const aiConfig = {
    ...(config.ai || {}),
    model: opts.aiModel || (config.ai && config.ai.model) || ""
  };
  const auto = autoCheck({
    cwd,
    projectPath: resolvedProjectPath,
    gradingFile: gradingPath,
    answersDir: opts.answersDir || projectConfig.answersDir,
    requireGrading: strictGrading,
    aiConfig,
    aiEnabled: opts.ai !== false,
    subject,
    project
  });

  return Promise.resolve(auto).then((resolvedAuto) => {
    if (!resolvedAuto.used) {
      const { earnedPoints, totalPoints } = resolveManualScore({
        cwd,
        project,
        projectConfig,
        earnedOverride: opts.earned,
        totalOverride: opts.total,
        scoresPathOverride: opts.scores
      });
      const score = computeManualPercentage(earnedPoints, totalPoints);
      const minScore = toNumber(opts.minScore, 100);

      // eslint-disable-next-line no-console
      console.log(`Score: ${score}% (${earnedPoints}/${totalPoints})`);
      if (score < minScore) {
        process.exitCode = 1;
      }
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Auto-check: ${resolvedAuto.earnedPoints}/${resolvedAuto.totalPoints} (${resolvedAuto.percentage}%)`);
    resolvedAuto.results.forEach((result) => {
      if (result.mode === "semantic") {
        const reviewSuffix = result.needsReview ? " REVIEW" : "";
        // eslint-disable-next-line no-console
        console.log(`${result.id}: ${result.earned}/${result.points} AI(confidence ${result.confidence.toFixed(2)})${reviewSuffix}`);
        result.criterionScores.forEach((criterion) => {
          // eslint-disable-next-line no-console
          console.log(`  ${criterion.id}: ${criterion.earned}/${criterion.points}`);
        });
        return;
      }

      const status = result.matched ? "\x1b[32mPASS\x1b[0m" : "FAIL";
      // eslint-disable-next-line no-console
      console.log(`${result.id}: ${status} (${result.earned}/${result.points})`);
    });
    const minScore = toNumber(opts.minScore, 100);
    if (resolvedAuto.reviewRequired) {
      const reviewCount = resolvedAuto.results.filter((result) => result.needsReview).length;
      const suffix = reviewCount === 1 ? "" : "s";
      // eslint-disable-next-line no-console
      console.log(`Review: ${reviewCount} question${suffix} require instructor review`);
    }
    if (opts.reviewFile) {
      const reviewPath = writeReviewOutput({
        cwd: process.cwd(),
        filePath: opts.reviewFile,
        subject,
        project,
        summary: resolvedAuto
      });
      // eslint-disable-next-line no-console
      console.log(`Review file: ${reviewPath}`);
    }
    if (resolvedAuto.percentage < minScore) {
      process.exitCode = 1;
    }
    if (opts.failOnReview && resolvedAuto.reviewRequired) {
      process.exitCode = 1;
    }
  });
}

function runSubmit(argv, subject, project, config) {
  const cmd = new Command();
  cmd
    .option("--remote <url>", "Git remote for submissions")
    .option("--files <files...>", "Files to submit (defaults to .cs50.yaml or git tracked files)")
    .option("--ref <ref>", "Submission reference override");
  cmd.parse(["node", "nibras", ...argv], { from: "user" });
  const opts = cmd.opts();

  const { subjectConfig, projectConfig } = resolveProject(config, subject, project);
  const submitRemote = opts.remote || projectConfig.submitRemote || subjectConfig.submitRemote || config.submitRemote;
  const submissionRef =
    opts.ref || projectConfig.submitRef || projectConfig.slug || `${subject}/${project}`;

  return submit({
    cwd: process.cwd(),
    submissionRef,
    submitRemote,
    files: opts.files || projectConfig.files
  }).then((result) => {
    // eslint-disable-next-line no-console
    console.log(`Submitted ${result.files} file(s) to ${result.branch}`);
  });
}

function runTask(argv, subject, project, config) {
  const cmd = new Command();
  cmd.option("--file <path>", "Read instructions from a local file");
  cmd.parse(["node", "nibras", ...argv], { from: "user" });
  const opts = cmd.opts();

  const { subjectConfig, projectConfig } = resolveProject(config, subject, project);
  const slug = resolveSlug(undefined, config, projectConfig);
  const taskUrl = projectConfig.taskUrl || subjectConfig.taskUrl;
  return loadTask({
    cwd: process.cwd(),
    slug,
    taskUrlBase: projectConfig.taskUrlBase || subjectConfig.taskUrlBase || config.taskUrlBase,
    taskUrl,
    file: opts.file || projectConfig.taskFile || subjectConfig.taskFile
  }).then((text) => {
    // eslint-disable-next-line no-console
    console.log(text);
  });
}

function runSetup(argv, subject, project, config) {
  const cmd = new Command();
  cmd.option("--url <url>", "Override setup zip URL");
  cmd.option("--dir <path>", "Override destination directory");
  cmd.parse(["node", "nibras", ...argv], { from: "user" });
  const opts = cmd.opts();

  const { subjectConfig, projectConfig } = resolveProject(config, subject, project);
  const projectCfg = { ...projectConfig };
  if (opts.url) projectCfg.setupUrl = opts.url;
  if (opts.dir) projectCfg.setupDir = opts.dir;

  return setupProject({
    cwd: process.cwd(),
    subject,
    project,
    projectConfig: projectCfg,
    subjectConfig
  }).then((result) => {
    // eslint-disable-next-line no-console
    console.log(`Downloaded and extracted to ${result.destPath}`);
  });
}

async function run(argv) {
  const subject = argv[2];
  const command = argv[3];
  const project = argv[4];
  const rest = argv.slice(5);

  if (!subject || ["-h", "--help", "help"].includes(subject)) {
    printUsage();
    return;
  }
  if (["-v", "--version", "version"].includes(subject)) {
    // eslint-disable-next-line no-console
    console.log(pkg.version);
    return;
  }

  if (["ping", "update-buildpack"].includes(subject)) {
    const config = loadConfig(process.cwd());
    if (subject === "ping") {
      const cmd = new Command();
      cmd.option("--remote <url>", "Git remote for submissions");
      cmd.parse(["node", "nibras", ...argv.slice(3)], { from: "user" });
      const opts = cmd.opts();
      const output = await pingRemote(opts.remote || config.submitRemote);
      // eslint-disable-next-line no-console
      console.log(output || "OK");
      return;
    }
    const cmd = new Command();
    cmd.option("--node <version>", "Node version to pin", "18");
    cmd.parse(["node", "nibras", ...argv.slice(3)], { from: "user" });
    const opts = cmd.opts();
    const nodeVersion = updateBuildpack({ cwd: process.cwd(), nodeVersion: String(opts.node) });
    // eslint-disable-next-line no-console
    console.log(`Buildpack Node version set to ${nodeVersion}`);
    return;
  }

  if (!command || !project) {
    printUsage();
    return;
  }

  const config = loadConfig(process.cwd());
  if (command === "test") {
    await runTest(rest, subject, project, config);
    return;
  }
  if (command === "submit") {
    await runSubmit(rest, subject, project, config);
    return;
  }
  if (command === "task") {
    await runTask(rest, subject, project, config);
    return;
  }
  if (command === "setup") {
    await runSetup(rest, subject, project, config);
    return;
  }

  throw new Error(`Unknown command "${command}".`);
}

module.exports = { run };
