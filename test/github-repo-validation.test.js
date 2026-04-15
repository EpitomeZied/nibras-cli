const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getGitHubRepository, parseGitHubRepositoryUrl } = require('../packages/github/dist/index');
const { buildApp } = require('../apps/api/dist/app');
const { FileStore } = require('../apps/api/dist/store');

function makeStorePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nibras-github-repo-'));
  return path.join(dir, 'store.json');
}

function createAuthedApp() {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
  data.sessions.push({
    accessToken: 'student-token',
    refreshToken: 'student-refresh',
    userId: 'user_demo',
    createdAt: new Date().toISOString(),
  });
  store.write(data);
  return {
    app: buildApp(new FileStore(storePath)),
    store: new FileStore(storePath),
  };
}

function withGitHubEnv() {
  const previousEnv = {
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    GITHUB_APP_NAME: process.env.GITHUB_APP_NAME,
  };

  process.env.GITHUB_APP_ID = '1';
  process.env.GITHUB_APP_CLIENT_ID = 'client';
  process.env.GITHUB_APP_CLIENT_SECRET = 'secret';
  process.env.GITHUB_APP_PRIVATE_KEY =
    '-----BEGIN PRIVATE KEY-----\\nMIIBVwIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEA1nrWuXbR8+7y6Kk4fHq4\\n+vAc9/Yo8luFs3ql3m1rLzP54ha7qjR+uC7X+J2IcF9GTOj6OMzQ1i4WS9VmqHj7pncE\\nSwIDAQABAkAFoM/3we0nCnJm9n6QQN0JrgR6m7kQuVvx0hgHqYb1Y3WK07jPvpw59h8z\\nBVqYl1C5cxk2bOgQaLhB5yyLqFxpfK1BAiEA+kVLdP0wVR2z67q7QCY2H8YDySa9j0Kw\\npqD7+z3t0hcCIQDY6qShdU1TjzC9s2niHzR6x1AOeX4DB+MEd+fQzT47XQIhAKgNbspA\\nUXBMLFIFlNIeNdAyjDx6fFt9VxDqVjPW8M2JAiEAo6EuzXgS4N2iQdTk5ExT+zvM9dDc\\n3HV3d6uxzj1hUZkCIBbV5sH3sRh6QU8RZUS2l0h6eJQk9g94D96sl8GF8Hdl\\n-----END PRIVATE KEY-----';
  process.env.GITHUB_WEBHOOK_SECRET = 'webhook-secret';
  process.env.GITHUB_APP_NAME = 'nibras-test';

  return () => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

test('parseGitHubRepositoryUrl normalizes canonical repo URLs', () => {
  assert.deepEqual(parseGitHubRepositoryUrl('https://github.com/demo/repo.git'), {
    owner: 'demo',
    name: 'repo',
    repoUrl: 'https://github.com/demo/repo',
  });
  assert.equal(parseGitHubRepositoryUrl('https://example.com/demo/repo'), null);
  assert.equal(parseGitHubRepositoryUrl('https://github.com/demo/repo/issues'), null);
});

test('getGitHubRepository maps repo metadata and permission levels', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.equal(String(url), 'https://api.github.com/repos/demo/repo');
    return new Response(
      JSON.stringify({
        html_url: 'https://github.com/demo/repo',
        full_name: 'demo/repo',
        default_branch: 'trunk',
        private: true,
        permissions: {
          admin: false,
          push: true,
          maintain: false,
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  };

  try {
    const repository = await getGitHubRepository(
      {
        appId: '1',
        clientId: 'client',
        clientSecret: 'secret',
        privateKey: 'private-key',
        webhookSecret: 'webhook-secret',
        appName: 'nibras-test',
      },
      'user-token',
      'demo',
      'repo'
    );

    assert.deepEqual(repository, {
      repoUrl: 'https://github.com/demo/repo',
      owner: 'demo',
      name: 'repo',
      fullName: 'demo/repo',
      defaultBranch: 'trunk',
      visibility: 'private',
      permission: 'write',
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('repo validation route returns normalized repo metadata for writable repositories', async () => {
  const restoreEnv = withGitHubEnv();
  const originalFetch = global.fetch;
  const { app } = createAuthedApp();

  global.fetch = async (url) => {
    assert.equal(String(url), 'https://api.github.com/repos/demo-user/nibras-cs161-exam1');
    return new Response(
      JSON.stringify({
        html_url: 'https://github.com/demo-user/nibras-cs161-exam1',
        full_name: 'demo-user/nibras-cs161-exam1',
        default_branch: 'master',
        private: false,
        permissions: {
          admin: true,
          push: true,
          maintain: true,
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  };

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/github/repositories/validate',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        repoUrl: 'https://github.com/demo-user/nibras-cs161-exam1.git',
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      repoUrl: 'https://github.com/demo-user/nibras-cs161-exam1',
      owner: 'demo-user',
      name: 'nibras-cs161-exam1',
      fullName: 'demo-user/nibras-cs161-exam1',
      defaultBranch: 'master',
      visibility: 'public',
      permission: 'admin',
    });
  } finally {
    await app.close();
    global.fetch = originalFetch;
    restoreEnv();
  }
});

test('repo validation route rejects malformed and non-GitHub URLs', async () => {
  const restoreEnv = withGitHubEnv();
  const { app } = createAuthedApp();

  try {
    for (const repoUrl of ['not-a-url', 'https://example.com/demo/repo']) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/github/repositories/validate',
        headers: {
          authorization: 'Bearer student-token',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ repoUrl }),
      });
      assert.equal(response.statusCode, 422);
      assert.match(response.json().error, /valid GitHub repository URL/i);
    }
  } finally {
    await app.close();
    restoreEnv();
  }
});

test('repo validation route rejects when the user has no stored GitHub token', async () => {
  const restoreEnv = withGitHubEnv();
  const { app, store } = createAuthedApp();
  const data = store.read('http://127.0.0.1');
  data.githubAccounts = data.githubAccounts.map((entry) =>
    entry.userId === 'user_demo' ? { ...entry, userAccessToken: null } : entry
  );
  store.write(data);

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/github/repositories/validate',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ repoUrl: 'https://github.com/demo-user/nibras-cs161-exam1' }),
    });

    assert.equal(response.statusCode, 422);
    assert.match(response.json().error, /connect your GitHub account/i);
  } finally {
    await app.close();
    restoreEnv();
  }
});

test('repo validation route returns 404 when GitHub cannot find the repo', async () => {
  const restoreEnv = withGitHubEnv();
  const originalFetch = global.fetch;
  const { app } = createAuthedApp();

  global.fetch = async () =>
    new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/github/repositories/validate',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ repoUrl: 'https://github.com/demo-user/missing-repo' }),
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error, 'Repository not found.');
  } finally {
    await app.close();
    global.fetch = originalFetch;
    restoreEnv();
  }
});

test('repo validation route rejects read-only repositories', async () => {
  const restoreEnv = withGitHubEnv();
  const originalFetch = global.fetch;
  const { app } = createAuthedApp();

  global.fetch = async () =>
    new Response(
      JSON.stringify({
        html_url: 'https://github.com/demo-user/nibras-cs161-exam1',
        full_name: 'demo-user/nibras-cs161-exam1',
        default_branch: 'main',
        private: false,
        permissions: {
          admin: false,
          push: false,
          maintain: false,
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/github/repositories/validate',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ repoUrl: 'https://github.com/demo-user/nibras-cs161-exam1' }),
    });

    assert.equal(response.statusCode, 422);
    assert.match(response.json().error, /write access/i);
  } finally {
    await app.close();
    global.fetch = originalFetch;
    restoreEnv();
  }
});

test('repo validation route returns 503 when GitHub is unavailable', async () => {
  const restoreEnv = withGitHubEnv();
  const originalFetch = global.fetch;
  const { app } = createAuthedApp();

  global.fetch = async () =>
    new Response(JSON.stringify({ message: 'Service unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/github/repositories/validate',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ repoUrl: 'https://github.com/demo-user/nibras-cs161-exam1' }),
    });

    assert.equal(response.statusCode, 503);
    assert.match(response.json().error, /temporarily unavailable/i);
  } finally {
    await app.close();
    global.fetch = originalFetch;
    restoreEnv();
  }
});
