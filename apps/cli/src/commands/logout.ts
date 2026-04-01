import { apiRequest, clearCliSession, readCliConfig } from '@nibras/core';
import { printBox } from '../ui/box';

export async function commandLogout(plain: boolean): Promise<void> {
  const config = readCliConfig();
  if (config.accessToken) {
    try {
      await apiRequest('/v1/logout', { method: 'POST' });
    } catch {
      // Best effort. Local session still needs to be cleared.
    }
  }
  clearCliSession();
  printBox('Signed out', ['Your local session has been cleared.'], 'info', plain);
}
