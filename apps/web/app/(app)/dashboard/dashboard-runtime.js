import { loadDashboardData } from './load-dashboard-data.js';

export function normalizeDashboardMode(value) {
  return value === 'student' || value === 'instructor' ? value : null;
}

function getErrorStatus(error) {
  return typeof error?.status === 'number' ? error.status || null : null;
}

export async function loadDashboardRouteData({ fetchJson, requestedMode }) {
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
