import cliProgress from 'cli-progress';
import picocolors from 'picocolors';

export type PollProgress = {
  tick: () => void;
  finish: (success: boolean) => void;
};

export function createPollProgress(totalSeconds: number, plain: boolean): PollProgress {
  const tickIntervalMs = 1200;
  const totalTicks = Math.ceil((totalSeconds * 1000) / tickIntervalMs);
  let current = 0;

  if (plain || !process.stdout.isTTY) {
    return {
      tick: () => {
        current++;
        const pct = Math.min(Math.round((current / totalTicks) * 100), 99);
        if (current % 5 === 0) process.stdout.write(`  Verifying… ${pct}%\n`);
      },
      finish: (success) =>
        console.log(success ? '✓ Verification complete' : '✗ Verification failed'),
    };
  }

  const bar = new cliProgress.SingleBar(
    {
      format: `  Verifying  ${picocolors.cyan('{bar}')} {percentage}%  {status}`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: false,
    },
    cliProgress.Presets.shades_classic
  );

  bar.start(totalTicks, 0, { status: 'waiting…' });

  return {
    tick: () => {
      current = Math.min(current + 1, totalTicks - 1);
      bar.update(current, { status: 'checking…' });
    },
    finish: (success) => {
      bar.update(totalTicks, {
        status: success
          ? picocolors.green('passed ✓')
          : picocolors.red('failed ✗'),
      });
      bar.stop();
    },
  };
}
