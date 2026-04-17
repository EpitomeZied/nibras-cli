const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildApp } = require('../apps/api/dist/app');
const { FileStore } = require('../apps/api/dist/store');

function makeStorePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nibras-tracking-'));
  return path.join(dir, 'store.json');
}

function createSession(store, storePath, userId, token) {
  const data = store.read('http://127.0.0.1');
  data.sessions.push({
    accessToken: token,
    refreshToken: `${token}-refresh`,
    userId,
    createdAt: new Date().toISOString(),
  });
  store.write(data);
  return buildApp(new FileStore(storePath));
}

test('student dashboard returns the migrated projects view model', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const app = createSession(store, storePath, 'user_demo', 'student-token');

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/tracking/dashboard/student',
      headers: {
        authorization: 'Bearer student-token',
      },
    });
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.course.slug, 'cs161');
    assert.equal(payload.projects[0].projectKey, 'cs161/exam1');
    assert.equal(payload.projects[0].deliveryMode, 'individual');
    assert.ok(payload.milestonesByProject[payload.projects[0].id].length >= 2);
    assert.equal(typeof payload.statsByProject[payload.projects[0].id].minutesRemaining, 'number');
    assert.equal('daysRemaining' in payload.statsByProject[payload.projects[0].id], false);
  } finally {
    await app.close();
  }
});

test('instructor can create and list project templates', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const app = createSession(store, storePath, 'user_instructor', 'instructor-token');

  try {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/tracking/courses/course_cs161/templates',
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        slug: 'team-capstone',
        title: 'Team Capstone',
        description: 'Reusable team project template.',
        deliveryMode: 'team',
        teamSize: 3,
        status: 'active',
        rubric: [{ criterion: 'Delivery', maxScore: 100 }],
        resources: [{ label: 'Spec', url: 'https://example.com/spec' }],
        roles: [
          { key: 'backend', label: 'Backend', count: 1, sortOrder: 0 },
          { key: 'frontend', label: 'Frontend', count: 1, sortOrder: 1 },
          { key: 'pm', label: 'Project Manager', count: 1, sortOrder: 2 },
        ],
        milestones: [{ title: 'Final', description: '', order: 1, dueAt: null, isFinal: true }],
      }),
    });
    assert.equal(created.statusCode, 201);

    const listed = await app.inject({
      method: 'GET',
      url: '/v1/tracking/courses/course_cs161/templates',
      headers: { authorization: 'Bearer instructor-token' },
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.json()[0].title, 'Team Capstone');
  } finally {
    await app.close();
  }
});

test('team project application and locking flow works end to end', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
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
    }
  );
  data.projectTemplates.push({
    id: 'template_team_exam1',
    courseId: 'course_cs161',
    slug: 'team-exam1',
    title: 'Team Exam 1',
    description: '',
    deliveryMode: 'team',
    teamSize: 1,
    status: 'active',
    rubric: [],
    resources: [],
    roles: [{ id: 'role_backend', key: 'backend', label: 'Backend', count: 1, sortOrder: 0 }],
    milestones: [{ id: 'tmpl_ms_final', title: 'Final', description: '', order: 1, dueAt: null, isFinal: true }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const project = data.projects.find((entry) => entry.id === 'project_cs161_exam1');
  project.deliveryMode = 'team';
  project.templateId = 'template_team_exam1';
  project.teamSize = 1;
  project.teamRoles = [{ id: 'role_backend', key: 'backend', label: 'Backend', count: 1, sortOrder: 0 }];
  project.teamFormationStatus = 'application_open';
  project.applicationOpenAt = new Date(Date.now() - 1000).toISOString();
  project.applicationCloseAt = new Date(Date.now() + 60_000).toISOString();
  store.write(data);
  const app = buildApp(new FileStore(storePath));

  try {
    const application = await app.inject({
      method: 'POST',
      url: '/v1/tracking/projects/project_cs161_exam1/applications',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        statement: 'I can own the backend work.',
        availabilityNote: '',
        preferences: [{ templateRoleId: 'role_backend', rank: 1 }],
      }),
    });
    assert.equal(application.statusCode, 201);

    const generated = await app.inject({
      method: 'POST',
      url: '/v1/tracking/projects/project_cs161_exam1/team-formation/generate',
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ algorithmVersion: 'v1' }),
    });
    assert.equal(generated.statusCode, 200);
    assert.equal(generated.json().result.teams.length, 1);

    const locked = await app.inject({
      method: 'POST',
      url: '/v1/tracking/projects/project_cs161_exam1/team-formation/lock',
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ formationRunId: generated.json().id }),
    });
    assert.equal(locked.statusCode, 200);
    assert.equal(locked.json()[0].members[0].userId, 'user_demo');
  } finally {
    await app.close();
  }
});

test('home dashboard returns the student mode by default for student-only users', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const app = createSession(store, storePath, 'user_demo', 'student-token');

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/tracking/dashboard/home',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.deepEqual(payload.availableModes, ['student']);
    assert.equal(payload.defaultMode, 'student');
    assert.ok(payload.student);
    assert.equal(payload.instructor, undefined);
  } finally {
    await app.close();
  }
});

test('home dashboard rejects unavailable mode overrides', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const app = createSession(store, storePath, 'user_demo', 'student-token');

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/tracking/dashboard/home?mode=instructor',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(response.statusCode, 403);
  } finally {
    await app.close();
  }
});

test('home dashboard defaults to instructor for dual-role users and exposes both modes', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
  data.courseMemberships.push({
    id: 'membership_demo_ta_cs161',
    courseId: 'course_cs161',
    userId: 'user_demo',
    role: 'ta',
    level: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  data.sessions.push({
    accessToken: 'dual-role-token',
    refreshToken: 'dual-role-refresh',
    userId: 'user_demo',
    createdAt: new Date().toISOString(),
  });
  store.write(data);
  const app = buildApp(new FileStore(storePath));

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/tracking/dashboard/home',
      headers: { authorization: 'Bearer dual-role-token' },
    });
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.deepEqual(payload.availableModes, ['instructor', 'student']);
    assert.equal(payload.defaultMode, 'instructor');
    assert.ok(payload.student);
    assert.ok(payload.instructor);
  } finally {
    await app.close();
  }
});

test('student home dashboard prioritizes failed submissions with a resubmit action', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
  data.sessions.push({
    accessToken: 'student-token',
    refreshToken: 'student-refresh',
    userId: 'user_demo',
    createdAt: new Date().toISOString(),
  });
  data.submissions.push({
    id: 'submission_failed_home',
    userId: 'user_demo',
    projectId: 'project_cs161_exam1',
    projectKey: 'cs161/exam1',
    milestoneId: 'milestone_exam1_design',
    commitSha: 'deadbeef',
    repoUrl: 'https://github.com/demo-user/nibras-cs161-exam1',
    branch: 'main',
    status: 'failed',
    summary: 'Tests failed.',
    submissionType: 'github',
    submissionValue: 'https://github.com/demo-user/nibras-cs161-exam1',
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    localTestExitCode: 1,
  });
  store.write(data);
  const app = buildApp(new FileStore(storePath));

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/tracking/dashboard/home',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.student.attentionItems[0].kind, 'failed_submission');
    assert.equal(payload.student.attentionItems[0].cta.label, 'Resubmit');
  } finally {
    await app.close();
  }
});

test('instructor home dashboard orders urgent queue by oldest pending review first', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
  data.sessions.push({
    accessToken: 'instructor-token',
    refreshToken: 'instructor-refresh',
    userId: 'user_instructor',
    createdAt: new Date().toISOString(),
  });
  data.submissions.push(
    {
      id: 'submission_newer_review',
      userId: 'user_demo',
      projectId: 'project_cs161_exam1',
      projectKey: 'cs161/exam1',
      milestoneId: 'milestone_exam1_design',
      commitSha: 'newer',
      repoUrl: 'https://github.com/demo-user/nibras-cs161-exam1',
      branch: 'main',
      status: 'needs_review',
      summary: 'Awaiting review.',
      submissionType: 'text',
      submissionValue: 'draft',
      notes: null,
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      submittedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      localTestExitCode: null,
    },
    {
      id: 'submission_older_review',
      userId: 'user_demo',
      projectId: 'project_cs161_exam1',
      projectKey: 'cs161/exam1',
      milestoneId: 'milestone_exam1_final',
      commitSha: 'older',
      repoUrl: 'https://github.com/demo-user/nibras-cs161-exam1',
      branch: 'main',
      status: 'needs_review',
      summary: 'Awaiting review.',
      submissionType: 'text',
      submissionValue: 'draft',
      notes: null,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      submittedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      localTestExitCode: null,
    }
  );
  store.write(data);
  const app = buildApp(new FileStore(storePath));

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/tracking/dashboard/home',
      headers: { authorization: 'Bearer instructor-token' },
    });
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.instructor.reviewSummary.totalAwaitingReview >= 2, true);
    assert.equal(payload.instructor.urgentQueue[0].submissionId, 'submission_older_review');
  } finally {
    await app.close();
  }
});

test('tracking project creation is instructor-only', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const seeded = store.read('http://127.0.0.1');
  const courseId = seeded.courses[0].id;
  seeded.sessions.push({
    accessToken: 'student-token',
    refreshToken: 'student-refresh',
    userId: 'user_demo',
    createdAt: new Date().toISOString(),
  });
  seeded.sessions.push({
    accessToken: 'instructor-token',
    refreshToken: 'instructor-refresh',
    userId: 'user_instructor',
    createdAt: new Date().toISOString(),
  });
  store.write(seeded);
  const app = buildApp(new FileStore(storePath));

  try {
    const payload = {
      courseId,
      slug: 'cs161/project-2',
      title: 'Project 2',
      description: 'Second tracked project',
      status: 'draft',
      deliveryMode: 'individual',
      rubric: [],
      resources: [],
    };

    const forbidden = await app.inject({
      method: 'POST',
      url: '/v1/tracking/projects',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify(payload),
    });
    assert.equal(forbidden.statusCode, 403);

    const created = await app.inject({
      method: 'POST',
      url: '/v1/tracking/projects',
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify(payload),
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().projectKey, 'cs161/project-2');
  } finally {
    await app.close();
  }
});

test('student users cannot access instructor dashboards or review queues', async () => {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const seeded = store.read('http://127.0.0.1');
  seeded.sessions.push({
    accessToken: 'student-token',
    refreshToken: 'student-refresh',
    userId: 'user_demo',
    createdAt: new Date().toISOString(),
  });
  store.write(seeded);
  const app = buildApp(new FileStore(storePath));

  try {
    const reviewQueue = await app.inject({
      method: 'GET',
      url: '/v1/tracking/review-queue',
      headers: {
        authorization: 'Bearer student-token',
      },
    });
    assert.equal(reviewQueue.statusCode, 403);

    const instructorDashboard = await app.inject({
      method: 'GET',
      url: '/v1/tracking/dashboard/instructor',
      headers: {
        authorization: 'Bearer student-token',
      },
    });
    assert.equal(instructorDashboard.statusCode, 403);
  } finally {
    await app.close();
  }
});

test('student github milestone submissions can be reviewed and linked to webhook deliveries', async () => {
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

  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');
  data.sessions.push({
    accessToken: 'student-token',
    refreshToken: 'student-refresh',
    userId: 'user_demo',
    createdAt: new Date().toISOString(),
  });
  data.sessions.push({
    accessToken: 'instructor-token',
    refreshToken: 'instructor-refresh',
    userId: 'user_instructor',
    createdAt: new Date().toISOString(),
  });
  store.write(data);
  await store.provisionProjectRepo('http://127.0.0.1', 'cs161/exam1', 'user_demo');
  const milestoneId = store.read('http://127.0.0.1').milestones[0].id;
  const app = buildApp(new FileStore(storePath));

  try {
    const created = await app.inject({
      method: 'POST',
      url: `/v1/tracking/milestones/${milestoneId}/submissions`,
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        submissionType: 'github',
        submissionValue: 'https://github.com/demo-user/nibras-cs161-exam1',
        notes: 'Initial draft',
        repoUrl: 'https://github.com/demo-user/nibras-cs161-exam1',
        branch: 'main',
        commitSha: '',
      }),
    });
    assert.equal(created.statusCode, 201);
    const submissionId = created.json().id;

    const reviewed = await app.inject({
      method: 'POST',
      url: `/v1/tracking/submissions/${submissionId}/review`,
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        status: 'approved',
        score: 95,
        feedback: 'Looks good',
        rubric: [],
      }),
    });
    assert.equal(reviewed.statusCode, 201);

    const submissionForInstructor = await app.inject({
      method: 'GET',
      url: `/v1/tracking/submissions/${submissionId}`,
      headers: {
        authorization: 'Bearer instructor-token',
      },
    });
    assert.equal(submissionForInstructor.statusCode, 200);

    const reviewForInstructor = await app.inject({
      method: 'GET',
      url: `/v1/tracking/submissions/${submissionId}/review`,
      headers: {
        authorization: 'Bearer instructor-token',
      },
    });
    assert.equal(reviewForInstructor.statusCode, 200);

    const webhookPayload = JSON.stringify({
      ref: 'refs/heads/main',
      after: 'abc123',
      repository: {
        name: 'nibras-cs161-exam1',
        html_url: 'https://github.com/demo-user/nibras-cs161-exam1',
        owner: { login: 'demo-user' },
      },
    });
    const signature = `sha256=${crypto.createHmac('sha256', 'webhook-secret').update(webhookPayload).digest('hex')}`;
    const webhook = await app.inject({
      method: 'POST',
      url: '/v1/github/webhooks',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'push',
        'x-hub-signature-256': signature,
        'x-github-delivery': 'delivery-1',
      },
      payload: webhookPayload,
    });
    assert.equal(webhook.statusCode, 200);

    const commits = await app.inject({
      method: 'GET',
      url: `/v1/tracking/submissions/${submissionId}/commits`,
      headers: {
        authorization: 'Bearer instructor-token',
      },
    });
    assert.equal(commits.statusCode, 200);
    const deliveries = commits.json();
    assert.equal(deliveries[0].deliveryId, 'delivery-1');
    assert.equal(deliveries[0].commitSha, 'abc123');

    const milestoneSubmissions = await app.inject({
      method: 'GET',
      url: `/v1/tracking/milestones/${milestoneId}/submissions`,
      headers: {
        authorization: 'Bearer instructor-token',
      },
    });
    assert.equal(milestoneSubmissions.statusCode, 200);
    assert.equal(milestoneSubmissions.json()[0].id, submissionId);
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
