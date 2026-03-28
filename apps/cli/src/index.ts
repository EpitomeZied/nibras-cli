#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import picocolors from "picocolors";
import {
  DevicePollResponseSchema,
  DeviceStartResponseSchema,
  MeResponseSchema,
  PingResponseSchema,
  ProjectSetupResponseSchema,
  ProjectTaskResponseSchema,
  SubmissionPrepareResponseSchema,
  SubmissionStatusResponseSchema
} from "@nibras/contracts";
import {
  ApiError,
  apiRequest,
  clearCliSession,
  createCommit,
  ensureGitIdentity,
  ensureGitRepo,
  getCurrentBranch,
  getOriginUrl,
  loadProjectManifest,
  readCliConfig,
  stageAllowedFiles,
  pushBranch,
  writeCliConfig,
  writeProjectManifest,
  writeTaskText
} from "@nibras/core";

type CommandContext = {
  plain: boolean;
};

const banner = [
  "███╗   ██╗██╗██████╗ ██████╗  █████╗ ███████╗",
  "████╗  ██║██║██╔══██╗██╔══██╗██╔══██╗██╔════╝",
  "██╔██╗ ██║██║██████╔╝██████╔╝███████║███████╗",
  "██║╚██╗██║██║██╔══██╗██╔══██╗██╔══██║╚════██║",
  "██║ ╚████║██║██████╔╝██║  ██║██║  ██║███████║",
  "╚═╝  ╚═══╝╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝"
].join("\n");

function isPlainMode(args: string[]): boolean {
  return args.includes("--plain") || process.env.NO_COLOR === "1" || !process.stdout.isTTY;
}

function colorize(context: CommandContext, kind: "accent" | "error" | "success" | "muted", value: string): string {
  if (context.plain) return value;
  if (kind === "accent") return picocolors.cyan(value);
  if (kind === "error") return picocolors.red(value);
  if (kind === "success") return picocolors.green(value);
  return picocolors.dim(value);
}

function printHelp(context: CommandContext): void {
  // eslint-disable-next-line no-console
  console.log(colorize(context, "accent", banner));
  // eslint-disable-next-line no-console
  console.log("\nCLI to interact with Nibras\n");
  // eslint-disable-next-line no-console
  console.log("USAGE");
  // eslint-disable-next-line no-console
  console.log("  $ nibras [command]\n");
  // eslint-disable-next-line no-console
  console.log("EXAMPLES");
  // eslint-disable-next-line no-console
  console.log("  $ nibras login");
  // eslint-disable-next-line no-console
  console.log("  $ nibras test");
  // eslint-disable-next-line no-console
  console.log("  $ nibras test --previous");
  // eslint-disable-next-line no-console
  console.log("  $ nibras submit\n");
  // eslint-disable-next-line no-console
  console.log("COMMANDS");
  // eslint-disable-next-line no-console
  console.log("  login:            Start device login against the hosted API");
  // eslint-disable-next-line no-console
  console.log("  logout:           Clear the local CLI session");
  // eslint-disable-next-line no-console
  console.log("  whoami:           Show the signed-in user and linked GitHub account");
  // eslint-disable-next-line no-console
  console.log("  test:             Run project-local public tests");
  // eslint-disable-next-line no-console
  console.log("  submit:           Commit tracked solution files, push, and wait for verification");
  // eslint-disable-next-line no-console
  console.log("  task:             View current task instructions");
  // eslint-disable-next-line no-console
  console.log("  setup:            Bootstrap a local project manifest from the API");
  // eslint-disable-next-line no-console
  console.log("  ping:             Verify API, auth, GitHub linkage, and repo state");
  // eslint-disable-next-line no-console
  console.log("  update-buildpack: Update Node version in .nibras/project.json");
  // eslint-disable-next-line no-console
  console.log("  legacy:           Run the existing subject/project CLI\n");
  // eslint-disable-next-line no-console
  console.log("VERSION");
  // eslint-disable-next-line no-console
  console.log(`  ${getVersion()}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRootPackageJsonPath(): string {
  return path.resolve(__dirname, "../../../package.json");
}

function getVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(getRootPackageJsonPath(), "utf8")) as { version: string };
  const gitSha = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: path.resolve(__dirname, "../../.."),
    encoding: "utf8"
  });
  if (gitSha.status === 0 && gitSha.stdout.trim()) {
    return `v${pkg.version}-${gitSha.stdout.trim()}`;
  }
  return `v${pkg.version}`;
}

function tryOpenBrowser(url: string): void {
  const candidates: Array<{ command: string; args: string[]; options?: { shell?: boolean } }> = [
    { command: "xdg-open", args: [url] },
    { command: "open", args: [url] },
    { command: "cmd", args: ["/c", "start", url], options: { shell: true } }
  ];

  for (const candidate of candidates) {
    try {
      const child = spawn(candidate.command, candidate.args, {
        detached: true,
        stdio: "ignore",
        shell: candidate.options?.shell || false
      });
      child.unref();
      return;
    } catch {
      continue;
    }
  }
}

function parseOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function parseError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.bodyText || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

async function commandLogin(args: string[], context: CommandContext): Promise<void> {
  const config = readCliConfig();
  const apiBaseUrl = parseOption(args, "--api-base-url") || config.apiBaseUrl;
  const start = DeviceStartResponseSchema.parse(await apiRequest("/v1/device/start", {
    method: "POST"
  }, apiBaseUrl));

  // eslint-disable-next-line no-console
  console.log(`${colorize(context, "accent", "Open")} ${start.verificationUriComplete}`);
  // eslint-disable-next-line no-console
  console.log(`${colorize(context, "accent", "Code")} ${start.userCode}`);

  if (!hasFlag(args, "--no-open")) {
    tryOpenBrowser(start.verificationUriComplete);
  }

  const deadline = Date.now() + (start.expiresInSeconds * 1000);
  while (Date.now() < deadline) {
    await sleep(start.intervalSeconds * 1000);
    const polled = DevicePollResponseSchema.parse(await apiRequest("/v1/device/poll", {
      method: "POST",
      body: JSON.stringify({ deviceCode: start.deviceCode })
    }, apiBaseUrl));
    if (polled.status === "authorized") {
      writeCliConfig({
        apiBaseUrl,
        activeUserId: polled.user.id,
        accessToken: polled.accessToken,
        refreshToken: polled.refreshToken,
        tokenCreatedAt: new Date().toISOString()
      });
      // eslint-disable-next-line no-console
      console.log(`${colorize(context, "success", "Authenticated")} as ${polled.user.username} (${polled.user.githubLogin})`);
      return;
    }
  }

  throw new Error("Device login timed out before approval.");
}

async function commandLogout(): Promise<void> {
  const config = readCliConfig();
  if (config.accessToken) {
    try {
      await apiRequest("/v1/logout", { method: "POST" });
    } catch {
      // Best effort only. The local session still needs to be cleared.
    }
  }
  clearCliSession();
}

async function commandWhoami(): Promise<void> {
  const response = MeResponseSchema.parse(await apiRequest("/v1/me"));
  // eslint-disable-next-line no-console
  console.log(`User: ${response.user.username}`);
  // eslint-disable-next-line no-console
  console.log(`GitHub: ${response.user.githubLogin}`);
  // eslint-disable-next-line no-console
  console.log(`API: ${response.apiBaseUrl}`);
}

async function commandPing(): Promise<void> {
  const response = PingResponseSchema.parse(await apiRequest("/v1/ping"));
  // eslint-disable-next-line no-console
  console.log(`API: ${response.api}`);
  // eslint-disable-next-line no-console
  console.log(`Auth: ${response.auth}`);
  // eslint-disable-next-line no-console
  console.log(`GitHub: ${response.github}`);
  // eslint-disable-next-line no-console
  console.log(`GitHub App: ${response.githubApp}`);

  try {
    const { projectRoot, manifest } = loadProjectManifest(process.cwd());
    const origin = await getOriginUrl(projectRoot);
    // eslint-disable-next-line no-console
    console.log(`Project: ${manifest.projectKey}`);
    // eslint-disable-next-line no-console
    console.log(`Origin: ${origin}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(`Project: ${parseError(err)}`);
  }
}

async function commandTask(): Promise<void> {
  const { projectRoot, manifest } = loadProjectManifest(process.cwd());
  const taskPath = path.join(projectRoot, ".nibras", "task.md");
  if (fs.existsSync(taskPath)) {
    // eslint-disable-next-line no-console
    console.log(fs.readFileSync(taskPath, "utf8"));
    return;
  }

  const task = ProjectTaskResponseSchema.parse(await apiRequest(`/v1/projects/${encodeURIComponent(manifest.projectKey)}/task`));
  writeTaskText(projectRoot, task.task);
  // eslint-disable-next-line no-console
  console.log(task.task);
}

async function runShellCommand(command: string, cwd: string, extraArgs: string[]): Promise<number> {
  const fullCommand = extraArgs.length > 0 ? `${command} ${extraArgs.join(" ")}` : command;
  return new Promise((resolve, reject) => {
    const child = spawn(fullCommand, {
      cwd,
      shell: true,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code || 0));
  });
}

async function commandTest(args: string[]): Promise<void> {
  const { projectRoot, manifest } = loadProjectManifest(process.cwd());
  const wantsPrevious = hasFlag(args, "--previous");
  if (wantsPrevious && !manifest.test.supportsPrevious) {
    throw new Error("This project does not support --previous.");
  }
  const exitCode = await runShellCommand(manifest.test.command, projectRoot, wantsPrevious ? ["--previous"] : []);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

async function commandSetup(args: string[]): Promise<void> {
  const projectKey = parseOption(args, "--project");
  if (!projectKey) {
    throw new Error("setup requires --project <subject/project>.");
  }
  const targetDir = path.resolve(parseOption(args, "--dir") || process.cwd());
  const response = ProjectSetupResponseSchema.parse(await apiRequest(`/v1/projects/${encodeURIComponent(projectKey)}/setup`, {
    method: "POST"
  }));

  fs.mkdirSync(path.join(targetDir, ".nibras"), { recursive: true });
  writeProjectManifest(targetDir, response.manifest);
  writeTaskText(targetDir, response.task);

  if (!fs.existsSync(path.join(targetDir, ".git"))) {
    spawnSync("git", ["init", "-b", response.repo.defaultBranch], { cwd: targetDir, stdio: "ignore" });
  }

  // eslint-disable-next-line no-console
  console.log(`Project: ${response.projectKey}`);
  // eslint-disable-next-line no-console
  console.log(`Repo: ${response.repo.owner}/${response.repo.name}`);
  // eslint-disable-next-line no-console
  console.log(`Directory: ${targetDir}`);
}

async function commandUpdateBuildpack(args: string[]): Promise<void> {
  const version = parseOption(args, "--node") || "20";
  const { projectRoot, manifest } = loadProjectManifest(process.cwd());
  manifest.buildpack.node = version;
  writeProjectManifest(projectRoot, manifest);
  // eslint-disable-next-line no-console
  console.log(`Buildpack Node version set to ${version}`);
}

async function commandSubmit(): Promise<void> {
  const config = readCliConfig();
  if (!config.accessToken) {
    throw new Error("You are not logged in. Run `nibras login` first.");
  }

  const me = MeResponseSchema.parse(await apiRequest("/v1/me"));
  const { projectRoot, manifest } = loadProjectManifest(process.cwd());
  await ensureGitRepo(projectRoot);
  const repoUrl = await getOriginUrl(projectRoot);
  const branch = await getCurrentBranch(projectRoot);
  const stagedFiles = await stageAllowedFiles(projectRoot, manifest.submission.allowedPaths);
  await ensureGitIdentity(projectRoot, me.user.username, me.user.email);
  const timestamp = new Date().toISOString();
  const commitMessage = `nibras submit: ${manifest.projectKey} ${timestamp}`;
  const commitSha = await createCommit(projectRoot, commitMessage);
  await pushBranch(projectRoot, manifest.defaultBranch);

  const prepared = SubmissionPrepareResponseSchema.parse(await apiRequest("/v1/submissions/prepare", {
    method: "POST",
    body: JSON.stringify({
      projectKey: manifest.projectKey,
      commitSha,
      repoUrl,
      branch
    })
  }));

  await apiRequest(`/v1/submissions/${prepared.submissionId}/local-test-result`, {
    method: "POST",
    body: JSON.stringify({
      exitCode: 0,
      summary: `Submitted ${stagedFiles.length} file(s).`,
      ranPrevious: false
    })
  });

  const deadline = Date.now() + manifest.submission.waitForVerificationSeconds * 1000;
  while (Date.now() < deadline) {
    await sleep(1200);
    const status = SubmissionStatusResponseSchema.parse(await apiRequest(`/v1/submissions/${prepared.submissionId}`));
    // eslint-disable-next-line no-console
    console.log(`${status.status}: ${status.summary}`);
    if (["passed", "failed", "needs_review"].includes(status.status)) {
      if (status.status !== "passed") {
        process.exitCode = 1;
      }
      return;
    }
  }

  throw new Error("Timed out waiting for verification.");
}

async function runLegacyCli(argv: string[]): Promise<void> {
  const legacyPath = path.resolve(__dirname, "../../../src/cli.js");
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const legacy = require(legacyPath) as { run: (argv: string[]) => Promise<void> };
  await legacy.run(argv);
}

function isLegacyInvocation(args: string[]): boolean {
  if (args.length === 0) return false;
  const knownCommands = new Set([
    "login",
    "logout",
    "whoami",
    "test",
    "submit",
    "task",
    "setup",
    "ping",
    "update-buildpack",
    "help",
    "legacy",
    "--help",
    "-h",
    "--version",
    "-v",
    "version"
  ]);
  return !knownCommands.has(args[0]) && args.length >= 3;
}

export async function runCli(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  const context: CommandContext = { plain: isPlainMode(args) };
  const normalizedArgs = args.filter((arg) => arg !== "--plain");

  if (
    normalizedArgs.length === 0 ||
    normalizedArgs[0] === "help" ||
    normalizedArgs[0] === "--help" ||
    normalizedArgs[0] === "-h"
  ) {
    printHelp(context);
    return;
  }

  if (normalizedArgs[0] === "--version" || normalizedArgs[0] === "-v" || normalizedArgs[0] === "version") {
    // eslint-disable-next-line no-console
    console.log(getVersion());
    return;
  }

  if (normalizedArgs[0] === "legacy") {
    await runLegacyCli(["node", "nibras", ...normalizedArgs.slice(1)]);
    return;
  }

  if (isLegacyInvocation(normalizedArgs)) {
    await runLegacyCli(argv);
    return;
  }

  const command = normalizedArgs[0];
  const rest = normalizedArgs.slice(1);

  try {
    if (command === "login") {
      await commandLogin(rest, context);
      return;
    }
    if (command === "logout") {
      await commandLogout();
      return;
    }
    if (command === "whoami") {
      await commandWhoami();
      return;
    }
    if (command === "ping") {
      await commandPing();
      return;
    }
    if (command === "task") {
      await commandTask();
      return;
    }
    if (command === "test") {
      await commandTest(rest);
      return;
    }
    if (command === "setup") {
      await commandSetup(rest);
      return;
    }
    if (command === "update-buildpack") {
      await commandUpdateBuildpack(rest);
      return;
    }
    if (command === "submit") {
      await commandSubmit();
      return;
    }
    throw new Error(`Unknown command "${command}".`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(colorize(context, "error", parseError(err)));
    process.exitCode = process.exitCode || 1;
  }
}
