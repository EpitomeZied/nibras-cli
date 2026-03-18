import { spawn } from "node:child_process";
import { minimatch } from "minimatch";

type CommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

function runCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function runGit(cwd: string, args: string[]): Promise<CommandResult> {
  const result = await runCommand("git", args, cwd);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed.`);
  }
  return result;
}

export async function ensureGitRepo(cwd: string): Promise<void> {
  await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
}

export async function getCurrentBranch(cwd: string): Promise<string> {
  const result = await runGit(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  return result.stdout.trim();
}

export async function getOriginUrl(cwd: string): Promise<string> {
  const result = await runGit(cwd, ["remote", "get-url", "origin"]);
  return result.stdout.trim();
}

export async function getHeadSha(cwd: string): Promise<string> {
  const result = await runGit(cwd, ["rev-parse", "HEAD"]);
  return result.stdout.trim();
}

export async function ensureGitIdentity(
  cwd: string,
  fallbackName: string,
  fallbackEmail: string
): Promise<void> {
  const nameResult = await runCommand("git", ["config", "user.name"], cwd);
  if (nameResult.code !== 0 || !nameResult.stdout.trim()) {
    await runGit(cwd, ["config", "user.name", fallbackName]);
  }
  const emailResult = await runCommand("git", ["config", "user.email"], cwd);
  if (emailResult.code !== 0 || !emailResult.stdout.trim()) {
    await runGit(cwd, ["config", "user.email", fallbackEmail]);
  }
}

function parseStatusLine(line: string): string | null {
  if (!line.trim()) return null;
  const rawPath = line.slice(3).trim();
  if (!rawPath) return null;
  if (rawPath.includes(" -> ")) {
    return rawPath.split(" -> ").at(-1) || null;
  }
  return rawPath;
}

export async function stageAllowedFiles(cwd: string, allowedPatterns: string[]): Promise<string[]> {
  const status = await runGit(cwd, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const changedFiles = status.stdout
    .split("\n")
    .map(parseStatusLine)
    .filter((value): value is string => Boolean(value));

  if (changedFiles.length === 0) {
    throw new Error("No file changes detected. Nothing to submit.");
  }

  const allowedFiles = changedFiles.filter((filePath) =>
    allowedPatterns.some((pattern) => minimatch(filePath, pattern, { dot: true }))
  );
  const blockedFiles = changedFiles.filter((filePath) => !allowedFiles.includes(filePath));

  if (blockedFiles.length > 0) {
    throw new Error(
      `Refusing to submit files outside manifest.allowedPaths: ${blockedFiles.join(", ")}`
    );
  }

  await runGit(cwd, ["add", "--", ...allowedFiles]);
  return allowedFiles;
}

export async function createCommit(cwd: string, message: string): Promise<string> {
  await runGit(cwd, ["commit", "-m", message]);
  return getHeadSha(cwd);
}

export async function pushBranch(cwd: string, branch: string): Promise<void> {
  await runGit(cwd, ["push", "origin", `HEAD:${branch}`]);
}
