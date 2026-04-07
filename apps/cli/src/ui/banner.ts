import gradient from 'gradient-string';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ASCII_ART = [
  '███╗   ██╗██╗██████╗ ██████╗  █████╗ ███████╗',
  '████╗  ██║██║██╔══██╗██╔══██╗██╔══██╗██╔════╝',
  '██╔██╗ ██║██║██████╔╝██████╔╝███████║███████╗',
  '██║╚██╗██║██║██╔══██╗██╔══██╗██╔══██║╚════██║',
  '██║ ╚████║██║██████╔╝██║  ██║██║  ██║███████║',
  '╚═╝  ╚═══╝╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝',
].join('\n');

export function getVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json') as { version: string };
    const gitSha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf8',
    });
    if (gitSha.status === 0 && gitSha.stdout.trim()) {
      return `v${pkg.version}-${gitSha.stdout.trim()}`;
    }
    return `v${pkg.version}`;
  } catch {
    return 'v0.0.0';
  }
}

export function printBanner(plain: boolean): void {
  if (plain) {
    console.log(ASCII_ART);
  } else {
    const nibrasPink = gradient(['#6366f1', '#8b5cf6', '#06b6d4']);
    console.log(nibrasPink(ASCII_ART));
  }
  console.log();
}
