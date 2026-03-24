const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  createAppJwt,
  createSignedState,
  verifySignedState,
  verifyWebhookSignature
} = require("../packages/github/dist/index");
const { buildApp } = require("../apps/api/dist/app");
const { FileStore } = require("../apps/api/dist/store");

test("GitHub signed state round-trips and rejects tampering", () => {
  const secret = "super-secret";
  const signed = createSignedState(secret, { returnTo: "http://127.0.0.1:3000/auth/complete" });
  const decoded = verifySignedState(secret, signed);
  assert.deepEqual(decoded, { returnTo: "http://127.0.0.1:3000/auth/complete" });
  assert.equal(verifySignedState(secret, `${signed}tampered`), null);
});

test("GitHub app JWT generation accepts RSA private keys from GitHub", async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs1"
    },
    publicKeyEncoding: {
      format: "pem",
      type: "spki"
    }
  });
  const jwt = await createAppJwt({
    appId: "3126322",
    clientId: "client-id",
    clientSecret: "client-secret",
    privateKey,
    webhookSecret: "webhook-secret",
    appName: "nibras-dev-zied"
  });
  assert.equal(typeof jwt, "string");
  assert.match(jwt, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

test("GitHub webhook signature verification validates X-Hub-Signature-256", () => {
  const secret = "webhook-secret";
  const body = Buffer.from(JSON.stringify({ hello: "world" }));
  const signature = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  assert.equal(verifyWebhookSignature(secret, body, signature), true);
  assert.equal(verifyWebhookSignature(secret, body, "sha256=deadbeef"), false);
});

test("GitHub webhook endpoint rejects invalid signatures and accepts valid ones", async () => {
  const previousEnv = {
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    GITHUB_APP_NAME: process.env.GITHUB_APP_NAME
  };
  process.env.GITHUB_APP_ID = "1";
  process.env.GITHUB_APP_CLIENT_ID = "client";
  process.env.GITHUB_APP_CLIENT_SECRET = "secret";
  process.env.GITHUB_APP_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nMIIBVwIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEA1nrWuXbR8+7y6Kk4fHq4\\n+vAc9/Yo8luFs3ql3m1rLzP54ha7qjR+uC7X+J2IcF9GTOj6OMzQ1i4WS9VmqHj7pncE\\nSwIDAQABAkAFoM/3we0nCnJm9n6QQN0JrgR6m7kQuVvx0hgHqYb1Y3WK07jPvpw59h8z\\nBVqYl1C5cxk2bOgQaLhB5yyLqFxpfK1BAiEA+kVLdP0wVR2z67q7QCY2H8YDySa9j0Kw\\npqD7+z3t0hcCIQDY6qShdU1TjzC9s2niHzR6x1AOeX4DB+MEd+fQzT47XQIhAKgNbspA\\nUXBMLFIFlNIeNdAyjDx6fFt9VxDqVjPW8M2JAiEAo6EuzXgS4N2iQdTk5ExT+zvM9dDc\\n3HV3d6uxzj1hUZkCIBbV5sH3sRh6QU8RZUS2l0h6eJQk9g94D96sl8GF8Hdl\\n-----END PRIVATE KEY-----";
  process.env.GITHUB_WEBHOOK_SECRET = "webhook-secret";
  process.env.GITHUB_APP_NAME = "nibras-test";

  const app = buildApp(new FileStore("/tmp/nibras-webhook-test.json"));
  try {
    const payload = JSON.stringify({
      ref: "refs/heads/main",
      after: "abc123",
      repository: {
        name: "repo",
        owner: { login: "owner" }
      }
    });
    const validSignature = `sha256=${crypto.createHmac("sha256", "webhook-secret").update(payload).digest("hex")}`;
    const invalid = await app.inject({
      method: "POST",
      url: "/v1/github/webhooks",
      headers: {
        "content-type": "application/json",
        "x-github-event": "push",
        "x-hub-signature-256": "sha256=deadbeef"
      },
      payload
    });
    assert.equal(invalid.statusCode, 401);

    const valid = await app.inject({
      method: "POST",
      url: "/v1/github/webhooks",
      headers: {
        "content-type": "application/json",
        "x-github-event": "push",
        "x-hub-signature-256": validSignature
      },
      payload
    });
    assert.equal(valid.statusCode, 200);
  } finally {
    await app.close();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
