import type { DashboardHomeResponse, DashboardMode } from '@nibras/contracts';

export function loadDashboardData(args: {
  fetchJson: (path: string, init?: RequestInit & { auth?: boolean }) => Promise<unknown>;
  mode?: DashboardMode;
}): Promise<DashboardHomeResponse>;
