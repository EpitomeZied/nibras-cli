import ora, { Ora } from 'ora';

export type Spinner = {
  text: (msg: string) => void;
  succeed: (msg?: string) => void;
  fail: (msg?: string) => void;
  warn: (msg?: string) => void;
  stop: () => void;
};

function noopSpinner(initial: string): Spinner {
  process.stdout.write(`  ${initial}…\n`);
  return {
    text: (msg) => process.stdout.write(`  ${msg}…\n`),
    succeed: (msg) => console.log(`✓ ${msg ?? ''}`),
    fail: (msg) => console.error(`✗ ${msg ?? ''}`),
    warn: (msg) => console.warn(`⚠ ${msg ?? ''}`),
    stop: () => undefined,
  };
}

export function createSpinner(text: string, plain: boolean): Spinner {
  if (plain || !process.stdout.isTTY) {
    return noopSpinner(text);
  }

  const spinner: Ora = ora({
    text,
    spinner: 'dots',
    color: 'cyan',
  }).start();

  return {
    text: (msg) => {
      spinner.text = msg;
    },
    succeed: (msg) => spinner.succeed(msg),
    fail: (msg) => spinner.fail(msg),
    warn: (msg) => spinner.warn(msg),
    stop: () => spinner.stop(),
  };
}
