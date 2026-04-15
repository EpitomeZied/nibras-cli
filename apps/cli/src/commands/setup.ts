import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ProjectSetupResponseSchema } from '@nibras/contracts';
import JSZip from 'jszip';
import {
  apiRequest,
  ensureGitIdentity,
  readCliConfig,
  writeProjectManifest,
  writeTaskText,
} from '@nibras/core';
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

function gitHasRemote(cwd: string): boolean {
  return (
    spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      stdio: 'pipe',
    }).status === 0
  );
}

function gitHasHeadCommit(cwd: string): boolean {
  return (
    spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd,
      stdio: 'ignore',
    }).status === 0
  );
}

function gitHasStagedChanges(cwd: string): boolean {
  return (
    spawnSync('git', ['diff', '--cached', '--quiet'], {
      cwd,
      stdio: 'ignore',
    }).status !== 0
  );
}

function tryCreateGitHubRepoWithGh(repoFullName: string, projectDir: string): boolean {
  return (
    spawnSync(
      'gh',
      ['repo', 'create', repoFullName, '--private', '--push', '--source', projectDir],
      { stdio: 'ignore' }
    ).status === 0
  );
}

async function downloadStarterBundle(downloadUrl: string): Promise<Buffer> {
  const config = readCliConfig();
  const headers = new Headers();
  if (config.accessToken) {
    headers.set('authorization', `Bearer ${config.accessToken}`);
  }
  const response = await fetch(downloadUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download starter bundle (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function extractZipArchive(archive: Buffer, destinationDir: string): Promise<void> {
  const zip = await JSZip.loadAsync(archive);
  for (const [entryName, entry] of Object.entries(zip.files)) {
    const normalized = path.posix.normalize(entryName);
    if (
      !normalized ||
      normalized === '.' ||
      normalized.startsWith('../') ||
      normalized.includes('/../')
    ) {
      throw new Error(`Unsafe path in starter bundle: ${entryName}`);
    }
    const targetPath = path.join(destinationDir, normalized);
    if (entry.dir) {
      fs.mkdirSync(targetPath, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, await entry.async('nodebuffer'));
  }
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
  const starter = response.starter ?? { kind: 'none' as const };
  const repoName = response.repo.name;
  const repoFullName = `${response.repo.owner}/${repoName}`;
  const defaultBranch = response.repo.defaultBranch;
  const studentRepoUrl = `https://github.com/${repoFullName}.git`;
  const remoteOriginUrl = cloneUrl ?? studentRepoUrl;

  // Determine the final project directory:
  //   - If --dir was explicitly given, use it as-is
  //   - Otherwise always create a named subdirectory (nibras-<project>)
  const projectDir = explicitDir ? baseDir : path.join(baseDir, repoName);
  const alreadyHasGit = fs.existsSync(path.join(projectDir, '.git'));
  const shouldSkipStarterRestore = alreadyHasGit;

  fs.mkdirSync(projectDir, { recursive: true });

  if (starter.kind === 'bundle' && !shouldSkipStarterRestore) {
    spinner.text('Initialising git repository');
    git(['init', '-b', defaultBranch], projectDir);
    spinner.text(`Downloading ${starter.fileName}`);
    const archive = await downloadStarterBundle(starter.downloadUrl);
    spinner.text('Extracting starter bundle');
    await extractZipArchive(archive, projectDir);
  } else if (isGitHubUrl(cloneUrl) && !alreadyHasGit && starter.kind !== 'bundle') {
    // ── Student's personal repo was provisioned — clone it directly ───────
    spinner.text(`Cloning ${repoFullName}`);
    if (!git(['clone', cloneUrl, projectDir], baseDir)) {
      spinner.text('Clone failed, initialising git repository');
      git(['init', '-b', defaultBranch], projectDir);
    }
  } else if (
    starter.kind === 'github-template' &&
    isGitHubUrl(starter.cloneUrl) &&
    !shouldSkipStarterRestore
  ) {
    spinner.text('Cloning starter template');
    const cloned = git(['clone', starter.cloneUrl, projectDir], baseDir);
    if (!cloned) {
      spinner.text('Template clone failed, initialising git repository');
      git(['init', '-b', defaultBranch], projectDir);
    } else {
      git(['remote', 'remove', 'origin'], projectDir);
      git(['checkout', '-B', defaultBranch], projectDir);
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
  if (!gitHasRemote(projectDir)) {
    git(['remote', 'add', 'origin', remoteOriginUrl], projectDir);
  }

  // ── Push initial commit to GitHub if repo was just provisioned ────────────
  if (starter.kind === 'bundle' && !shouldSkipStarterRestore) {
    await ensureGitIdentity(projectDir, 'Nibras CLI', 'noreply@nibras.dev');
    git(['add', '.'], projectDir);
    if (gitHasStagedChanges(projectDir)) {
      git(['commit', '-m', 'nibras: initialize project'], projectDir);
    }
    if (cloneUrl) {
      spinner.text(`Pushing ${defaultBranch} to ${repoFullName}`);
      git(['push', '-u', 'origin', defaultBranch], projectDir);
    } else if (isGitHubUrl(remoteOriginUrl)) {
      spinner.text(`Creating repository ${repoFullName} on GitHub`);
      const ghCreated = tryCreateGitHubRepoWithGh(repoFullName, projectDir);
      if (!ghCreated) {
        const pushed = git(['push', '-u', 'origin', defaultBranch], projectDir);
        if (!pushed) {
          spinner.text('');
          if (!plain) {
            console.log(
              `\n  Run: gh repo create ${repoFullName} --private --push --source ${projectDir}\n`
            );
          }
        }
      }
    }
  } else if (isGitHubUrl(cloneUrl)) {
    // Already cloned from the real repo — nothing to push
  } else if (
    (starter.kind === 'github-template' && isGitHubUrl(starter.cloneUrl)) ||
    isGitHubUrl(templateCloneUrl)
  ) {
    // Stage and commit any manifest changes before pushing
    await ensureGitIdentity(projectDir, 'Nibras CLI', 'noreply@nibras.dev');
    git(['add', '.nibras/'], projectDir);
    if (gitHasStagedChanges(projectDir)) {
      git(['commit', '-m', 'nibras: add project manifest'], projectDir);
    }

    // Try to create the GitHub repo via `gh` CLI (most reliable cross-platform)
    spinner.text(`Creating repository ${repoFullName} on GitHub`);
    if (!tryCreateGitHubRepoWithGh(repoFullName, projectDir)) {
      // gh CLI not available or failed — try plain git push (works if repo already exists)
      const pushed = git(['push', '-u', 'origin', defaultBranch], projectDir);
      if (!pushed) {
        // Last resort: print instructions
        spinner.text('');
        if (!plain) {
          console.log(
            `\n  Run: gh repo create ${repoFullName} --private --push --source ${projectDir}\n`
          );
        }
      }
    }
  } else if (alreadyHasGit && !gitHasHeadCommit(projectDir)) {
    await ensureGitIdentity(projectDir, 'Nibras CLI', 'noreply@nibras.dev');
    git(['add', '.nibras/'], projectDir);
    if (gitHasStagedChanges(projectDir)) {
      git(['commit', '-m', 'nibras: add project manifest'], projectDir);
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
