export async function loadDashboardData({ fetchJson, mode }) {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : '';
  return await fetchJson(`/v1/tracking/dashboard/home${query}`, {
    auth: true,
  });
}
