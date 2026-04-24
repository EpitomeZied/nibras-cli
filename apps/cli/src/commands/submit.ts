import { spawn } from 'node:child_process';
import {
  MeResponseSchema,
  SubmissionPrepareResponseSchema,
  SubmissionStatusResponseSchema,
} from '@nibras/contracts';
import {
  apiRequest,
  buildProjectTestCommand,
  createCommit,
  ensureGitIdentity,
  ensureGitRepo,
  getCurrentBranch,
  getOriginUrl,
  loadProjectManifest,
  readCliConfig,
  stageAllowedFiles,
  pushBranch,
} from '@nibras/core';
import { createSpinner } from '../ui/spinner';
import { createPollProgress } from '../ui/progress';
import { printBox } from '../ui/box';

function runTests(command: string, cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 0));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function commandSubmit(plain: boolean, args: string[] = []): Promise<void> {
  const force = args.includes('--force');

  const config = readCliConfig();
  if (!config.accessToken) {
    throw new Error('You are not logged in. Run `nibras login` first.');
  }

  // ── Step 1: Load project context ─────────────────────────────────────────
  const me = MeResponseSchema.parse(await apiRequest('/v1/me'));
  const { projectRoot, manifest } = loadProjectManifest(process.cwd());
  await ensureGitRepo(projectRoot);
  const repoUrl = await getOriginUrl(projectRoot);
  const branch = await getCurrentBranch(projectRoot);
  const testCommand = buildProjectTestCommand(manifest.test, process.platform);

  // ── Step 2: Run local tests ───────────────────────────────────────────────
  if (!plain && process.stdout.isTTY) {
    console.log(`\n  Running tests: ${testCommand}\n`);
  }
  const testExitCode = await runTests(testCommand, projectRoot);
  if (!plain && process.stdout.isTTY) {
    console.log();
  }

  // Fail fast if local tests didn't pass, unless --force is passed.
  if (testExitCode !== 0 && !force) {
    printBox(
      'Tests failed — submission aborted',
      [
        `Command:   ${testCommand}`,
        `Exit code: ${testExitCode}`,
        '',
        'Fix your tests or run with --force to submit anyway.',
      ],
      'error',
      plain
    );
    process.exitCode = 1;
    return;
  }

  // ── Step 3: Stage files ───────────────────────────────────────────────────
  const stageSpinner = createSpinner('Staging allowed files', plain);
  const stagedFiles = await stageAllowedFiles(projectRoot, manifest.submission.allowedPaths);
  stageSpinner.succeed(`Staged ${stagedFiles.length} file${stagedFiles.length === 1 ? '' : 's'}`);

  // ── Step 4: Commit & push ─────────────────────────────────────────────────
  const pushSpinner = createSpinner('Committing and pushing', plain);
  await ensureGitIdentity(projectRoot, me.user.username, me.user.email);
  const timestamp = new Date().toISOString();
  const commitMessage = `nibras submit: ${manifest.projectKey} ${timestamp}`;
  const commitSha = await createCommit(projectRoot, commitMessage);
  await pushBranch(projectRoot, manifest.defaultBranch);
  pushSpinner.succeed(`Pushed commit ${commitSha.slice(0, 7)}`);

  // ── Step 5: Prepare submission ────────────────────────────────────────────
  const prepSpinner = createSpinner('Preparing submission', plain);
  const prepared = SubmissionPrepareResponseSchema.parse(
    await apiRequest('/v1/submissions/prepare', {
      method: 'POST',
      body: JSON.stringify({ projectKey: manifest.projectKey, commitSha, repoUrl, branch }),
    })
  );
  await apiRequest(`/v1/submissions/${prepared.submissionId}/local-test-result`, {
    method: 'POST',
    body: JSON.stringify({
      exitCode: testExitCode,
      summary:
        testExitCode === 0
          ? `Tests passed. Submitted ${stagedFiles.length} file(s).`
          : `Tests failed (exit code ${testExitCode}). Submitted ${stagedFiles.length} file(s).`,
      ranPrevious: false,
    }),
  });
  prepSpinner.succeed('Submission registered');

  // ── Step 6: Poll for verification ─────────────────────────────────────────
  const pollProgress = createPollProgress(manifest.submission.waitForVerificationSeconds, plain);
  const deadline = Date.now() + manifest.submission.waitForVerificationSeconds * 1000;
  let lastStatus = '';

  while (Date.now() < deadline) {
    await sleep(1200);
    pollProgress.tick();

    const status = SubmissionStatusResponseSchema.parse(
      await apiRequest(`/v1/submissions/${prepared.submissionId}`)
    );
    lastStatus = status.status;

    if (['passed', 'failed', 'needs_review'].includes(status.status)) {
      const success = status.status === 'passed';
      pollProgress.finish(success);

      if (success) {
        printBox(
          'Submission passed ✓',
          [`Status:  ${status.status}`, `Summary: ${status.summary ?? 'All checks passed'}`],
          'success',
          plain
        );
      } else {
        printBox(
          status.status === 'needs_review' ? 'Under review' : 'Submission failed',
          [
            `Status:  ${status.status}`,
            `Summary: ${status.summary ?? 'See the dashboard for details'}`,
          ],
          status.status === 'needs_review' ? 'warning' : 'error',
          plain
        );
        process.exitCode = 1;
      }
      return;
    }
  }

  pollProgress.finish(false);
  throw new Error(`Timed out waiting for verification (last status: ${lastStatus || 'pending'}).`);
}
