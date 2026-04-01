/* eslint-disable @typescript-eslint/no-explicit-any */
import boxen from 'boxen';
import picocolors from 'picocolors';

export type BoxKind = 'success' | 'error' | 'info' | 'warning';

const ICONS: Record<BoxKind, string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  warning: '⚠',
};

const COLORS: Record<BoxKind, (s: string) => string> = {
  success: picocolors.green,
  error: picocolors.red,
  info: picocolors.cyan,
  warning: picocolors.yellow,
};

const BORDER_COLORS: Record<BoxKind, string> = {
  success: 'green',
  error: 'red',
  info: 'cyan',
  warning: 'yellow',
};

export function printBox(
  title: string,
  lines: string[],
  kind: BoxKind,
  plain: boolean
): void {
  if (plain) {
    console.log(`[${kind.toUpperCase()}] ${title}`);
    for (const line of lines) {
      if (line) console.log(`  ${line}`);
    }
    return;
  }

  const colorFn = COLORS[kind];
  const icon = ICONS[kind];
  const header = colorFn(`${icon}  ${title}`);

  const body = lines
    .map((line) => {
      if (!line) return '';
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && colonIdx < 22) {
        const label = picocolors.dim(line.slice(0, colonIdx + 1));
        const value = line.slice(colonIdx + 1);
        return `${label}${value}`;
      }
      return picocolors.dim(line);
    })
    .join('\n');

  const content = body.trim() ? `${header}\n\n${body}` : header;

  // boxen v5: options object — use any cast to avoid strict type errors on borderColor
  const opts: any = {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: BORDER_COLORS[kind],
  };

  console.log(boxen(content, opts));
}
