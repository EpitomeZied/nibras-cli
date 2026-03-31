const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

const { buildApp } = require("../apps/api/dist/app");
const { FileStore } = require("../apps/api/dist/store");

function makeStorePath() {
  return path.join(os.tmpdir(), `nibras-cors-${Date.now()}-${Math.random()}.json`);
}

async function withEnv(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("API CORS allows configured browser origins for preflight requests", async () => {
  await withEnv({
    NIBRAS_WEB_CORS_ORIGINS: undefined,
    NIBRAS_WEB_BASE_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_NIBRAS_WEB_BASE_URL: "http://127.0.0.1:3000"
  }, async () => {
    const app = buildApp(new FileStore(makeStorePath()));
    try {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/v1/health",
        headers: {
          origin: "http://127.0.0.1:3000",
          "access-control-request-method": "GET",
          "access-control-request-headers": "authorization"
        }
      });

      assert.ok(response.statusCode >= 200 && response.statusCode < 300);
      assert.equal(response.headers["access-control-allow-origin"], "http://127.0.0.1:3000");
      assert.match(String(response.headers["access-control-allow-methods"]), /GET/);
      assert.match(String(response.headers["access-control-allow-headers"]), /authorization/i);
    } finally {
      await app.close();
    }
  });
});

test("API CORS does not approve disallowed origins", async () => {
  await withEnv({
    NIBRAS_WEB_CORS_ORIGINS: "https://allowed.example",
    NIBRAS_WEB_BASE_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_NIBRAS_WEB_BASE_URL: "http://127.0.0.1:3000"
  }, async () => {
    const app = buildApp(new FileStore(makeStorePath()));
    try {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/v1/health",
        headers: {
          origin: "https://blocked.example",
          "access-control-request-method": "GET"
        }
      });

      assert.equal(response.statusCode, 404);
      assert.equal(response.headers["access-control-allow-origin"], undefined);
    } finally {
      await app.close();
    }
  });
});

test("API requests without an Origin header still work", async () => {
  await withEnv({
    NIBRAS_WEB_CORS_ORIGINS: "https://allowed.example"
  }, async () => {
    const app = buildApp(new FileStore(makeStorePath()));
    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/health"
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { ok: true });
    } finally {
      await app.close();
    }
  });
});
