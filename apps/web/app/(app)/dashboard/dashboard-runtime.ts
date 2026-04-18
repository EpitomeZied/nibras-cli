import type { DashboardHomeResponse, DashboardMode } from '@nibras/contracts';
import { loadDashboardData } from './load-dashboard-data.js';

type FetchJson = (path: string, init?: RequestInit & { auth?: boolean }) => Promise<unknown>;

type DashboardRequestError = Error & { status?: number };

export type DashboardRouteLoadResult = {
  dashboard: DashboardHomeResponse;
  activeMode: DashboardMode;
  requestedMode: DashboardMode | null;
  resetModeQuery: boolean;
};

export function normalizeDashboardMode(value: string | null | undefined): DashboardMode | null {
  return value === 'student' || value === 'instructor' ? value : null;
}

function getErrorStatus(error: unknown): number | null {
  return typeof (error as DashboardRequestError | null)?.status === 'number'
    ? (error as DashboardRequestError).status || null
    : null;
}

export async function loadDashboardRouteData({
  fetchJson,
  requestedMode,
}: {
  fetchJson: FetchJson;
  requestedMode?: string | null;
}): Promise<DashboardRouteLoadResult> {
  const normalizedMode = normalizeDashboardMode(requestedMode);
  const shouldResetInvalidMode = requestedMode != null && normalizedMode == null;

  try {
    const dashboard = await loadDashboardData({
      fetchJson,
      mode: normalizedMode ?? undefined,
    });
    return {
      dashboard,
      activeMode: dashboard.defaultMode,
      requestedMode: normalizedMode,
      resetModeQuery: shouldResetInvalidMode,
    };
  } catch (error) {
    if (normalizedMode && getErrorStatus(error) === 403) {
      const dashboard = await loadDashboardData({ fetchJson });
      return {
        dashboard,
        activeMode: dashboard.defaultMode,
        requestedMode: null,
        resetModeQuery: true,
      };
    }
    throw error;
  }
}
