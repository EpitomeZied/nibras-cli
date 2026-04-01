import { PingResponseSchema } from '@nibras/contracts';
import { apiRequest, getOriginUrl, loadProjectManifest } from '@nibras/core';
import boxen from 'boxen';
import picocolors from 'picocolors';

type CheckRow = { label: string; value: string; ok: boolean };

function parseError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function renderPlain(rows: CheckRow[]): void {
  for (const row of rows) {
    const icon = row.ok ? '✓' : '✗';
    console.log(`  ${icon} ${row.label}: ${row.value}`);
  }
}

function renderBox(rows: CheckRow[]): void {
  const labelWidth = Math.max(...rows.map((r) => r.label.length)) + 2;
  const lines = rows.map((row) => {
    const icon = row.ok
      ? picocolors.green('✓')
      : picocolors.red('✗');
    const pad = ' '.repeat(labelWidth - row.label.length);
    const label = picocolors.dim(row.label + ':');
    const value = row.ok
      ? picocolors.green(row.value)
      : picocolors.red(row.value);
    return `${icon}  ${label}${pad}${value}`;
  });

  const allOk = rows.every((r) => r.ok);
  const title = allOk
    ? picocolors.green('● System Status  —  All checks passed')
    : picocolors.yellow('● System Status  —  Some checks failed');

  console.log(
    boxen(`${title}\n\n${lines.join('\n')}`, {
      padding: { top: 0, bottom: 0, left: 1, right: 2 },
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: allOk ? 'green' : 'yellow',
    })
  );
}

export async function commandPing(plain: boolean): Promise<void> {
  const response = PingResponseSchema.parse(await apiRequest('/v1/ping'));

  const rows: CheckRow[] = [
    { label: 'API', value: response.api, ok: response.api === 'reachable' },
    { label: 'Auth', value: response.auth, ok: response.auth === 'valid' },
    { label: 'GitHub', value: response.github, ok: response.github === 'linked' },
    { label: 'GitHub App', value: response.githubApp, ok: response.githubApp === 'installed' },
  ];

  try {
    const { projectRoot, manifest } = loadProjectManifest(process.cwd());
    const origin = await getOriginUrl(projectRoot);
    rows.push({ label: 'Project', value: manifest.projectKey, ok: true });
    rows.push({ label: 'Origin', value: origin, ok: true });
  } catch (err) {
    rows.push({ label: 'Project', value: parseError(err), ok: false });
  }

  if (plain || !process.stdout.isTTY) {
    renderPlain(rows);
  } else {
    renderBox(rows);
  }
}
