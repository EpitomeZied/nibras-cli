import { spawn } from 'node:child_process';
import { buildProjectTestCommand, loadProjectManifest } from '@nibras/core';
import picocolors from 'picocolors';
import { printBox } from '../ui/box';
import { hasFlag } from '../util/args';

function runShellCommand(command: string, cwd: string, extraArgs: string[]): Promise<number> {
  const fullCommand = extraArgs.length > 0 ? `${command} ${extraArgs.join(' ')}` : command;
  return new Promise((resolve, reject) => {
    const child = spawn(fullCommand, { cwd, shell: true, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code || 0));
  });
}

export async function commandTest(args: string[], plain: boolean): Promise<void> {
  const { projectRoot, manifest } = loadProjectManifest(process.cwd());
  const wantsPrevious = hasFlag(args, '--previous');

  if (wantsPrevious && !manifest.test.supportsPrevious) {
    throw new Error('This project does not support --previous.');
  }

  const cmd = buildProjectTestCommand(
    manifest.test,
    process.platform,
    wantsPrevious ? ['--previous'] : []
  );

  if (!plain && process.stdout.isTTY) {
    console.log();
    console.log(`  ${picocolors.dim('Running')}  ${picocolors.cyan(cmd)}`);
    console.log();
  }

  const exitCode = await runShellCommand(cmd, projectRoot, []);

  if (!plain && process.stdout.isTTY) {
    console.log();
    if (exitCode === 0) {
      printBox('Local tests passed', [`Command: ${cmd}`, `Exit code: 0`], 'success', plain);
    } else {
      printBox('Local tests failed', [`Command: ${cmd}`, `Exit code: ${exitCode}`], 'error', plain);
      process.exitCode = exitCode;
    }
  } else if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
