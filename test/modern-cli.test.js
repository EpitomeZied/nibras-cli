const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const { buildApp } = require("../apps/api/dist/app");
const { FileStore } = require("../apps/api/dist/store");

const repoRoot = path.resolve(__dirname, "..");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "nibras-modern-"));
}

async function startApi(storePath) {
  const previousStore = process.env.NIBRAS_API_STORE;
  process.env.NIBRAS_API_STORE = storePath;
  const app = buildApp(new FileStore(storePath));
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  const apiBaseUrl = `http://127.0.0.1:${address.port}`;
  return {
    apiBaseUrl,
    close: async () => {
      await app.close();
      if (previousStore === undefined) {
        delete process.env.NIBRAS_API_STORE;
      } else {
        process.env.NIBRAS_API_STORE = previousStore;
      }
    }
  };
}

async function createSession(apiBaseUrl) {
  const started = await fetch(`${apiBaseUrl}/v1/device/start`, {
    method: "POST"
  }).then((response) => response.json());
  await fetch(started.verificationUriComplete);
  const polled = await fetch(`${apiBaseUrl}/v1/device/poll`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceCode: started.deviceCode })
  }).then((response) => response.json());
  return polled;
}

function writeCliConfig(configRoot, apiBaseUrl, session) {
  const configDir = path.join(configRoot, "nibras");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({
    apiBaseUrl,
    activeUserId: session.user.id,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken
  }, null, 2));
}

function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [path.join(repoRoot, "bin", "nibras.js"), ...args], {
      cwd: options.cwd || repoRoot,
      env: {
        ...process.env,
        ...(options.env || {})
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ status: code, stdout, stderr });
    });
  });
}

test("modern CLI help renders the new command surface", async () => {
  const result = await runCli(["--plain"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /CLI to interact with Nibras/);
  assert.match(result.stdout, /login:/);
  assert.match(result.stdout, /legacy:/);
});

test("API uses forwarded host and protocol when building public URLs", async () => {
  const app = buildApp(new FileStore(path.join(makeTempDir(), "store.json")));
  try {
    const started = await app.inject({
      method: "POST",
      url: "/v1/device/start",
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "nondefined-gustavo-languidly.ngrok-free.dev"
      }
    });
    assert.equal(started.statusCode, 200);
    const payload = started.json();
    assert.equal(payload.verificationUri, "https://nondefined-gustavo-languidly.ngrok-free.dev/dev/approve");
    assert.match(
      payload.verificationUriComplete,
      /^https:\/\/nondefined-gustavo-languidly\.ngrok-free\.dev\/dev\/approve\?user_code=/
    );
  } finally {
    await app.close();
  }
});

test("modern CLI setup bootstraps a local project from the API", async () => {
  const tmp = makeTempDir();
  const configRoot = path.join(tmp, "config");
  const server = await startApi(path.join(tmp, "store.json"));
  try {
    const session = await createSession(server.apiBaseUrl);
    writeCliConfig(configRoot, server.apiBaseUrl, session);

    const projectDir = path.join(tmp, "project");
    const result = await runCli(["setup", "--project", "cs161/exam1", "--dir", projectDir, "--plain"], {
      env: { XDG_CONFIG_HOME: configRoot }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Project: cs161\/exam1/);
    assert.ok(fs.existsSync(path.join(projectDir, ".nibras", "project.json")));
    assert.ok(fs.existsSync(path.join(projectDir, ".nibras", "task.md")));
  } finally {
    await server.close();
  }
});

test("modern CLI whoami and ping use the hosted auth/session flow", async () => {
  const tmp = makeTempDir();
  const configRoot = path.join(tmp, "config");
  const server = await startApi(path.join(tmp, "store.json"));
  try {
    const session = await createSession(server.apiBaseUrl);
    writeCliConfig(configRoot, server.apiBaseUrl, session);

    const whoami = await runCli(["whoami", "--plain"], {
      env: { XDG_CONFIG_HOME: configRoot }
    });
    assert.equal(whoami.status, 0, whoami.stderr);
    assert.match(whoami.stdout, /User: demo/);
    assert.match(whoami.stdout, /GitHub: demo-user/);

    const ping = await runCli(["ping", "--plain"], {
      env: { XDG_CONFIG_HOME: configRoot }
    });
    assert.equal(ping.status, 0, ping.stderr);
    assert.match(ping.stdout, /API: reachable/);
    assert.match(ping.stdout, /Auth: valid/);
  } finally {
    await server.close();
  }
});

test("modern CLI submit commits, pushes, and waits for verification", async () => {
  const tmp = makeTempDir();
  const configRoot = path.join(tmp, "config");
  const server = await startApi(path.join(tmp, "store.json"));
  try {
    const session = await createSession(server.apiBaseUrl);
    writeCliConfig(configRoot, server.apiBaseUrl, session);

    const remote = path.join(tmp, "remote.git");
    const projectDir = path.join(tmp, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, ".nibras"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "answers"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, ".nibras", "project.json"), JSON.stringify({
      projectKey: "cs161/exam1",
      releaseVersion: "2026-03-01",
      apiBaseUrl: server.apiBaseUrl,
      defaultBranch: "main",
      buildpack: { node: "20" },
      test: {
        mode: "public-grading",
        command: "node -e \"process.exit(0)\"",
        supportsPrevious: true
      },
      submission: {
        allowedPaths: ["answers/**", ".nibras/**"],
        waitForVerificationSeconds: 10
      }
    }, null, 2));
    fs.writeFileSync(path.join(projectDir, ".nibras", "task.md"), "# Task\n");
    fs.writeFileSync(path.join(projectDir, "answers", "q1.txt"), "initial\n");

    assert.equal(spawnSync("git", ["init", "--bare", remote], { encoding: "utf8" }).status, 0);
    assert.equal(spawnSync("git", ["init", "-b", "main"], { cwd: projectDir, encoding: "utf8" }).status, 0);
    assert.equal(spawnSync("git", ["add", "."], { cwd: projectDir, encoding: "utf8" }).status, 0);
    assert.equal(spawnSync("git", ["config", "user.name", "tester"], { cwd: projectDir, encoding: "utf8" }).status, 0);
    assert.equal(spawnSync("git", ["config", "user.email", "tester@example.com"], { cwd: projectDir, encoding: "utf8" }).status, 0);
    assert.equal(spawnSync("git", ["commit", "-m", "init"], { cwd: projectDir, encoding: "utf8" }).status, 0);
    assert.equal(spawnSync("git", ["remote", "add", "origin", remote], { cwd: projectDir, encoding: "utf8" }).status, 0);
    assert.equal(spawnSync("git", ["push", "-u", "origin", "main"], { cwd: projectDir, encoding: "utf8" }).status, 0);

    fs.writeFileSync(path.join(projectDir, "answers", "q1.txt"), "updated answer\n");

    const result = await runCli(["submit", "--plain"], {
      cwd: projectDir,
      env: { XDG_CONFIG_HOME: configRoot }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /passed: Verification passed\./);

    const remoteHead = spawnSync("git", ["--git-dir", remote, "rev-parse", "refs/heads/main"], {
      encoding: "utf8"
    });
    assert.equal(remoteHead.status, 0);
    assert.match(remoteHead.stdout, /^[0-9a-f]{40}\n$/);
  } finally {
    await server.close();
  }
});
