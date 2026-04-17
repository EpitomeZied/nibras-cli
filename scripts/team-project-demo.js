#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_LEVEL = 'silent';

function requireBuiltModule(modulePath) {
  try {
    return require(modulePath);
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      console.error('Build artifacts are missing. Run `npm run build` first.');
      process.exit(1);
    }
    throw error;
  }
}

const { buildApp } = requireBuiltModule('../apps/api/dist/app');
const { FileStore } = requireBuiltModule('../apps/api/dist/store');

function makeStorePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nibras-team-demo-'));
  return path.join(dir, 'store.json');
}

function addSession(data, userId, accessToken) {
  data.sessions.push({
    accessToken,
    refreshToken: `${accessToken}-refresh`,
    userId,
    createdAt: new Date().toISOString(),
  });
}

function addStudent(data, { id, username, email, githubLogin, level, token }) {
  const now = new Date().toISOString();
  data.users.push({
    id,
    username,
    email,
    githubLogin,
    githubLinked: true,
    githubAppInstalled: true,
    systemRole: 'user',
    yearLevel: level,
  });
  data.githubAccounts.push({
    userId: id,
    login: githubLogin,
    installationId: `inst-${id}`,
    userAccessToken: `github-token-${id}`,
  });
  data.courseMemberships.push({
    id: `membership_${id}_cs161`,
    courseId: 'course_cs161',
    userId: id,
    role: 'student',
    level,
    createdAt: now,
    updatedAt: now,
  });
  addSession(data, id, token);
}

async function api(app, method, url, token, payload) {
  const response = await app.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${token}`,
      ...(payload ? { 'content-type': 'application/json' } : {}),
    },
    payload: payload ? JSON.stringify(payload) : undefined,
  });

  const text = response.body || '';
  const body = text ? JSON.parse(text) : null;
  if (response.statusCode >= 400) {
    const error = new Error(`${method} ${url} failed with ${response.statusCode}`);
    error.response = { statusCode: response.statusCode, body };
    throw error;
  }
  return body;
}

function heading(title) {
  console.log(`\n=== ${title} ===`);
}

function printJson(label, value) {
  console.log(`${label}: ${JSON.stringify(value, null, 2)}`);
}

async function main() {
  const storePath = makeStorePath();
  const store = new FileStore(storePath);
  const data = store.read('http://127.0.0.1');

  addSession(data, 'user_instructor', 'instructor-token');
  addSession(data, 'user_demo', 'student-demo-token');
  addStudent(data, {
    id: 'user_sara',
    username: 'sara',
    email: 'sara@nibras.dev',
    githubLogin: 'sara-demo',
    level: 2,
    token: 'student-sara-token',
  });
  addStudent(data, {
    id: 'user_omar',
    username: 'omar',
    email: 'omar@nibras.dev',
    githubLogin: 'omar-demo',
    level: 3,
    token: 'student-omar-token',
  });
  store.write(data);

  const app = buildApp(new FileStore(storePath));

  try {
    heading('1. Instructor Creates A Team Template');
    const template = await api(
      app,
      'POST',
      '/v1/tracking/courses/course_cs161/templates',
      'instructor-token',
      {
        slug: 'capstone-team-template',
        title: 'Capstone Team Template',
        description: 'Three-person team project with fixed role slots.',
        deliveryMode: 'team',
        teamSize: 3,
        status: 'active',
        rubric: [{ criterion: 'Delivery', maxScore: 100 }],
        resources: [{ label: 'Spec', url: 'https://example.com/capstone-spec' }],
        roles: [
          { key: 'backend', label: 'Backend Engineer', count: 1, sortOrder: 0 },
          { key: 'frontend', label: 'Frontend Engineer', count: 1, sortOrder: 1 },
          { key: 'pm', label: 'Project Manager', count: 1, sortOrder: 2 },
        ],
        milestones: [
          {
            title: 'Team Final Submission',
            description: 'Shared team delivery milestone.',
            order: 1,
            dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            isFinal: true,
          },
        ],
      }
    );
    printJson('Template summary', {
      id: template.id,
      title: template.title,
      teamSize: template.teamSize,
      roles: template.roles.map((role) => `${role.label} x${role.count}`),
    });

    heading('2. Instructor Creates A Project From That Template');
    const project = await api(app, 'POST', '/v1/tracking/projects', 'instructor-token', {
      courseId: 'course_cs161',
      slug: 'cs161/team-capstone-demo',
      title: 'Team Capstone Demo',
      description: 'Demo project for template -> application -> teams -> submission.',
      status: 'published',
      deliveryMode: 'team',
      templateId: template.id,
      applicationOpenAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      applicationCloseAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      teamLockAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
    const projectDetail = await api(
      app,
      'GET',
      `/v1/tracking/projects/${project.id}`,
      'instructor-token'
    );
    const milestone = projectDetail.milestones[0];
    printJson('Project summary', {
      id: project.id,
      title: project.title,
      teamFormationStatus: project.teamFormationStatus,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
    });

    heading('3. Students Apply For Roles');
    const applications = await Promise.all([
      api(
        app,
        'POST',
        `/v1/tracking/projects/${project.id}/applications`,
        'student-demo-token',
        {
          statement: 'I can handle the API and database layer.',
          availabilityNote: 'Available evenings.',
          preferences: [{ templateRoleId: template.roles[0].id, rank: 1 }],
        }
      ),
      api(
        app,
        'POST',
        `/v1/tracking/projects/${project.id}/applications`,
        'student-sara-token',
        {
          statement: 'I can own the frontend and polish the UI.',
          availabilityNote: 'Available afternoons.',
          preferences: [{ templateRoleId: template.roles[1].id, rank: 1 }],
        }
      ),
      api(
        app,
        'POST',
        `/v1/tracking/projects/${project.id}/applications`,
        'student-omar-token',
        {
          statement: 'I can coordinate the team and keep milestones on track.',
          availabilityNote: 'Available mornings.',
          preferences: [{ templateRoleId: template.roles[2].id, rank: 1 }],
        }
      ),
    ]);
    printJson(
      'Applications',
      applications.map((application) => ({
        userId: application.userId,
        preferenceRanks: application.preferences.map((preference) => preference.rank),
      }))
    );

    heading('4. Instructor Generates Suggested Teams');
    const run = await api(
      app,
      'POST',
      `/v1/tracking/projects/${project.id}/team-formation/generate`,
      'instructor-token',
      { algorithmVersion: 'v1-demo' }
    );
    printJson('Generated teams', run.result.teams);
    printJson('Waitlist', run.result.waitlist);

    heading('5. Instructor Locks Teams');
    const lockedTeams = await api(
      app,
      'POST',
      `/v1/tracking/projects/${project.id}/team-formation/lock`,
      'instructor-token',
      { formationRunId: run.id }
    );
    printJson(
      'Locked teams',
      lockedTeams.map((team) => ({
        id: team.id,
        name: team.name,
        repo: team.repo?.cloneUrl || null,
        members: team.members.map((member) => ({
          userId: member.userId,
          role: member.roleLabel,
        })),
      }))
    );

    heading('6. Student Views Their Team');
    const studentTeams = await api(
      app,
      'GET',
      `/v1/tracking/projects/${project.id}/teams`,
      'student-demo-token'
    );
    printJson(
      'Visible teams for demo student',
      studentTeams.map((team) => ({
        name: team.name,
        members: team.members.map((member) => `${member.userId}:${member.roleLabel}`),
      }))
    );

    heading('7. A Team Member Submits For The Whole Team');
    const submission = await api(
      app,
      'POST',
      `/v1/tracking/milestones/${milestone.id}/submissions`,
      'student-demo-token',
      {
        submissionType: 'github',
        submissionValue: 'https://github.com/demo-org/team-capstone-alpha',
        notes: 'Submitting the shared team repo.',
        repoUrl: 'https://github.com/demo-org/team-capstone-alpha',
        branch: 'main',
        commitSha: 'demo123commit',
      }
    );
    printJson('Created submission', {
      id: submission.id,
      teamId: submission.teamId,
      teamName: submission.teamName,
      submittedByUserId: submission.submittedByUserId,
      repoUrl: submission.repoUrl,
      status: submission.status,
    });

    heading('8. Another Teammate Can See The Same Team Submission');
    const visibleSubmissions = await api(
      app,
      'GET',
      `/v1/tracking/milestones/${milestone.id}/submissions`,
      'student-sara-token'
    );
    printJson(
      'Milestone submissions visible to a teammate',
      visibleSubmissions.map((entry) => ({
        id: entry.id,
        teamName: entry.teamName,
        submittedByUserId: entry.submittedByUserId,
        teamMemberUserIds: entry.teamMemberUserIds,
      }))
    );

    heading('Done');
    console.log('Demo completed successfully.');
    console.log(`Store file: ${storePath}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('\nDemo failed.');
  if (error.response) {
    console.error(JSON.stringify(error.response, null, 2));
  } else {
    console.error(error);
  }
  process.exit(1);
});
