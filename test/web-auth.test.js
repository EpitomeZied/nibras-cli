const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { buildApp } = require("../apps/api/dist/app");
const { FileStore } = require("../apps/api/dist/store");

function makeStorePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nibras-web-auth-"));
  return path.join(dir, "store.json");
}

test("web session endpoints authenticate with the session cookie and clear it on logout", async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const session = await store.createWebSession("http://127.0.0.1", "user_demo");
  const app = buildApp(new FileStore(storePath));

  try {
    const sessionResponse = await app.inject({
      method: "GET",
      url: "/v1/web/session",
      cookies: {
        nibras_web_session: session.sessionToken
      }
    });
    assert.equal(sessionResponse.statusCode, 200);
    assert.equal(sessionResponse.json().user.username, "demo");

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/v1/web/logout",
      cookies: {
        nibras_web_session: session.sessionToken
      }
    });
    assert.equal(logoutResponse.statusCode, 200);
    assert.match(String(logoutResponse.headers["set-cookie"]), /nibras_web_session=/);
    assert.match(String(logoutResponse.headers["set-cookie"]), /Max-Age=0/);

    const afterLogout = await app.inject({
      method: "GET",
      url: "/v1/web/session",
      cookies: {
        nibras_web_session: session.sessionToken
      }
    });
    assert.equal(afterLogout.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("hosted submission routes are owner-restricted and admin overrides persist status and logs", async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const seeded = store.read("http://127.0.0.1");
  seeded.sessions.push({
    accessToken: "student-token",
    refreshToken: "student-refresh",
    userId: "user_demo",
    createdAt: new Date().toISOString()
  });
  seeded.sessions.push({
    accessToken: "admin-token",
    refreshToken: "admin-refresh",
    userId: "user_instructor",
    createdAt: new Date().toISOString()
  });
  store.write(seeded);

  await store.provisionProjectRepo("http://127.0.0.1", "cs161/exam1", "user_demo");
  const submission = await store.createOrReuseSubmission("http://127.0.0.1", {
    userId: "user_demo",
    projectKey: "cs161/exam1",
    commitSha: "abc123",
    repoUrl: "https://github.com/demo-user/nibras-cs161-exam1",
    branch: "main"
  });

  const app = buildApp(new FileStore(storePath));

  try {
    const forbiddenRead = await app.inject({
      method: "GET",
      url: `/v1/submissions/${submission.id}`,
      headers: {
        authorization: "Bearer admin-token"
      }
    });
    assert.equal(forbiddenRead.statusCode, 403);

    const forbiddenUpdate = await app.inject({
      method: "POST",
      url: `/v1/submissions/${submission.id}/local-test-result`,
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        exitCode: 0,
        summary: "should not be allowed"
      })
    });
    assert.equal(forbiddenUpdate.statusCode, 403);

    const overrideResponse = await app.inject({
      method: "PATCH",
      url: `/v1/admin/submissions/${submission.id}/status`,
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        status: "needs_review",
        summary: "Manual review required."
      })
    });
    assert.equal(overrideResponse.statusCode, 200);
    assert.equal(overrideResponse.json().status, "needs_review");

    const adminRead = await app.inject({
      method: "GET",
      url: `/v1/admin/submissions/${submission.id}/logs`,
      headers: {
        authorization: "Bearer admin-token"
      }
    });
    assert.equal(adminRead.statusCode, 200);
    assert.ok(adminRead.json().logs.length >= 2);
    assert.equal(adminRead.json().logs[0].status, "needs_review");

    const ownedRead = await app.inject({
      method: "GET",
      url: `/v1/submissions/${submission.id}`,
      headers: {
        authorization: "Bearer student-token"
      }
    });
    assert.equal(ownedRead.statusCode, 200);
    assert.equal(ownedRead.json().status, "needs_review");
  } finally {
    await app.close();
  }
});
