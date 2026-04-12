import { createSpinner } from '../ui/spinner';
import { printBox } from '../ui/box';
import { uninstallGlobalCli } from './global-install';

export async function commandUninstall(_args: string[], plain: boolean): Promise<void> {
  const spinner = createSpinner('Removing the global CLI install', plain);
  const removedArtifacts = uninstallGlobalCli(plain);
  spinner.succeed('Removed the global CLI install');

  printBox(
    'CLI uninstalled',
    [
      'Removed:   global npm install plus any stale `nibras` link left on disk.',
      removedArtifacts.length > 0
        ? `Cleanup:   deleted ${removedArtifacts.length} leftover path(s).`
        : 'Cleanup:   no leftover install paths were found.',
      'Config:    kept local auth/session files in `~/.config/nibras`.',
      'Next:      run `hash -r` or open a new shell if `nibras` still resolves.',
    ],
    'success',
    plain
  );
}
