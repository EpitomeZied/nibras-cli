export const MAX_LEVEL = 4;

export const LEVEL_NAMES: Record<number, string> = {
  1: 'Freshman',
  2: 'Sophomore',
  3: 'Junior',
  4: 'Senior',
};

/** "Year 2 · Sophomore" */
export function getLevelLabel(level: number): string {
  return `Year ${level} · ${LEVEL_NAMES[level] ?? `Level ${level}`}`;
}

/** Short name for badges: "Freshman", "Sophomore", etc. */
export function getLevelName(level: number): string {
  return LEVEL_NAMES[level] ?? `Level ${level}`;
}

/** CSS module class suffix — clamped 1–4 */
export function getLevelBadgeSuffix(level: number): string {
  return String(Math.min(Math.max(level, 1), MAX_LEVEL));
}
