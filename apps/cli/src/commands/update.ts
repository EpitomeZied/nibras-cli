import { spawnSync } from 'node:child_process';
import { createSpinner } from '../ui/spinner';
import { printBox } from '../ui/box';

const DEFAULT_RELEASE_API_URL = 'https://api.github.com/repos/NibrasPlatform/nibras-cli/releases/latest';
const DEFAULT_GIT_INSTALL_URL = 'git+https://github.com/NibrasPlatform/nibras-cli.git';

function parseOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function normalizeTag(value: string): string {
  return value.startsWith('v') ? value : `v${value}`;
}

function getInstalledVersion(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json') as { version?: string };
    return pkg.version ? normalizeTag(pkg.version) : null;
  } catch {
    return null;
  }
}

async function resolveTargetTag(args: string[]): Promise<string> {
  const explicit = parseOption(args, '--version');
  if (explicit) {
    return normalizeTag(explicit);
  }

  const releaseUrl = process.env.NIBRAS_UPDATE_RELEASE_URL || DEFAULT_RELEASE_API_URL;
  const response = await fetch(releaseUrl, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'nibras-cli',
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to check the latest CLI release (${response.status}). Run \`nibras update --version <tag>\`.`
    );
  }
  const payload = (await response.json()) as { tag_name?: unknown };
  if (typeof payload.tag_name !== 'string' || payload.tag_name.trim() === '') {
    throw new Error('Latest release did not include a tag name.');
  }
  return normalizeTag(payload.tag_name.trim());
}

function runNpm(args: string[], plain: boolean): void {
  const result = spawnSync(npmCommand(), args, {
    stdio: plain ? 'inherit' : 'ignore',
  });
  if (result.status !== 0) {
    throw new Error(`npm ${args[0]} failed.`);
  }
}

export async function commandUpdate(args: string[], plain: boolean): Promise<void> {
  const spinner = createSpinner('Checking for the latest CLI release', plain);
  const targetTag = await resolveTargetTag(args);
  const currentTag = getInstalledVersion();
  const checkOnly = hasFlag(args, '--check');
  const force = hasFlag(args, '--force');

  if (checkOnly) {
    spinner.stop();
    printBox(
      currentTag === targetTag ? 'CLI is up to date' : 'CLI update available',
      [`Installed: ${currentTag ?? 'unknown'}`, `Latest:    ${targetTag}`],
      currentTag === targetTag ? 'success' : 'warning',
      plain
    );
    return;
  }

  if (currentTag === targetTag && !force) {
    spinner.stop();
    printBox(
      'CLI is already on the latest release',
      [`Installed: ${currentTag}`, `Latest:    ${targetTag}`, 'Tip: run `nibras update --force` to reinstall it.'],
      'info',
      plain
    );
    return;
  }

  const installUrl = `${process.env.NIBRAS_UPDATE_GIT_URL || DEFAULT_GIT_INSTALL_URL}#${targetTag}`;

  spinner.text('Removing any existing global CLI install');
  try {
    runNpm(['uninstall', '-g', 'nibras', '@nibras/cli'], plain);
  } catch {
    // Best effort only: users may be running a linked checkout or a partial install.
  }

  spinner.text(`Installing ${targetTag}`);
  runNpm(['install', '-g', installUrl], plain);
  spinner.succeed(`Updated to ${targetTag}`);

  printBox(
    'CLI updated',
    [`Installed: ${targetTag}`, `Source:    ${installUrl}`, 'Next:      run `nibras --version` to confirm the active binary.'],
    'success',
    plain
  );
}
