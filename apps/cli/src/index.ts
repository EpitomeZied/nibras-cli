#!/usr/bin/env node
import path from 'node:path';
import { ApiError } from '@nibras/core';
import { printBanner, getVersion } from './ui/banner';
import { printCommandTable } from './ui/table';
import { commandLogin } from './commands/login';
import { commandLogout } from './commands/logout';
import { commandWhoami } from './commands/whoami';
import { commandPing } from './commands/ping';
import { commandTask } from './commands/task';
import { commandTest } from './commands/test';
import { commandSetup } from './commands/setup';
import { commandUpdate } from './commands/update';
import { commandUninstall } from './commands/uninstall';
import { commandUpdateBuildpack } from './commands/update-buildpack';
import { commandSubmit } from './commands/submit';
import picocolors from 'picocolors';

function isPlainMode(args: string[]): boolean {
  return args.includes('--plain') || process.env.NO_COLOR === '1' || !process.stdout.isTTY;
}

function parseError(err: unknown): string {
  if (err instanceof ApiError) return err.bodyText || err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

function printHelp(plain: boolean): void {
  printBanner(plain);

  console.log('  CLI to interact with Nibras\n');

  console.log('  USAGE\n');
  console.log('    nibras [command] [flags]\n');

  console.log('  COMMANDS\n');
  printCommandTable(
    [
      { name: 'login', description: 'Start device login against the hosted API' },
      { name: 'logout', description: 'Clear the local CLI session' },
      { name: 'whoami', description: 'Show the signed-in user and linked GitHub account' },
      { name: 'test', description: 'Run project-local public tests' },
      {
        name: 'submit',
        description: 'Commit tracked solution files, push, and wait for verification',
      },
      { name: 'task', description: 'View current task instructions' },
      { name: 'setup', description: 'Bootstrap a local project manifest from the API' },
      { name: 'update', description: 'Update the installed CLI to the latest release' },
      { name: 'uninstall', description: 'Remove the global CLI install from this machine' },
      { name: 'ping', description: 'Verify API, auth, GitHub linkage, and repo state' },
      { name: 'update-buildpack', description: 'Update Node version in .nibras/project.json' },
      { name: 'legacy', description: 'Run the existing subject/project CLI' },
    ],
    plain
  );

  console.log();
  console.log('  FLAGS\n');
  printCommandTable(
    [
      { name: '--plain', description: 'Disable colours and spinners' },
      { name: '--help, -h', description: 'Show this help message' },
      { name: '--version, -v', description: 'Print version' },
    ],
    plain
  );

  console.log();
  console.log('  VERSION\n');
  console.log(`    ${getVersion()}\n`);
}

function isLegacyInvocation(args: string[]): boolean {
  if (args.length === 0) return false;
  const knownCommands = new Set([
    'login',
    'logout',
    'whoami',
    'test',
    'submit',
    'task',
    'setup',
    'update',
    'uninstall',
    'ping',
    'update-buildpack',
    'help',
    'legacy',
    '--help',
    '-h',
    '--version',
    '-v',
    'version',
  ]);
  return !knownCommands.has(args[0]) && args.length >= 3;
}

async function runLegacyCli(argv: string[]): Promise<void> {
  const legacyPath = path.resolve(__dirname, '../../../src/cli.js');
  const legacy = require(legacyPath) as { run: (argv: string[]) => Promise<void> };
  await legacy.run(argv);
}

// Self-invoke when run as the bin entry point
if (require.main === module) {
  void runCli(process.argv);
}

export async function runCli(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  const plain = isPlainMode(args);
  const normalizedArgs = args.filter((arg) => arg !== '--plain');

  if (
    normalizedArgs.length === 0 ||
    normalizedArgs[0] === 'help' ||
    normalizedArgs[0] === '--help' ||
    normalizedArgs[0] === '-h'
  ) {
    printHelp(plain);
    return;
  }

  if (
    normalizedArgs[0] === '--version' ||
    normalizedArgs[0] === '-v' ||
    normalizedArgs[0] === 'version'
  ) {
    console.log(getVersion());
    return;
  }

  if (normalizedArgs[0] === 'legacy') {
    await runLegacyCli(['node', 'nibras', ...normalizedArgs.slice(1)]);
    return;
  }

  if (isLegacyInvocation(normalizedArgs)) {
    await runLegacyCli(argv);
    return;
  }

  const command = normalizedArgs[0];
  const rest = normalizedArgs.slice(1);

  try {
    if (command === 'login') {
      await commandLogin(rest, plain);
      return;
    }
    if (command === 'logout') {
      await commandLogout(plain);
      return;
    }
    if (command === 'whoami') {
      await commandWhoami(plain);
      return;
    }
    if (command === 'ping') {
      await commandPing(plain);
      return;
    }
    if (command === 'task') {
      await commandTask(plain);
      return;
    }
    if (command === 'test') {
      await commandTest(rest, plain);
      return;
    }
    if (command === 'setup') {
      await commandSetup(rest, plain);
      return;
    }
    if (command === 'update-buildpack') {
      await commandUpdateBuildpack(rest, plain);
      return;
    }
    if (command === 'update') {
      await commandUpdate(rest, plain);
      return;
    }
    if (command === 'uninstall') {
      await commandUninstall(rest, plain);
      return;
    }
    if (command === 'submit') {
      await commandSubmit(plain, rest);
      return;
    }
    throw new Error(`Unknown command "${command}". Run \`nibras --help\` for available commands.`);
  } catch (err) {
    if (!plain && process.stdout.isTTY) {
      console.error('\n  ' + picocolors.red('✗  ' + parseError(err)) + '\n');
    } else {
      console.error(parseError(err));
    }
    process.exitCode = process.exitCode || 1;
  }
}
