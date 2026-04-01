import picocolors from 'picocolors';

export type TableRow = {
  label: string;
  value: string;
  hint?: string;
};

/** Print an aligned two-column table */
export function printTable(rows: TableRow[], plain: boolean): void {
  const labelWidth = Math.max(...rows.map((r) => r.label.length)) + 2;
  for (const row of rows) {
    const pad = ' '.repeat(labelWidth - row.label.length);
    const label = plain ? row.label : picocolors.dim(row.label);
    const value = plain ? row.value : picocolors.white(row.value);
    const hint = row.hint
      ? '  ' + (plain ? row.hint : picocolors.dim(row.hint))
      : '';
    console.log(`  ${label}${pad}${value}${hint}`);
  }
}

/** Print a command help table */
export function printCommandTable(
  commands: Array<{ name: string; description: string }>,
  plain: boolean
): void {
  const nameWidth = Math.max(...commands.map((c) => c.name.length)) + 4;
  for (const cmd of commands) {
    const pad = ' '.repeat(nameWidth - cmd.name.length);
    const name = plain ? cmd.name : picocolors.cyan(cmd.name);
    const desc = plain ? cmd.description : picocolors.dim(cmd.description);
    console.log(`  ${name}${pad}${desc}`);
  }
}
