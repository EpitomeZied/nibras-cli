import { loadProjectManifest, writeProjectManifest } from '@nibras/core';
import { printBox } from '../ui/box';

function parseOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

export async function commandUpdateBuildpack(args: string[], plain: boolean): Promise<void> {
  const version = parseOption(args, '--node') || '20';
  const { projectRoot, manifest } = loadProjectManifest(process.cwd());
  manifest.buildpack.node = version;
  writeProjectManifest(projectRoot, manifest);

  printBox(
    'Buildpack updated',
    [`Node version: ${version}`, `Manifest:     .nibras/project.json`],
    'success',
    plain
  );
}
