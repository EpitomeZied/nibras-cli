const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawnSync } = require("node:child_process");

const { validateAiGradeResponse } = require("../src/aiGrade");
const { autoCheck } = require("../src/autoCheck");
const { run } = require("../src/cli");
const { loadConfig } = require("../src/config");
const { resolveManualScore } = require("../src/manualGrade");
const { setupProject } = require("../src/setup");
const { submit } = require("../src/submit");
const { updateBuildpack } = require("../src/updateBuildpack");

const repoRoot = path.resolve(__dirname, "..");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "nibras-test-"));
}

function withEnv(overrides, fn) {
  const previous = {};
  const restore = () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.finally(restore);
    }
    restore();
    return result;
  } catch (err) {
    restore();
    throw err;
  }
}

async function captureLogs(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => {
    lines.push(args.join(" "));
  };

  try {
    await fn();
  } finally {
    console.log = original;
  }

  return lines;
}

async function withWorkingDirectory(cwd, fn) {
  const previousCwd = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(previousCwd);
  }
}

async function captureRunInDirectory(cwd, argv, envOverrides = null) {
  return withWorkingDirectory(cwd, () => {
    const execute = () => captureLogs(() => run(argv));
    return envOverrides ? withEnv(envOverrides, execute) : execute();
  });
}

async function withExitCodeReset(fn) {
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    return await fn();
  } finally {
    process.exitCode = previousExitCode;
  }
}

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8"
  });
  return result.status === 0;
}

function writeCheckConfig(dir, {
  topLevel = {},
  subject = {},
  project = {}
} = {}) {
  fs.writeFileSync(
    path.join(dir, ".nibras.json"),
    JSON.stringify({
      ...topLevel,
      subjects: {
        cs161: {
          ...subject,
          projects: {
            exam1: {
              type: "check",
              path: "student/exam1",
              ...project
            }
          }
        }
      }
    })
  );
}

function createSemanticQuestion(overrides = {}) {
  return {
    id: "q2",
    mode: "semantic",
    points: 30,
    answerFile: "q2.txt",
    prompt: "Explain why Dijkstra's algorithm fails with negative edges.",
    rubric: [
      {
        id: "reasoning",
        description: "Explains the finalized-distance issue.",
        points: 15
      },
      {
        id: "example",
        description: "Provides a correct example or equivalent reasoning.",
        points: 15
      }
    ],
    ...overrides
  };
}

async function startMockAiServer(handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", async () => {
      const body = raw ? JSON.parse(raw) : {};
      requests.push(body);
      try {
        const payload = await handler(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      } catch (err) {
        res.writeHead(err.statusCode || 500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    requests,
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  };
}

test("loadConfig keeps file values when env overrides are absent", () => {
  const dir = makeTempDir();
  fs.writeFileSync(
    path.join(dir, ".nibras.json"),
    JSON.stringify({
      slug: "org/repo",
      submitRemote: "git@example.com:course/submissions.git",
      taskUrlBase: "https://tasks.example.test",
      gradingRoot: "/tmp/grading",
      ai: {
        model: "file-model"
      }
    })
  );

  const config = withEnv(
    {
      NIBRAS_SLUG: undefined,
      NIBRAS_SUBMIT_REMOTE: undefined,
      NIBRAS_TASK_URL_BASE: undefined,
      NIBRAS_GRADING_ROOT: undefined,
      NIBRAS_AI_MODEL: undefined
    },
    () => loadConfig(dir)
  );

  assert.equal(config.slug, "org/repo");
  assert.equal(config.submitRemote, "git@example.com:course/submissions.git");
  assert.equal(config.taskUrlBase, "https://tasks.example.test");
  assert.equal(config.gradingRoot, "/tmp/grading");
  assert.equal(config.ai.model, "file-model");
});

test("loadConfig still lets explicit env vars override file config", () => {
  const dir = makeTempDir();
  fs.writeFileSync(
    path.join(dir, ".nibras.json"),
    JSON.stringify({
      slug: "file/slug",
      submitRemote: "git@example.com:file.git",
      ai: {
        model: "file-model",
        minConfidence: 0.8
      }
    })
  );

  const config = withEnv(
    {
      NIBRAS_SLUG: "env/slug",
      NIBRAS_SUBMIT_REMOTE: "git@example.com:env.git",
      NIBRAS_AI_MODEL: "env-model",
      NIBRAS_AI_MIN_CONFIDENCE: "0.9"
    },
    () => loadConfig(dir)
  );

  assert.equal(config.slug, "env/slug");
  assert.equal(config.submitRemote, "git@example.com:env.git");
  assert.equal(config.ai.model, "env-model");
  assert.equal(config.ai.minConfidence, 0.9);
});

test("updateBuildpack preserves unrelated config fields", () => {
  const dir = makeTempDir();
  const configPath = path.join(dir, ".nibras.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      submitRemote: "git@example.com:course/submissions.git",
      subjects: {
        cs161: {
          projects: {
            exam1: {
              type: "check"
            }
          }
        }
      }
    })
  );

  withEnv(
    {
      NIBRAS_SLUG: undefined,
      NIBRAS_SUBMIT_REMOTE: undefined,
      NIBRAS_TASK_URL_BASE: undefined,
      NIBRAS_GRADING_ROOT: undefined
    },
    () => updateBuildpack({ cwd: dir, nodeVersion: "20" })
  );

  const updated = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.equal(updated.buildpack.node, "20");
  assert.equal(updated.submitRemote, "git@example.com:course/submissions.git");
  assert.ok(updated.subjects.cs161.projects.exam1);
});

test("autoCheck normalizes whitespace and uses answersDir", async () => {
  const dir = makeTempDir();
  const projectDir = path.join(dir, "exam1");
  const answersDir = path.join(dir, "answers");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(answersDir, { recursive: true });

  fs.writeFileSync(
    path.join(projectDir, "grading.json"),
    JSON.stringify({
      totalPoints: 100,
      questions: [
        {
          id: "q1",
          points: 60,
          answerFile: "q1.txt",
          solutions: ["The quick brown fox"]
        },
        {
          id: "q2",
          points: 40,
          answerFile: "q2.txt",
          solutions: ["Answer B"]
        }
      ]
    })
  );
  fs.writeFileSync(path.join(answersDir, "q1.txt"), "The   quick\nbrown   fox\n");
  fs.writeFileSync(path.join(answersDir, "q2.txt"), "Wrong");

  const result = await autoCheck({
    cwd: dir,
    projectPath: "exam1",
    gradingFile: "grading.json",
    answersDir,
    requireGrading: true
  });

  assert.equal(result.used, true);
  assert.equal(result.earnedPoints, 60);
  assert.equal(result.totalPoints, 100);
  assert.equal(result.percentage, 60);
  assert.deepEqual(
    result.results.map((entry) => ({ id: entry.id, matched: entry.matched })),
    [
      { id: "q1", matched: true },
      { id: "q2", matched: false }
    ]
  );
});

test("autoCheck throws when grading is required but missing", async () => {
  const dir = makeTempDir();
  fs.mkdirSync(path.join(dir, "exam1"), { recursive: true });

  await assert.rejects(
    () =>
      autoCheck({
        cwd: dir,
        projectPath: "exam1",
        gradingFile: "grading.json",
        requireGrading: true
      }),
    /grading\.json not found/
  );
});

test("autoCheck grades semantic questions with a mocked grader", async () => {
  const dir = makeTempDir();
  const projectDir = path.join(dir, "exam1");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, "grading.json"),
    JSON.stringify({
      totalPoints: 50,
      questions: [
        {
          id: "q1",
          points: 20,
          answerFile: "q1.txt",
          solutions: ["42"]
        },
        createSemanticQuestion()
      ]
    })
  );
  fs.writeFileSync(path.join(projectDir, "q1.txt"), "42");
  fs.writeFileSync(
    path.join(projectDir, "q2.txt"),
    "Dijkstra can fail because a later negative edge can lower a distance that was already finalized."
  );

  const result = await autoCheck({
    cwd: dir,
    projectPath: "exam1",
    gradingFile: "grading.json",
    requireGrading: true,
    subject: "cs161",
    project: "exam1",
    aiConfig: {
      minConfidence: 0.8
    },
    aiGrader: async () => ({
      score: 24,
      confidence: 0.87,
      needsReview: false,
      criterionScores: [
        { id: "reasoning", points: 15, earned: 15, justification: "Good." },
        { id: "example", points: 15, earned: 9, justification: "Partial." }
      ],
      reasoningSummary: "Strong reasoning, partial example.",
      evidenceQuotes: [
        "later negative edge can lower a distance that was already finalized"
      ]
    })
  });

  assert.equal(result.earnedPoints, 44);
  assert.equal(result.reviewRequired, false);
  assert.deepEqual(
    result.results.map((entry) => ({ id: entry.id, mode: entry.mode, earned: entry.earned })),
    [
      { id: "q1", mode: "exact", earned: 20 },
      { id: "q2", mode: "semantic", earned: 24 }
    ]
  );
});

test("autoCheck marks low-confidence semantic answers for review", async () => {
  const dir = makeTempDir();
  const projectDir = path.join(dir, "exam1");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, "grading.json"),
    JSON.stringify({
      totalPoints: 30,
      questions: [createSemanticQuestion()]
    })
  );
  fs.writeFileSync(path.join(projectDir, "q2.txt"), "Negative edges can improve a finalized node.");

  const result = await autoCheck({
    cwd: dir,
    projectPath: "exam1",
    gradingFile: "grading.json",
    requireGrading: true,
    subject: "cs161",
    project: "exam1",
    aiConfig: {
      minConfidence: 0.8
    },
    aiGrader: async () => ({
      score: 18,
      confidence: 0.61,
      needsReview: false,
      criterionScores: [
        { id: "reasoning", points: 15, earned: 12, justification: "Mostly right." },
        { id: "example", points: 15, earned: 6, justification: "Weak example." }
      ],
      reasoningSummary: "Partial answer.",
      evidenceQuotes: ["Negative edges can improve a finalized node."]
    })
  });

  assert.equal(result.reviewRequired, true);
  assert.equal(result.results[0].needsReview, true);
});

test("autoCheck rejects invalid semantic schema", async () => {
  const dir = makeTempDir();
  const projectDir = path.join(dir, "exam1");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, "grading.json"),
    JSON.stringify({
      totalPoints: 30,
      questions: [
        createSemanticQuestion({
          rubric: [{ id: "reasoning", description: "Only half rubric", points: 15 }]
        })
      ]
    })
  );
  fs.writeFileSync(path.join(projectDir, "q2.txt"), "answer");

  await assert.rejects(
    () =>
      autoCheck({
        cwd: dir,
        projectPath: "exam1",
        gradingFile: "grading.json",
        requireGrading: true
      }),
    /rubric points/
  );
});

test("validateAiGradeResponse rejects evidence quotes not present in answer", () => {
  const question = createSemanticQuestion();
  assert.throws(
    () =>
      validateAiGradeResponse(
        {
          score: 24,
          confidence: 0.9,
          needsReview: false,
          criterionScores: [
            { id: "reasoning", points: 15, earned: 15, justification: "Good." },
            { id: "example", points: 15, earned: 9, justification: "Partial." }
          ],
          reasoningSummary: "Summary.",
          evidenceQuotes: ["not in the answer"]
        },
        question,
        "real answer text"
      ),
    /was not found/
  );
});

test("resolveManualScore sums scores from scores.json", () => {
  const dir = makeTempDir();
  const projectDir = path.join(dir, "exam1");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, "scores.json"),
    JSON.stringify({
      scores: [
        { earned: 30, points: 40 },
        { earned: 25, points: 60 }
      ]
    })
  );

  const score = resolveManualScore({
    cwd: dir,
    project: "exam1",
    projectConfig: {
      path: "exam1"
    }
  });

  assert.equal(score.earnedPoints, 55);
  assert.equal(score.totalPoints, 100);
});

test("submit works without relying on global git identity", async () => {
  const root = makeTempDir();
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  const isolatedHome = path.join(root, "home");
  const isolatedXdg = path.join(root, "xdg");

  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(isolatedHome, { recursive: true });
  fs.mkdirSync(isolatedXdg, { recursive: true });
  fs.writeFileSync(path.join(work, "answer.txt"), "42");

  const init = spawnSync("git", ["init", "--bare", remote], {
    encoding: "utf8"
  });
  assert.equal(init.status, 0, init.stderr);

  await withEnv(
    {
      HOME: isolatedHome,
      XDG_CONFIG_HOME: isolatedXdg,
      GIT_CONFIG_NOSYSTEM: "1"
    },
    () =>
      submit({
        cwd: work,
        submissionRef: "cs161/exam1",
        submitRemote: remote,
        files: ["answer.txt"]
      })
  );

  const showRef = spawnSync("git", ["--git-dir", remote, "show-ref", "refs/heads/submit/cs161/exam1"], {
    encoding: "utf8"
  });
  assert.equal(showRef.status, 0, showRef.stderr);
  assert.match(showRef.stdout, /refs\/heads\/submit\/cs161\/exam1/);
});

test("run test uses config-backed exact auto-check flow", async () => {
  const dir = makeTempDir();
  const gradingRoot = path.join(dir, "grading");
  const answersDir = path.join(dir, "answers");
  fs.mkdirSync(path.join(gradingRoot, "cs161", "exam1"), { recursive: true });
  fs.mkdirSync(answersDir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, ".nibras.json"),
    JSON.stringify({
      requireGrading: true,
      gradingRoot,
      subjects: {
        cs161: {
          projects: {
            exam1: {
              type: "check",
              path: "student/exam1"
            }
          }
        }
      }
    })
  );

  fs.writeFileSync(
    path.join(gradingRoot, "cs161", "exam1", "grading.json"),
    JSON.stringify({
      totalPoints: 100,
      questions: [
        {
          id: "q1",
          points: 100,
          answerFile: "q1.txt",
          solutions: ["correct"]
        }
      ]
    })
  );
  fs.writeFileSync(path.join(answersDir, "q1.txt"), "correct");

  const previousCwd = process.cwd();
  const previousExitCode = process.exitCode;
  process.chdir(dir);
  process.exitCode = undefined;

  try {
    const logs = await captureLogs(() =>
      run(["node", "bin/nibras.js", "cs161", "test", "exam1", "--answers-dir", answersDir])
    );

    assert.equal(process.exitCode, undefined);
    assert.match(logs.join("\n"), /Auto-check: 100\/100 \(100%\)/);
    assert.match(logs.join("\n"), /q1: .*PASS/);
  } finally {
    process.chdir(previousCwd);
    process.exitCode = previousExitCode;
  }
});

test("run test falls back to manual scoring when gradingRoot is set but grading is absent", async () => {
  const dir = makeTempDir();
  const gradingRoot = path.join(dir, "grading");
  const projectDir = path.join(dir, "student", "exam1");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, "scores.json"), JSON.stringify({ earnedPoints: 100, totalPoints: 100 }));
  writeCheckConfig(dir, {
    topLevel: { gradingRoot },
    project: { totalPoints: 100, scoresFile: "scores.json" }
  });

  const logs = await withExitCodeReset(() =>
    captureRunInDirectory(dir, ["node", "bin/nibras.js", "cs161", "test", "exam1"])
  );

  assert.equal(process.exitCode, undefined);
  assert.match(logs.join("\n"), /Score: 100% \(100\/100\)/);
});

test("run test lets project requireGrading false override top-level strict grading", async () => {
  const dir = makeTempDir();
  const projectDir = path.join(dir, "student", "exam1");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, "scores.json"), JSON.stringify({ earnedPoints: 100, totalPoints: 100 }));
  writeCheckConfig(dir, {
    topLevel: { requireGrading: true },
    project: {
      requireGrading: false,
      totalPoints: 100,
      scoresFile: "scores.json"
    }
  });

  const logs = await withExitCodeReset(() =>
    captureRunInDirectory(dir, ["node", "bin/nibras.js", "cs161", "test", "exam1"])
  );

  assert.equal(process.exitCode, undefined);
  assert.match(logs.join("\n"), /Score: 100% \(100\/100\)/);
});

test("run test lets subject requireGrading false override top-level strict grading", async () => {
  const dir = makeTempDir();
  const projectDir = path.join(dir, "student", "exam1");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, "scores.json"), JSON.stringify({ earnedPoints: 100, totalPoints: 100 }));
  writeCheckConfig(dir, {
    topLevel: { requireGrading: true },
    subject: { requireGrading: false },
    project: { totalPoints: 100, scoresFile: "scores.json" }
  });

  const logs = await withExitCodeReset(() =>
    captureRunInDirectory(dir, ["node", "bin/nibras.js", "cs161", "test", "exam1"])
  );

  assert.equal(process.exitCode, undefined);
  assert.match(logs.join("\n"), /Score: 100% \(100\/100\)/);
});

test("run test treats explicit --grading as strict even when requireGrading is false", async () => {
  const dir = makeTempDir();
  const projectDir = path.join(dir, "student", "exam1");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, "scores.json"), JSON.stringify({ earnedPoints: 100, totalPoints: 100 }));
  writeCheckConfig(dir, {
    project: { requireGrading: false, totalPoints: 100, scoresFile: "scores.json" }
  });

  await withWorkingDirectory(dir, () =>
    assert.rejects(
      () =>
        run([
          "node",
          "bin/nibras.js",
          "cs161",
          "test",
          "exam1",
          "--grading",
          "missing.json"
        ]),
      /grading\.json not found|missing\.json not found/
    )
  );
});

test("run test auto-checks when gradingRoot contains grading even without strict mode", async () => {
  const dir = makeTempDir();
  const gradingRoot = path.join(dir, "grading");
  const answersDir = path.join(dir, "answers");
  fs.mkdirSync(path.join(gradingRoot, "cs161", "exam1"), { recursive: true });
  fs.mkdirSync(answersDir, { recursive: true });
  fs.writeFileSync(
    path.join(gradingRoot, "cs161", "exam1", "grading.json"),
    JSON.stringify({
      totalPoints: 100,
      questions: [
        {
          id: "q1",
          points: 100,
          answerFile: "q1.txt",
          solutions: ["correct"]
        }
      ]
    })
  );
  fs.writeFileSync(path.join(answersDir, "q1.txt"), "correct");
  writeCheckConfig(dir, {
    topLevel: { gradingRoot }
  });

  const logs = await withExitCodeReset(() =>
    captureRunInDirectory(dir, ["node", "bin/nibras.js", "cs161", "test", "exam1", "--answers-dir", answersDir])
  );

  assert.equal(process.exitCode, undefined);
  assert.match(logs.join("\n"), /Auto-check: 100\/100 \(100%\)/);
  assert.doesNotMatch(logs.join("\n"), /Score:/);
});

test("run test supports absolute project paths for manual grading", async () => {
  const dir = makeTempDir();
  const absoluteProjectDir = path.join(dir, "absolute-exam1");
  fs.mkdirSync(absoluteProjectDir, { recursive: true });
  fs.writeFileSync(
    path.join(absoluteProjectDir, "scores.json"),
    JSON.stringify({ earnedPoints: 100, totalPoints: 100 })
  );
  writeCheckConfig(dir, {
    project: {
      path: absoluteProjectDir,
      totalPoints: 100,
      scoresFile: "scores.json"
    }
  });

  const logs = await withExitCodeReset(() =>
    captureRunInDirectory(dir, ["node", "bin/nibras.js", "cs161", "test", "exam1"])
  );

  assert.equal(process.exitCode, undefined);
  assert.match(logs.join("\n"), /Score: 100% \(100\/100\)/);
});

test("run test supports absolute project paths for auto-check default files", async () => {
  const dir = makeTempDir();
  const absoluteProjectDir = path.join(dir, "absolute-exam1");
  fs.mkdirSync(absoluteProjectDir, { recursive: true });
  fs.writeFileSync(
    path.join(absoluteProjectDir, "grading.json"),
    JSON.stringify({
      totalPoints: 100,
      questions: [
        {
          id: "q1",
          points: 100,
          answerFile: "q1.txt",
          solutions: ["correct"]
        }
      ]
    })
  );
  fs.writeFileSync(path.join(absoluteProjectDir, "q1.txt"), "correct");
  writeCheckConfig(dir, {
    topLevel: { requireGrading: true },
    project: { path: absoluteProjectDir }
  });

  const logs = await withExitCodeReset(() =>
    captureRunInDirectory(dir, ["node", "bin/nibras.js", "cs161", "test", "exam1"])
  );

  assert.equal(process.exitCode, undefined);
  assert.match(logs.join("\n"), /Auto-check: 100\/100 \(100%\)/);
  assert.match(logs.join("\n"), /q1: .*PASS/);
});

test("run test falls back to manual scoring when grading root comes from env only", async () => {
  const dir = makeTempDir();
  const projectDir = path.join(dir, "student", "exam1");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, "scores.json"), JSON.stringify({ earnedPoints: 100, totalPoints: 100 }));
  writeCheckConfig(dir, {
    project: { totalPoints: 100, scoresFile: "scores.json" }
  });

  const logs = await withExitCodeReset(() =>
    captureRunInDirectory(
      dir,
      ["node", "bin/nibras.js", "cs161", "test", "exam1"],
      { NIBRAS_GRADING_ROOT: path.join(dir, "grading") }
    )
  );

  assert.equal(process.exitCode, undefined);
  assert.match(logs.join("\n"), /Score: 100% \(100\/100\)/);
});

test("run test supports repo-backed exam1 strict grading with relative paths", async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;

  try {
    const logs = await withWorkingDirectory(repoRoot, () =>
      captureLogs(() =>
        run([
          "node",
          "bin/nibras.js",
          "cs161",
          "test",
          "exam1",
          "--grading-root",
          "test/fixtures/private-grading",
          "--answers-dir",
          "test/fixtures/answers/exam1/all-correct"
        ])
      )
    );

    assert.equal(process.exitCode, undefined);
    assert.match(logs.join("\n"), /Auto-check: 100\/100 \(100%\)/);
    assert.match(logs.join("\n"), /q1: .*PASS.*\(45\/45\)/);
    assert.match(logs.join("\n"), /q2: .*PASS.*\(35\/35\)/);
    assert.match(logs.join("\n"), /q3: .*PASS.*\(20\/20\)/);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test("repo config no longer advertises a broken exam1 setup URL", () => {
  const config = JSON.parse(fs.readFileSync(path.join(repoRoot, ".nibras.json"), "utf8"));
  assert.equal(config.subjects.cs161.projects.exam1.setupUrl, undefined);
  assert.equal(config.subjects.cs161.projects.exam1.setupZipName, undefined);
});

test("run test supports repo-backed exam1 mixed scoring and alternate accepted solutions", async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;

  try {
    const logs = await withWorkingDirectory(repoRoot, () =>
      captureLogs(() =>
        run([
          "node",
          "bin/nibras.js",
          "cs161",
          "test",
          "exam1",
          "--grading-root",
          "test/fixtures/private-grading",
          "--answers-dir",
          "test/fixtures/answers/exam1/mixed"
        ])
      )
    );

    assert.equal(process.exitCode, 1);
    assert.match(logs.join("\n"), /Auto-check: 65\/100 \(65%\)/);
    assert.match(logs.join("\n"), /q1: .*PASS.*\(45\/45\)/);
    assert.match(logs.join("\n"), /q2: FAIL \(0\/35\)/);
    assert.match(logs.join("\n"), /q3: .*PASS.*\(20\/20\)/);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test("run test fails for repo-backed exam1 when an answer file is missing", async () => {
  const answersDir = makeTempDir();
  fs.writeFileSync(
    path.join(answersDir, "q1.txt"),
    fs.readFileSync(path.join(repoRoot, "test/fixtures/answers/exam1/all-correct/q1.txt"), "utf8")
  );
  fs.writeFileSync(
    path.join(answersDir, "q2.txt"),
    fs.readFileSync(path.join(repoRoot, "test/fixtures/answers/exam1/all-correct/q2.txt"), "utf8")
  );

  await withWorkingDirectory(repoRoot, () =>
    assert.rejects(
      () =>
        run([
          "node",
          "bin/nibras.js",
          "cs161",
          "test",
          "exam1",
          "--grading-root",
          "test/fixtures/private-grading",
          "--answers-dir",
          answersDir
        ]),
      /Missing answer file for q3/
    )
  );
});

test("run test fails for repo-backed exam1 when an answer file is empty", async () => {
  const answersDir = makeTempDir();
  fs.writeFileSync(
    path.join(answersDir, "q1.txt"),
    fs.readFileSync(path.join(repoRoot, "test/fixtures/answers/exam1/all-correct/q1.txt"), "utf8")
  );
  fs.writeFileSync(
    path.join(answersDir, "q2.txt"),
    fs.readFileSync(path.join(repoRoot, "test/fixtures/answers/exam1/all-correct/q2.txt"), "utf8")
  );
  fs.writeFileSync(path.join(answersDir, "q3.txt"), "   \n");

  await withWorkingDirectory(repoRoot, () =>
    assert.rejects(
      () =>
        run([
          "node",
          "bin/nibras.js",
          "cs161",
          "test",
          "exam1",
          "--grading-root",
          "test/fixtures/private-grading",
          "--answers-dir",
          answersDir
        ]),
      /Answer file is empty for q3/
    )
  );
});

test("run test supports semantic grading, review files, and fail-on-review", async () => {
  const dir = makeTempDir();
  const gradingRoot = path.join(dir, "grading");
  const answersDir = path.join(dir, "answers");
  const reviewFile = path.join(dir, "review", "semantic.json");
  fs.mkdirSync(path.join(gradingRoot, "cs161", "exam1"), { recursive: true });
  fs.mkdirSync(answersDir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, ".nibras.json"),
    JSON.stringify({
      requireGrading: true,
      gradingRoot,
      ai: {
        provider: "openai",
        model: "config-model",
        minConfidence: 0.8
      },
      subjects: {
        cs161: {
          projects: {
            exam1: {
              type: "check",
              path: "student/exam1"
            }
          }
        }
      }
    })
  );

  fs.writeFileSync(
    path.join(gradingRoot, "cs161", "exam1", "grading.json"),
    JSON.stringify({
      totalPoints: 30,
      questions: [createSemanticQuestion()]
    })
  );
  fs.writeFileSync(
    path.join(answersDir, "q2.txt"),
    "Once you finalize a node, a later negative edge can lower it again."
  );

  const server = await startMockAiServer(async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            score: 18,
            confidence: 0.61,
            needsReview: false,
            criterionScores: [
              {
                id: "reasoning",
                points: 15,
                earned: 12,
                justification: "Mostly right."
              },
              {
                id: "example",
                points: 15,
                earned: 6,
                justification: "Weak example."
              }
            ],
            reasoningSummary: "Partial answer.",
            evidenceQuotes: [
              "Once you finalize a node, a later negative edge can lower it again."
            ]
          })
        }
      }
    ]
  }));

  const previousCwd = process.cwd();
  const previousExitCode = process.exitCode;
  process.chdir(dir);
  process.exitCode = undefined;

  try {
    const logs = await withEnv(
      {
        NIBRAS_AI_API_KEY: "test-key",
        NIBRAS_AI_BASE_URL: server.baseUrl
      },
      () =>
        captureLogs(() =>
          run([
            "node",
            "bin/nibras.js",
            "cs161",
            "test",
            "exam1",
            "--answers-dir",
            answersDir,
            "--review-file",
            reviewFile,
            "--fail-on-review",
            "--ai-model",
            "flag-model"
          ])
        )
    );

    assert.equal(process.exitCode, 1);
    assert.match(logs.join("\n"), /q2: 18\/30 AI\(confidence 0.61\) REVIEW/);
    assert.match(logs.join("\n"), /Review: 1 question require instructor review/);
    assert.equal(server.requests[0].model, "flag-model");

    const review = JSON.parse(fs.readFileSync(reviewFile, "utf8"));
    assert.equal(review.reviewRequired, true);
    assert.equal(review.results[0].mode, "semantic");
    assert.equal(review.results[0].needsReview, true);
    assert.equal(review.results[0].confidence, 0.61);
  } finally {
    await server.close();
    process.chdir(previousCwd);
    process.exitCode = previousExitCode;
  }
});

test("run test fails when semantic grading is disabled", async () => {
  const dir = makeTempDir();
  const gradingRoot = path.join(dir, "grading");
  const answersDir = path.join(dir, "answers");
  fs.mkdirSync(path.join(gradingRoot, "cs161", "exam1"), { recursive: true });
  fs.mkdirSync(answersDir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, ".nibras.json"),
    JSON.stringify({
      requireGrading: true,
      gradingRoot,
      subjects: {
        cs161: {
          projects: {
            exam1: {
              type: "check",
              path: "student/exam1"
            }
          }
        }
      }
    })
  );
  fs.writeFileSync(
    path.join(gradingRoot, "cs161", "exam1", "grading.json"),
    JSON.stringify({
      totalPoints: 30,
      questions: [createSemanticQuestion()]
    })
  );
  fs.writeFileSync(path.join(answersDir, "q2.txt"), "answer");

  const previousCwd = process.cwd();
  process.chdir(dir);
  try {
    await assert.rejects(
      () =>
        run([
          "node",
          "bin/nibras.js",
          "cs161",
          "test",
          "exam1",
          "--answers-dir",
          answersDir,
          "--no-ai"
        ]),
      /requires AI grading/
    );
  } finally {
    process.chdir(previousCwd);
  }
});

test("run test fails with a clear error when semantic grading lacks an API key", async () => {
  const dir = makeTempDir();
  const gradingRoot = path.join(dir, "grading");
  const answersDir = path.join(dir, "answers");
  fs.mkdirSync(path.join(gradingRoot, "cs161", "exam1"), { recursive: true });
  fs.mkdirSync(answersDir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, ".nibras.json"),
    JSON.stringify({
      requireGrading: true,
      gradingRoot,
      ai: {
        provider: "openai",
        model: "config-model"
      },
      subjects: {
        cs161: {
          projects: {
            exam1: {
              type: "check",
              path: "student/exam1"
            }
          }
        }
      }
    })
  );
  fs.writeFileSync(
    path.join(gradingRoot, "cs161", "exam1", "grading.json"),
    JSON.stringify({
      totalPoints: 30,
      questions: [createSemanticQuestion()]
    })
  );
  fs.writeFileSync(path.join(answersDir, "q2.txt"), "answer");

  const previousCwd = process.cwd();
  process.chdir(dir);
  try {
    await withEnv(
      {
        NIBRAS_AI_API_KEY: undefined
      },
      () =>
        assert.rejects(
          () =>
            run([
              "node",
              "bin/nibras.js",
              "cs161",
              "test",
              "exam1",
              "--answers-dir",
              answersDir
            ]),
          /NIBRAS_AI_API_KEY/
        )
    );
  } finally {
    process.chdir(previousCwd);
  }
});

test("setupProject extracts a local zip archive", async (t) => {
  if (!commandExists("zip") || !commandExists("unzip")) {
    t.skip("zip/unzip are required for this test");
    return;
  }

  const dir = makeTempDir();
  const sourceDir = path.join(dir, "source");
  const destDir = path.join(dir, "dest");
  const zipPath = path.join(dir, "bundle.zip");

  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, "fixture.txt"), "hello");

  const zip = spawnSync("zip", ["-q", zipPath, "fixture.txt"], {
    cwd: sourceDir,
    encoding: "utf8"
  });
  assert.equal(zip.status, 0, zip.stderr);

  await setupProject({
    cwd: dir,
    subject: "cs161",
    project: "exam1",
    projectConfig: {
      setupUrl: zipPath,
      setupDir: destDir
    },
    subjectConfig: {}
  });

  assert.equal(fs.readFileSync(path.join(destDir, "fixture.txt"), "utf8"), "hello");
});
