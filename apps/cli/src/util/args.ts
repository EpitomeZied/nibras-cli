/**
 * Shared argument-parsing utilities for CLI commands.
 * Centralised here to avoid copy-paste across every command file.
 */

/**
 * Returns the value that follows `name` in `args`, or null if not found.
 * Example: parseOption(['--api-base-url', 'http://localhost:4848'], '--api-base-url')
 *          → 'http://localhost:4848'
 */
export function parseOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

/**
 * Returns true when `flag` appears anywhere in `args`.
 * Example: hasFlag(['--no-open', '--force'], '--force') → true
 */
export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}
