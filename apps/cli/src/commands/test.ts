import { spawn } from 'node:child_process';
import { loadProjectManifest } from '@nibras/core';
import picocolors from 'picocolors';

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

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

  const cmd = manifest.test.command + (wantsPrevious ? ' --previous' : '');

  if (!plain && process.stdout.isTTY) {
    console.log();
    console.log(
      `  ${picocolors.dim('Running')}  ${picocolors.cyan(cmd)}`
    );
    console.log();
  }

  const exitCode = await runShellCommand(
    manifest.test.command,
    projectRoot,
    wantsPrevious ? ['--previous'] : []
  );

  if (!plain && process.stdout.isTTY) {
    console.log();
    if (exitCode === 0) {
      console.log(picocolors.green(`  ✓  Tests passed`));
    } else {
      console.log(picocolors.red(`  ✗  Tests failed (exit code ${exitCode})`));
    }
    console.log();
  }

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
