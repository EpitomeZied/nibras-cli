import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type SandboxMode = "ulimit" | "none";

export interface SandboxOptions {
  mode?: SandboxMode;
  maxCpuSeconds?: number;
  maxMemMb?: number;
  cloneTimeoutMs?: number;
  execTimeoutMs?: number;
}

export interface SandboxResult {
  exitCode: number;
  log: string;
}

function resolveOptions(opts: SandboxOptions): Required<SandboxOptions> {
  return {
    mode: (process.env.WORKER_SANDBOX_MODE as SandboxMode | undefined) || opts.mode || "ulimit",
    maxCpuSeconds: parseInt(process.env.WORKER_MAX_CPU_SECONDS || "60", 10),
    maxMemMb: parseInt(process.env.WORKER_MAX_MEM_MB || "512", 10),
    cloneTimeoutMs: opts.cloneTimeoutMs ?? 60_000,
    execTimeoutMs: opts.execTimeoutMs ?? 120_000
  };
}

/**
 * Clone a git repo and run a test command inside an isolated temp directory.
 *
 * In `ulimit` mode, wraps the command in a shell that sets:
 *   - ulimit -t (CPU seconds)
 *   - ulimit -v (virtual memory in KB)
 *   - ulimit -f (max file size in 512-byte blocks, capped at 100 MB)
 *
 * Also wraps the outer call with the system `timeout` binary if available,
 * providing a hard wall-clock limit even if ulimit is bypassed.
 *
 * Network isolation via `unshare --net` is attempted but silently skipped if
 * the kernel doesn't allow it (e.g., no CAP_SYS_ADMIN in CI).
 */
export async function runSandboxed(
  cloneUrl: string,
  branch: string,
  testCommand: string,
  opts: SandboxOptions = {}
): Promise<SandboxResult> {
  const resolved = resolveOptions(opts);
  const workDir = join(tmpdir(), `nibras-verify-${randomUUID()}`);

  try {
    mkdirSync(workDir, { recursive: true });

    // ── Step 1: clone ────────────────────────────────────────────────────────
    const cloneArgs = ["clone", "--depth", "1", "--branch", branch, cloneUrl, workDir];
    const cloneResult = spawnSync("git", cloneArgs, {
      encoding: "utf8",
      timeout: resolved.cloneTimeoutMs,
      env: {
        ...process.env,
        // Prevent git from prompting for credentials
        GIT_TERMINAL_PROMPT: "0",
        GIT_ASKPASS: "echo"
      }
    });

    if (cloneResult.status !== 0) {
      return {
        exitCode: cloneResult.status ?? 1,
        log: `git clone failed:\n${cloneResult.stderr || cloneResult.error?.message || "unknown error"}`
      };
    }

    // ── Step 2: build wrapped shell command ──────────────────────────────────
    let shellCmd: string;

    if (resolved.mode === "ulimit") {
      const memKb = resolved.maxMemMb * 1024;
      const maxFileSizeBlocks = Math.floor((100 * 1024 * 1024) / 512); // 100 MB in 512-byte blocks
      // Set resource limits then exec the test command
      shellCmd = [
        `ulimit -t ${resolved.maxCpuSeconds}`,
        `ulimit -v ${memKb}`,
        `ulimit -f ${maxFileSizeBlocks}`,
        `cd ${JSON.stringify(workDir)}`,
        testCommand
      ].join(" && ");
    } else {
      shellCmd = `cd ${JSON.stringify(workDir)} && ${testCommand}`;
    }

    // ── Step 3: optionally wrap in `timeout` for wall-clock hard limit ───────
    const wallClockSeconds = Math.ceil(resolved.execTimeoutMs / 1000) + 10;
    const timeoutAvailable = spawnSync("which", ["timeout"], { encoding: "utf8" }).status === 0;

    let argv: string[];
    if (timeoutAvailable) {
      argv = ["timeout", "--kill-after=5", String(wallClockSeconds), "sh", "-c", shellCmd];
    } else {
      argv = ["sh", "-c", shellCmd];
    }

    // ── Step 4: optionally run in network namespace ──────────────────────────
    const unshareAvailable =
      resolved.mode === "ulimit" &&
      spawnSync("which", ["unshare"], { encoding: "utf8" }).status === 0;

    if (unshareAvailable) {
      // Test if we actually have permission (silently fall back if not)
      const testUnshare = spawnSync("unshare", ["--net", "true"], { encoding: "utf8" });
      if (testUnshare.status === 0) {
        argv = ["unshare", "--net", ...argv];
      }
    }

    const testResult = spawnSync(argv[0], argv.slice(1), {
      encoding: "utf8",
      timeout: resolved.execTimeoutMs + 15_000, // outer Node.js safety net
      env: {
        ...process.env,
        // Prevent the child from inheriting secrets
        DATABASE_URL: undefined,
        GITHUB_APP_PRIVATE_KEY: undefined,
        NIBRAS_ENCRYPTION_KEY: undefined
      }
    });

    const output = [testResult.stdout, testResult.stderr].filter(Boolean).join("\n");

    return {
      exitCode: testResult.status ?? 1,
      log: output || testResult.error?.message || "(no output)"
    };
  } finally {
    // Always clean up, even on crash
    if (existsSync(workDir)) {
      try {
        rmSync(workDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup; log but don't rethrow
      }
    }
  }
}
