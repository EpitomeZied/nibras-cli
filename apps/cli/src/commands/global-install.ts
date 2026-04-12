import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function readNpmValue(args: string[]): string | null {
  const result = spawnSync(npmCommand(), args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) {
    return null;
  }
  const value = result.stdout.trim();
  return value === '' ? null : value;
}

function removePathIfPresent(targetPath: string, removed: string[]): void {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
  removed.push(targetPath);
}

export function runGlobalNpm(args: string[], plain: boolean): void {
  const result = spawnSync(npmCommand(), args, {
    stdio: plain ? 'inherit' : 'ignore',
  });
  if (result.status !== 0) {
    throw new Error(`npm ${args[0]} failed.`);
  }
}

export function cleanupGlobalCliArtifacts(): string[] {
  const removed: string[] = [];
  const prefix = readNpmValue(['config', 'get', 'prefix']);
  const globalRoot = readNpmValue(['root', '-g']);

  if (prefix) {
    if (process.platform === 'win32') {
      removePathIfPresent(path.join(prefix, 'nibras.cmd'), removed);
      removePathIfPresent(path.join(prefix, 'nibras'), removed);
    } else {
      removePathIfPresent(path.join(prefix, 'bin', 'nibras'), removed);
    }
  }

  if (globalRoot) {
    removePathIfPresent(path.join(globalRoot, 'nibras'), removed);
    removePathIfPresent(path.join(globalRoot, '@nibras', 'cli'), removed);
  }

  return removed;
}

export function uninstallGlobalCli(plain: boolean): string[] {
  try {
    runGlobalNpm(['uninstall', '-g', 'nibras', '@nibras/cli'], plain);
  } catch {
    // Best effort only: users may be running a linked checkout or a partial install.
  }
  return cleanupGlobalCliArtifacts();
}
