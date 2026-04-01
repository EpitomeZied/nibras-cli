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

export async function commandSetup(args: string[], plain: boolean): Promise<void> {
  const projectKey = parseOption(args, '--project');
  if (!projectKey) {
    throw new Error('setup requires --project <subject/project>.');
  }

  const targetDir = path.resolve(parseOption(args, '--dir') || process.cwd());
  const spinner = createSpinner(`Setting up project ${projectKey}`, plain);

  const response = ProjectSetupResponseSchema.parse(
    await apiRequest(`/v1/projects/${encodeURIComponent(projectKey)}/setup`, {
      method: 'POST',
    })
  );

  spinner.text('Writing project manifest');
  fs.mkdirSync(path.join(targetDir, '.nibras'), { recursive: true });
  writeProjectManifest(targetDir, response.manifest);
  writeTaskText(targetDir, response.task);

  if (!fs.existsSync(path.join(targetDir, '.git'))) {
    spinner.text('Initialising git repository');
    spawnSync('git', ['init', '-b', response.repo.defaultBranch], {
      cwd: targetDir,
      stdio: 'ignore',
    });
  }

  spinner.succeed('Project set up');
  printBox(
    `Project ready: ${response.projectKey}`,
    [
      `Project: ${response.projectKey}`,
      `Repo:    ${response.repo.owner}/${response.repo.name}`,
      `Dir:     ${targetDir}`,
      ``,
      `Next steps:`,
      `  nibras task     — view task instructions`,
      `  nibras test     — run local tests`,
      `  nibras submit   — submit your solution`,
    ],
    'success',
    plain
  );
}
