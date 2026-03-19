const test = require("node:test");
const assert = require("node:assert/strict");

test("web session discovery prefers a reachable same-origin API", async () => {
  const { discoverApiBaseUrlWith } = await import("../apps/web/app/lib/session-core.js");
  const attempted = [];
  const stored = [];

  const apiBaseUrl = await discoverApiBaseUrlWith({
    pageOrigin: "https://nibras.example",
    storedApiBaseUrl: "https://api.example",
    configuredApiBaseUrl: "https://fallback.example",
    probe: async (candidate) => {
      attempted.push(candidate);
      return candidate === "https://nibras.example";
    },
    persistApiBaseUrl: async (candidate) => {
      stored.push(candidate);
    }
  });

  assert.equal(apiBaseUrl, "https://nibras.example");
  assert.deepEqual(attempted, ["https://nibras.example"]);
  assert.deepEqual(stored, ["https://nibras.example"]);
});

test("web session discovery falls back to the stored local API when same-origin is unreachable", async () => {
  const { discoverApiBaseUrlWith } = await import("../apps/web/app/lib/session-core.js");
  const attempted = [];

  const apiBaseUrl = await discoverApiBaseUrlWith({
    pageOrigin: "http://127.0.0.1:3000",
    storedApiBaseUrl: "http://127.0.0.1:4848",
    configuredApiBaseUrl: "https://stale.example",
    probe: async (candidate) => {
      attempted.push(candidate);
      return candidate === "http://127.0.0.1:4848";
    }
  });

  assert.equal(apiBaseUrl, "http://127.0.0.1:4848");
  assert.deepEqual(attempted, ["http://127.0.0.1:3000", "http://127.0.0.1:4848"]);
});

test("web session discovery ignores loopback storage on a public HTTPS origin", async () => {
  const { discoverApiBaseUrlWith } = await import("../apps/web/app/lib/session-core.js");
  const attempted = [];

  const apiBaseUrl = await discoverApiBaseUrlWith({
    pageOrigin: "https://nibras.example",
    storedApiBaseUrl: "http://127.0.0.1:4848",
    configuredApiBaseUrl: "https://api.example",
    probe: async (candidate) => {
      attempted.push(candidate);
      return candidate === "https://api.example";
    }
  });

  assert.equal(apiBaseUrl, "https://api.example");
  assert.deepEqual(attempted, ["https://nibras.example", "https://api.example"]);
});

test("web session discovery surfaces actionable guidance when no API base is reachable", async () => {
  const { discoverApiBaseUrlWith } = await import("../apps/web/app/lib/session-core.js");

  await assert.rejects(() => discoverApiBaseUrlWith({
    pageOrigin: "https://nibras.example",
    storedApiBaseUrl: "https://api.example",
    configuredApiBaseUrl: "https://fallback.example",
    probe: async () => false
  }), (error) => {
    assert.match(error.message, /Unable to reach the Nibras API/);
    assert.match(error.message, /https:\/\/nibras\.example, https:\/\/api\.example, https:\/\/fallback\.example/);
    assert.match(error.message, /npm run api:dev/);
    assert.match(error.message, /npm run proxy:dev/);
    assert.match(error.message, /update `.env` and your tunnel URL/);
    return true;
  });
});

test("web apiFetch surfaces JSON API errors directly", async () => {
  const { apiFetchWith } = await import("../apps/web/app/lib/session-core.js");

  await assert.rejects(() => apiFetchWith({
    path: "/v1/me",
    auth: true,
    accessToken: "token",
    discoverApiBaseUrl: async () => "https://api.example",
    fetchImpl: async () => new Response(JSON.stringify({ error: "GitHub App is not configured." }), {
      status: 503,
      headers: {
        "content-type": "application/json"
      }
    })
  }), /GitHub App is not configured\./);
});
