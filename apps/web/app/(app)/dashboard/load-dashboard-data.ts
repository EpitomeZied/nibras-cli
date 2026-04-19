import type { DashboardHomeResponse, DashboardMode } from '@nibras/contracts';

type FetchJson = (path: string, init?: RequestInit & { auth?: boolean }) => Promise<unknown>;

export async function loadDashboardData({
  fetchJson,
  mode,
}: {
  fetchJson: FetchJson;
  mode?: DashboardMode;
}): Promise<DashboardHomeResponse> {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : '';
  return (await fetchJson(`/v1/tracking/dashboard/home${query}`, {
    auth: true,
  })) as DashboardHomeResponse;
}
