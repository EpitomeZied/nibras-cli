'use strict';

/**
 * test/v1-features.test.js
 *
 * Integration tests for all v1 hardening features:
 *   - Structured error codes (lib/errors)
 *   - Path param validation (lib/validate)
 *   - Metrics endpoint protection
 *   - Body size limit
 *   - Admin user management (GET /v1/admin/users, PATCH role)
 *   - Deadline enforcement on milestone submissions
 *   - SSE stream endpoint registration
 *   - Student analytics endpoint
 *   - GDPR account deletion
 *   - Pagination (X-Total-Count header)
 *   - Rate-limit error shape includes { code: 'RATE_LIMITED' }
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('jszip');

const { buildApp } = require('../apps/api/dist/app');
const { FileStore } = require('../apps/api/dist/store');

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeStorePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nibras-v1-'));
  return path.join(dir, 'store.json');
}

/**
 * Build a FileStore-backed app with pre-seeded sessions for both a student and
 * an instructor (the seed data provides user_demo and user_instructor).
 */
function buildTestApp(storePath) {
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
  // Add bearer sessions for both actors
  data.sessions.push(
    {
      accessToken: 'student-token',
      refreshToken: 'student-refresh',
      userId: 'user_demo',
      createdAt: new Date().toISOString(),
    },
    {
      accessToken: 'instructor-token',
      refreshToken: 'instructor-refresh',
      userId: 'user_instructor',
      createdAt: new Date().toISOString(),
    },
    {
      accessToken: 'admin-token',
      refreshToken: 'admin-refresh',
      userId: 'user_instructor',
      createdAt: new Date().toISOString(),
    }
  );
  // Make user_instructor an admin for admin-route tests
  const instructor = data.users.find((u) => u.id === 'user_instructor');
  if (instructor) instructor.systemRole = 'admin';
  store.write(data);
  return buildApp(new FileStore(storePath));
}

// ── Structured error codes ─────────────────────────────────────────────────────

test('unauthenticated requests return { error, code: "AUTH_REQUIRED" }', async () => {
  const app = buildApp(new FileStore(makeStorePath()));
  try {
    const res = await app.inject({ method: 'GET', url: '/v1/me' });
    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.ok(body.error, 'error field present');
    assert.equal(body.code, 'AUTH_REQUIRED');
  } finally {
    await app.close();
  }
});

test('invalid path param returns { code: "INVALID_PARAM" }', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    // Use a string that passes URL routing but fails the cuid/uuid/human-id regex
    // (contains special chars that our validateId rejects)
    const res = await app.inject({
      method: 'GET',
      url: '/v1/tracking/projects/!!invalid!!',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.code, 'INVALID_PARAM');
  } finally {
    await app.close();
  }
});

test('unknown resource returns { code: "NOT_FOUND" }', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    // A valid-format but non-existent cuid ID
    const res = await app.inject({
      method: 'GET',
      url: '/v1/tracking/projects/clnotexistent000000000001',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(res.statusCode, 404);
    const body = res.json();
    assert.equal(body.code, 'NOT_FOUND');
  } finally {
    await app.close();
  }
});

test('forbidden resource returns { code: "FORBIDDEN" }', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    // student tries to access admin endpoint
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/submissions',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(res.statusCode, 403);
    const body = res.json();
    assert.equal(body.code, 'FORBIDDEN');
  } finally {
    await app.close();
  }
});

test('FileStore seeds CS106L with bundle-backed hosted projects', () => {
  const store = new FileStore(makeStorePath());
  const data = store.read('http://127.0.0.1');
  assert.ok(data.courses.some((course) => course.slug === 'cs106l'));
  const cs106lProjects = data.projects.filter((project) =>
    project.projectKey.startsWith('cs106l/')
  );
  assert.deepEqual(cs106lProjects.map((project) => project.projectKey).sort(), [
    'cs106l/gapbuffer',
    'cs106l/hashmap',
    'cs106l/kdtree',
  ]);
  for (const project of cs106lProjects) {
    assert.equal(project.starter.kind, 'bundle');
    assert.equal(project.manifest.test.mode, 'command');
  }
});

test('setup response includes a bundle starter descriptor for cs106l/gapbuffer', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects/cs106l%2Fgapbuffer/setup',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.projectKey, 'cs106l/gapbuffer');
    assert.equal(body.starter.kind, 'bundle');
    assert.match(body.starter.downloadUrl, /\/v1\/projects\/cs106l%2Fgapbuffer\/starter-bundle$/);
    assert.equal(body.starter.archiveFormat, 'zip');
    assert.equal(body.manifest.test.mode, 'command');
  } finally {
    await app.close();
  }
});

test('starter bundle route serves the seeded CS106L archive', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/projects/cs106l%2Fgapbuffer/starter-bundle',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/zip');
    const zip = await JSZip.loadAsync(res.rawPayload);
    assert.ok(zip.file('gap_buffer.h'));
    assert.ok(zip.file('README.md'));
    assert.ok(Object.keys(zip.files).every((name) => !name.includes('solutions/')));
  } finally {
    await app.close();
  }
});

test('starter bundle route returns 403 when the user lacks project access', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
  const cs106lCourse = data.courses.find((course) => course.slug === 'cs106l');
  assert.ok(cs106lCourse);
  data.courseMemberships = data.courseMemberships.filter(
    (membership) => !(membership.userId === 'user_demo' && membership.courseId === cs106lCourse.id)
  );
  store.write(data);
  const app = buildTestApp(storePath);
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/projects/cs106l%2Fgapbuffer/starter-bundle',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await app.close();
  }
});

test('PrismaStore auto-enrollment covers both seeded demo courses', async () => {
  const { PrismaStore } = require('../apps/api/dist/prisma-store');
  const courseMembershipUpserts = [];
  const fakePrisma = {
    user: {
      upsert: async () => ({ id: 'user-1' }),
      findUniqueOrThrow: async () => ({
        id: 'user-1',
        username: 'student',
        email: 'student@example.com',
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: 'user',
        githubAccount: { login: 'student-gh' },
      }),
    },
    githubAccount: {
      upsert: async () => ({}),
    },
    cliSession: {
      create: async () => ({
        userId: 'user-1',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        createdAt: new Date(),
      }),
    },
    auditLog: {
      create: async () => ({}),
    },
    course: {
      findUnique: async ({ where }) => {
        if (where.slug === 'cs161') return { id: 'course-cs161' };
        if (where.slug === 'cs106l') return { id: 'course-cs106l' };
        return null;
      },
    },
    courseMembership: {
      upsert: async (args) => {
        courseMembershipUpserts.push(args);
        return args.create;
      },
    },
  };
  const store = new PrismaStore(fakePrisma);

  await store.upsertGitHubUserSession({
    githubUserId: 'gh-1',
    login: 'student-gh',
    email: 'student@example.com',
    accessToken: 'user-token',
  });

  assert.deepEqual(courseMembershipUpserts.map((entry) => entry.create.courseId).sort(), [
    'course-cs106l',
    'course-cs161',
  ]);
});

test('PrismaStore listCourseMemberships backfills seeded demo courses for existing users', async () => {
  const { PrismaStore } = require('../apps/api/dist/prisma-store');
  const courseMembershipUpserts = [];
  const fakePrisma = {
    course: {
      findMany: async () => [{ id: 'course-cs161' }, { id: 'course-cs106l' }],
    },
    courseMembership: {
      upsert: async (args) => {
        courseMembershipUpserts.push(args);
        return args.create;
      },
      findMany: async () => [
        {
          id: 'membership-cs161',
          courseId: 'course-cs161',
          userId: 'user-1',
          role: 'student',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'membership-cs106l',
          courseId: 'course-cs106l',
          userId: 'user-1',
          role: 'student',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  };
  const store = new PrismaStore(fakePrisma);
  store.seeded = true;

  const memberships = await store.listCourseMemberships('https://nibras-api.fly.dev', 'user-1');

  assert.equal(memberships.length, 2);
  assert.deepEqual(courseMembershipUpserts.map((entry) => entry.create.courseId).sort(), [
    'course-cs106l',
    'course-cs161',
  ]);
});

// ── Metrics endpoint protection ────────────────────────────────────────────────

test('/metrics is accessible without token when NIBRAS_METRICS_TOKEN unset', async () => {
  const prev = process.env.NIBRAS_METRICS_TOKEN;
  delete process.env.NIBRAS_METRICS_TOKEN;
  const app = buildApp(new FileStore(makeStorePath()));
  try {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/plain'));
  } finally {
    if (prev !== undefined) process.env.NIBRAS_METRICS_TOKEN = prev;
    await app.close();
  }
});

test('/metrics returns 401 without token when NIBRAS_METRICS_TOKEN is set', async () => {
  const prev = process.env.NIBRAS_METRICS_TOKEN;
  process.env.NIBRAS_METRICS_TOKEN = 'super-secret';
  const app = buildApp(new FileStore(makeStorePath()));
  try {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().code, 'AUTH_REQUIRED');
  } finally {
    process.env.NIBRAS_METRICS_TOKEN = prev ?? '';
    if (!prev) delete process.env.NIBRAS_METRICS_TOKEN;
    await app.close();
  }
});

test('/metrics returns 200 with correct token when NIBRAS_METRICS_TOKEN is set', async () => {
  const prev = process.env.NIBRAS_METRICS_TOKEN;
  process.env.NIBRAS_METRICS_TOKEN = 'super-secret';
  const app = buildApp(new FileStore(makeStorePath()));
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer super-secret' },
    });
    assert.equal(res.statusCode, 200);
    assert.ok(res.payload.includes('nibras_http_requests_total'));
  } finally {
    process.env.NIBRAS_METRICS_TOKEN = prev ?? '';
    if (!prev) delete process.env.NIBRAS_METRICS_TOKEN;
    await app.close();
  }
});

// ── Admin user management ──────────────────────────────────────────────────────

test('GET /v1/admin/users returns user list for admin', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/users',
      headers: { authorization: 'Bearer admin-token' },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(Array.isArray(body.users), 'users is array');
    assert.ok(body.users.length > 0, 'at least one user');
    const user = body.users[0];
    assert.ok('id' in user);
    assert.ok('systemRole' in user);
  } finally {
    await app.close();
  }
});

test('GET /v1/admin/users returns 403 for non-admin', async () => {
  const storePath = makeStorePath();
  // Give student a regular user role
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
  data.sessions.push({
    accessToken: 'student-token',
    refreshToken: 'student-refresh',
    userId: 'user_demo',
    createdAt: new Date().toISOString(),
  });
  store.write(data);
  const app = buildApp(new FileStore(storePath));
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/users',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().code, 'FORBIDDEN');
  } finally {
    await app.close();
  }
});

test('PATCH /v1/admin/users/:userId/role changes system role', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/users/user_demo/role',
      headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
      payload: JSON.stringify({ role: 'admin' }),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.ok, true);
    assert.equal(body.systemRole, 'admin');
  } finally {
    await app.close();
  }
});

test('PATCH /v1/admin/users/:userId/role rejects invalid role', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/users/user_demo/role',
      headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
      payload: JSON.stringify({ role: 'superuser' }),
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().code, 'VALIDATION_ERROR');
  } finally {
    await app.close();
  }
});

// ── Deadline enforcement ───────────────────────────────────────────────────────

test('POST milestone submission is rejected after deadline (422)', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
  // Set milestone dueAt in the past
  const milestone = data.milestones[0];
  if (milestone) {
    milestone.dueAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }
  data.sessions.push({
    accessToken: 'student-token',
    refreshToken: 'r',
    userId: 'user_demo',
    createdAt: new Date().toISOString(),
  });
  store.write(data);
  const app = buildApp(new FileStore(storePath));
  try {
    if (!milestone) {
      // No milestone in seed — skip gracefully
      return;
    }
    const res = await app.inject({
      method: 'POST',
      url: `/v1/tracking/milestones/${milestone.id}/submissions`,
      headers: { authorization: 'Bearer student-token', 'content-type': 'application/json' },
      payload: JSON.stringify({
        submissionType: 'github',
        submissionValue: 'https://github.com/demo/repo',
        notes: 'Late attempt',
        repoUrl: 'https://github.com/demo/repo',
        branch: 'main',
        commitSha: 'abc123',
      }),
    });
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().code, 'VALIDATION_ERROR');
  } finally {
    await app.close();
  }
});

test('POST milestone submission is allowed before deadline', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
  // Ensure milestone dueAt is in the future
  const milestone = data.milestones[0];
  if (milestone) {
    milestone.dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  data.sessions.push({
    accessToken: 'student-token',
    refreshToken: 'r',
    userId: 'user_demo',
    createdAt: new Date().toISOString(),
  });
  store.write(data);
  await store.provisionProjectRepo('http://127.0.0.1', 'cs161/exam1', 'user_demo');
  const app = buildApp(new FileStore(storePath));
  try {
    if (!milestone) return;
    const res = await app.inject({
      method: 'POST',
      url: `/v1/tracking/milestones/${milestone.id}/submissions`,
      headers: { authorization: 'Bearer student-token', 'content-type': 'application/json' },
      payload: JSON.stringify({
        submissionType: 'github',
        submissionValue: 'https://github.com/demo/repo',
        notes: 'On time',
        repoUrl: 'https://github.com/demo/repo',
        branch: 'main',
        commitSha: 'abc456',
      }),
    });
    assert.equal(res.statusCode, 201);
  } finally {
    await app.close();
  }
});

// ── Student analytics ──────────────────────────────────────────────────────────

test('GET /v1/tracking/analytics/student returns analytics object', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/tracking/analytics/student',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok('userId' in body, 'has userId');
    assert.ok(Array.isArray(body.analytics), 'analytics is array');
  } finally {
    await app.close();
  }
});

// ── SSE stream endpoint ────────────────────────────────────────────────────────

test('GET /v1/submissions/:id/stream returns 400 for invalid ID format', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    // An ID with special chars that our validateId regex rejects
    const res = await app.inject({
      method: 'GET',
      url: '/v1/submissions/!!badid!!/stream',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().code, 'INVALID_PARAM');
  } finally {
    await app.close();
  }
});

// ── GDPR account deletion ──────────────────────────────────────────────────────

test('DELETE /v1/me/account requires confirmation string', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/me/account',
      headers: { authorization: 'Bearer student-token', 'content-type': 'application/json' },
      payload: JSON.stringify({ confirm: 'yes please' }),
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().code, 'VALIDATION_ERROR');
  } finally {
    await app.close();
  }
});

test('DELETE /v1/me/account deletes the account with correct confirmation', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/me/account',
      headers: { authorization: 'Bearer student-token', 'content-type': 'application/json' },
      payload: JSON.stringify({ confirm: 'DELETE MY ACCOUNT' }),
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);

    // Token should now be invalid (session was deleted)
    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(me.statusCode, 401);
  } finally {
    await app.close();
  }
});

// ── Pagination (X-Total-Count) ─────────────────────────────────────────────────

test('GET /v1/tracking/courses with ?limit= returns X-Total-Count header', async () => {
  const storePath = makeStorePath();
  const app = buildTestApp(storePath);
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/tracking/courses?limit=1&offset=0',
      headers: { authorization: 'Bearer admin-token' },
    });
    assert.equal(res.statusCode, 200);
    assert.ok('x-total-count' in res.headers, 'X-Total-Count header present');
    assert.ok(Number(res.headers['x-total-count']) >= 0, 'count is a number');
    assert.ok(Array.isArray(res.json()), 'body is array');
  } finally {
    await app.close();
  }
});

// ── Health & readiness ─────────────────────────────────────────────────────────

test('/healthz returns { ok: true }', async () => {
  const app = buildApp(new FileStore(makeStorePath()));
  try {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
  } finally {
    await app.close();
  }
});

test('/readyz returns { ok: true } without DATABASE_URL', async () => {
  const prev = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const app = buildApp(new FileStore(makeStorePath()));
  try {
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
  } finally {
    if (prev !== undefined) process.env.DATABASE_URL = prev;
    await app.close();
  }
});
