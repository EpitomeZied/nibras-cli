const test = require("node:test");
const assert = require("node:assert/strict");

test("dashboard data loading skips install-url when GitHub App is not configured", async () => {
  const { loadDashboardData } = await import("../apps/web/app/(app)/dashboard/load-dashboard-data.js");
  const calls = [];

  const payload = await loadDashboardData({
    fetchJson: async (path) => {
      calls.push(path);
      if (path === "/v1/web/session") {
        return { user: { username: "student", githubAppInstalled: false } };
      }
      if (path === "/v1/tracking/dashboard/student") {
        return { projects: [], milestonesByProject: {}, statsByProject: {}, activity: [] };
      }
      if (path === "/v1/github/config") {
        return { configured: false };
      }
      throw new Error(`Unexpected path: ${path}`);
    }
  });

  assert.equal(payload.installUrl, "");
  assert.equal(payload.githubAppMessage, "GitHub App installation is not configured for this deployment.");
  assert.equal(payload.githubAppStatus, "unconfigured");
  assert.equal(calls.includes("/v1/web/session"), true);
  assert.equal(calls.includes("/v1/tracking/dashboard/student"), true);
  assert.equal(calls.includes("/v1/github/config"), true);
  assert.equal(calls.includes("/v1/github/install-url"), false);
});

test("dashboard data loading returns install-url when GitHub App is configured", async () => {
  const { loadDashboardData } = await import("../apps/web/app/(app)/dashboard/load-dashboard-data.js");

  const payload = await loadDashboardData({
    fetchJson: async (path) => {
      if (path === "/v1/web/session") {
        return { user: { username: "student", githubAppInstalled: false } };
      }
      if (path === "/v1/tracking/dashboard/student") {
        return { projects: [{ id: "p1" }], milestonesByProject: {}, statsByProject: {}, activity: [] };
      }
      if (path === "/v1/github/config") {
        return { configured: true, appName: "Nibras" };
      }
      if (path === "/v1/github/install-url") {
        return { installUrl: "https://github.com/apps/nibras/installations/new" };
      }
      throw new Error(`Unexpected path: ${path}`);
    }
  });

  assert.equal(payload.installUrl, "https://github.com/apps/nibras/installations/new");
  assert.equal(payload.githubAppMessage, "");
  assert.equal(payload.githubAppStatus, "configured");
});

test("dashboard data loading preserves the dashboard when install-url fails", async () => {
  const { loadDashboardData } = await import("../apps/web/app/(app)/dashboard/load-dashboard-data.js");

  const payload = await loadDashboardData({
    fetchJson: async (path) => {
      if (path === "/v1/web/session") {
        return { user: { username: "student", githubAppInstalled: false } };
      }
      if (path === "/v1/tracking/dashboard/student") {
        return { projects: [{ id: "p1" }], milestonesByProject: {}, statsByProject: {}, activity: [] };
      }
      if (path === "/v1/github/config") {
        return { configured: true };
      }
      if (path === "/v1/github/install-url") {
        throw new Error("GitHub App is not configured.");
      }
      throw new Error(`Unexpected path: ${path}`);
    }
  });

  assert.deepEqual(payload.dashboard.projects, [{ id: "p1" }]);
  assert.equal(payload.installUrl, "");
  assert.equal(payload.githubAppMessage, "GitHub App is not configured.");
  assert.equal(payload.githubAppStatus, "configured");
});

test("dashboard data loading preserves the dashboard when GitHub config fails", async () => {
  const { loadDashboardData } = await import("../apps/web/app/(app)/dashboard/load-dashboard-data.js");

  const payload = await loadDashboardData({
    fetchJson: async (path) => {
      if (path === "/v1/web/session") {
        return { user: { username: "student", githubAppInstalled: false } };
      }
      if (path === "/v1/tracking/dashboard/student") {
        return { projects: [{ id: "p1" }], milestonesByProject: {}, statsByProject: {}, activity: [] };
      }
      if (path === "/v1/github/config") {
        throw new Error("backend unavailable");
      }
      if (path === "/v1/github/install-url") {
        throw new Error("Unexpected install-url request");
      }
      throw new Error(`Unexpected path: ${path}`);
    }
  });

  assert.deepEqual(payload.dashboard.projects, [{ id: "p1" }]);
  assert.equal(payload.githubConfig, null);
  assert.equal(payload.installUrl, "");
  assert.equal(payload.githubAppMessage, "GitHub App status is temporarily unavailable.");
  assert.equal(payload.githubAppStatus, "unavailable");
});

test("dashboard data loading fails when the session request fails", async () => {
  const { loadDashboardData } = await import("../apps/web/app/(app)/dashboard/load-dashboard-data.js");

  await assert.rejects(
    loadDashboardData({
      fetchJson: async (path) => {
        if (path === "/v1/web/session") {
          throw new Error("Unauthorized");
        }
        if (path === "/v1/tracking/dashboard/student") {
          return { projects: [], milestonesByProject: {}, statsByProject: {}, activity: [] };
        }
        if (path === "/v1/github/config") {
          return { configured: false };
        }
        throw new Error(`Unexpected path: ${path}`);
      }
    }),
    /Unauthorized/
  );
});

test("dashboard data loading fails when the dashboard request fails", async () => {
  const { loadDashboardData } = await import("../apps/web/app/(app)/dashboard/load-dashboard-data.js");

  await assert.rejects(
    loadDashboardData({
      fetchJson: async (path) => {
        if (path === "/v1/web/session") {
          return { user: { username: "student", githubAppInstalled: false } };
        }
        if (path === "/v1/tracking/dashboard/student") {
          throw new Error("Dashboard unavailable");
        }
        if (path === "/v1/github/config") {
          return { configured: true };
        }
        throw new Error(`Unexpected path: ${path}`);
      }
    }),
    /Dashboard unavailable/
  );
});
