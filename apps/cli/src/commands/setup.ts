import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ProjectSetupResponseSchema } from '@nibras/contracts';
import { apiRequest, writeProjectManifest, writeTaskText } from '@nibras/core';
import { createSpinner } from '../ui/spinner';
import { printBox } from '../ui/box';

function parseOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function isGitHubUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return url.startsWith('https://github.com/') || url.startsWith('git@github.com:');
}

function git(args: string[], cwd: string): boolean {
  const result = spawnSync('git', args, { cwd, stdio: 'ignore' });
  return result.status === 0;
}

export async function commandSetup(args: string[], plain: boolean): Promise<void> {
  const projectKey = parseOption(args, '--project');
  if (!projectKey) {
    throw new Error('setup requires --project <subject/project>.');
  }

  const explicitDir = parseOption(args, '--dir');
  const baseDir = path.resolve(explicitDir || process.cwd());
  const spinner = createSpinner(`Setting up project ${projectKey}`, plain);

  const response = ProjectSetupResponseSchema.parse(
    await apiRequest(`/v1/projects/${encodeURIComponent(projectKey)}/setup`, {
      method: 'POST',
    })
  );

  const cloneUrl = response.repo.cloneUrl;
  const templateCloneUrl = response.templateCloneUrl ?? null;
  const repoName = response.repo.name;
  const repoFullName = `${response.repo.owner}/${repoName}`;
  const defaultBranch = response.repo.defaultBranch;
  const studentRepoUrl = `https://github.com/${repoFullName}.git`;

  // Determine the final project directory:
  //   - If --dir was explicitly given, use it as-is
  //   - Otherwise always create a named subdirectory (nibras-<project>)
  const projectDir = explicitDir ? baseDir : path.join(baseDir, repoName);
  const alreadyHasGit = fs.existsSync(path.join(projectDir, '.git'));

  fs.mkdirSync(projectDir, { recursive: true });

  if (isGitHubUrl(cloneUrl) && !alreadyHasGit) {
    // ── Student's personal repo was provisioned — clone it directly ───────
    spinner.text(`Cloning ${repoFullName}`);
    if (!git(['clone', cloneUrl, projectDir], baseDir)) {
      spinner.text('Clone failed, initialising git repository');
      git(['init', '-b', defaultBranch], projectDir);
    }
  } else if (isGitHubUrl(templateCloneUrl) && !alreadyHasGit) {
    // ── Clone template as starter, then wire up the student's remote ──────
    spinner.text('Cloning starter template');
    const cloned = git(['clone', templateCloneUrl, projectDir], baseDir);
    if (!cloned) {
      spinner.text('Template clone failed, initialising git repository');
      git(['init', '-b', defaultBranch], projectDir);
    } else {
      // Detach from template remote
      git(['remote', 'remove', 'origin'], projectDir);
      // Set branch to match project default
      git(['checkout', '-B', defaultBranch], projectDir);
    }
  } else if (!alreadyHasGit) {
    // ── No template — bare git init ───────────────────────────────────────
    spinner.text('Initialising git repository');
    git(['init', '-b', defaultBranch], projectDir);
  }

  // ── Write manifest and task ───────────────────────────────────────────────
  spinner.text('Writing project manifest');
  fs.mkdirSync(path.join(projectDir, '.nibras'), { recursive: true });
  writeProjectManifest(projectDir, response.manifest);
  writeTaskText(projectDir, response.task);

  // ── Set git remote to the student's GitHub repo ───────────────────────────
  const hasRemote =
    spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd: projectDir,
      stdio: 'pipe',
    }).status === 0;

  if (!hasRemote) {
    git(['remote', 'add', 'origin', studentRepoUrl], projectDir);
  }

  // ── Push initial commit to GitHub if repo was just provisioned ────────────
  if (isGitHubUrl(cloneUrl)) {
    // Already cloned from the real repo — nothing to push
  } else if (isGitHubUrl(templateCloneUrl)) {
    // Stage and commit any manifest changes before pushing
    git(['add', '.nibras/'], projectDir);
    const hasStagedChanges =
      spawnSync('git', ['diff', '--cached', '--quiet'], {
        cwd: projectDir,
        stdio: 'ignore',
      }).status !== 0;
    if (hasStagedChanges) {
      git(['commit', '-m', 'nibras: add project manifest'], projectDir);
    }

    spinner.text(`Pushing ${repoFullName}`);
    const pushed = git(['push', '-u', 'origin', defaultBranch], projectDir);
    if (!pushed) {
      spinner.text(`Creating repository ${repoFullName} on GitHub`);
      const ghCreate = spawnSync(
        'gh',
        ['repo', 'create', repoFullName, '--private', '--push', '--source', projectDir],
        { stdio: 'ignore' }
      );

      if (ghCreate.status !== 0) {
        const pushedAfterCreate = git(['push', '-u', 'origin', defaultBranch], projectDir);
        if (!pushedAfterCreate) {
          spinner.text('');
          if (!plain) {
            console.log(
              `\n  Run: gh repo create ${repoFullName} --private --push --source ${projectDir}\n`
            );
          }
        }
      }
    }
  }

  spinner.succeed('Project set up');

  const relDir = path.relative(process.cwd(), projectDir) || '.';
  const isSubdir = relDir !== '.';

  printBox(
    `Project ready: ${response.projectKey}`,
    [
      `Project: ${response.projectKey}`,
      `Repo:    ${repoFullName}`,
      `Dir:     ${projectDir}`,
      ``,
      `Next steps:`,
      ...(isSubdir ? [`  cd ${relDir}`] : []),
      `  nibras task     — view task instructions`,
      `  nibras test     — run local tests`,
      `  nibras submit   — submit your solution`,
    ],
    'success',
    plain
  );
}
