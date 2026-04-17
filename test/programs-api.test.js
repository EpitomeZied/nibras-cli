const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildApp } = require('../apps/api/dist/app');
const { FileStore } = require('../apps/api/dist/store');

function makeStorePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nibras-programs-'));
  return path.join(dir, 'store.json');
}

function createAppWithSessions() {
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
  store.write(data);
  return { app: buildApp(new FileStore(storePath)), store: new FileStore(storePath) };
}

test('seeded programs endpoint returns the default CS program', async () => {
  const { app } = createAppWithSessions();
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/programs',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(response.statusCode, 200);
    const programs = response.json();
    assert.equal(programs[0].code, 'CS');
    assert.equal(programs[0].slug, 'cs-program');
    assert.ok(programs[0].activeVersionId);
  } finally {
    await app.close();
  }
});

test('instructor can create a program version, track, catalog course, and requirement group', async () => {
  const { app } = createAppWithSessions();
  try {
    const createdProgram = await app.inject({
      method: 'POST',
      url: '/v1/programs',
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        slug: 'se-program',
        title: 'Software Engineering Program',
        code: 'SE',
        academicYear: '2026-2027',
        totalUnitRequirement: 128,
        status: 'draft',
      }),
    });
    assert.equal(createdProgram.statusCode, 201);
    const program = createdProgram.json();

    const createdVersion = await app.inject({
      method: 'POST',
      url: `/v1/programs/${program.id}/versions`,
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        versionLabel: 'v1',
        effectiveFrom: null,
        effectiveTo: null,
        isActive: true,
        policyText: 'Track starts in Year 2.',
        trackSelectionMinYear: 2,
      }),
    });
    assert.equal(createdVersion.statusCode, 201);
    const version = createdVersion.json();

    const createdCourse = await app.inject({
      method: 'POST',
      url: `/v1/programs/${program.id}/catalog-courses`,
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        subjectCode: 'SE',
        catalogNumber: '201',
        title: 'Requirements Engineering',
        defaultUnits: 3,
        department: 'Software Engineering',
      }),
    });
    assert.equal(createdCourse.statusCode, 201);
    const catalogCourse = createdCourse.json();

    const createdTrack = await app.inject({
      method: 'POST',
      url: `/v1/programs/${program.id}/tracks`,
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        programVersionId: version.id,
        slug: 'product-engineering',
        title: 'Product Engineering',
        description: 'Build and ship software products.',
        selectionYearStart: 2,
      }),
    });
    assert.equal(createdTrack.statusCode, 201);

    const createdGroup = await app.inject({
      method: 'POST',
      url: `/v1/programs/${program.id}/requirement-groups`,
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        programVersionId: version.id,
        trackId: null,
        title: 'SE Core',
        category: 'core',
        minUnits: 3,
        minCourses: 1,
        notes: 'Core software engineering study.',
        sortOrder: 1,
        noDoubleCount: true,
        rules: [
          {
            ruleType: 'required',
            pickCount: null,
            note: '',
            sortOrder: 1,
            courses: [{ catalogCourseId: catalogCourse.id }],
          },
        ],
      }),
    });
    assert.equal(createdGroup.statusCode, 201);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/programs/${program.id}/versions/${version.id}`,
      headers: { authorization: 'Bearer instructor-token' },
    });
    assert.equal(detail.statusCode, 200);
    const payload = detail.json();
    assert.equal(payload.tracks[0].slug, 'product-engineering');
    assert.equal(payload.catalogCourses[0].subjectCode, 'SE');
    assert.equal(payload.requirementGroups[0].title, 'SE Core');
  } finally {
    await app.close();
  }
});

test('student cannot select a track before year 2, then can after advancing year level', async () => {
  const { app, store } = createAppWithSessions();
  try {
    const initialPlan = await app.inject({
      method: 'GET',
      url: '/v1/programs/student/me',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(initialPlan.statusCode, 200);
    const plan = initialPlan.json();
    assert.equal(plan.canSelectTrack, false);

    const rejected = await app.inject({
      method: 'POST',
      url: '/v1/programs/student/me/select-track',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ trackId: plan.availableTracks[0].id }),
    });
    assert.equal(rejected.statusCode, 409);

    const data = store.read('http://127.0.0.1');
    const student = data.users.find((entry) => entry.id === 'user_demo');
    student.yearLevel = 2;
    store.write(data);

    const accepted = await app.inject({
      method: 'POST',
      url: '/v1/programs/student/me/select-track',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ trackId: plan.availableTracks[0].id }),
    });
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.json().selectedTrack.id, plan.availableTracks[0].id);
  } finally {
    await app.close();
  }
});

test('program petitions, approvals, and sheet generation work end to end', async () => {
  const { app, store } = createAppWithSessions();
  try {
    const data = store.read('http://127.0.0.1');
    data.users.find((entry) => entry.id === 'user_demo').yearLevel = 2;
    store.write(data);

    const planResponse = await app.inject({
      method: 'GET',
      url: '/v1/programs/student/me',
      headers: { authorization: 'Bearer student-token' },
    });
    const plan = planResponse.json();
    const foundationGroup = plan.requirementGroups.find((group) => group.category === 'foundation');
    const firstCourseId = plan.catalogCourses[0].id;

    const updatedPlan = await app.inject({
      method: 'PATCH',
      url: '/v1/programs/student/me/plan',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        plannedCourses: [
          {
            catalogCourseId: firstCourseId,
            plannedYear: 1,
            plannedTerm: 'fall',
            sourceType: 'standard',
            note: null,
          },
        ],
      }),
    });
    assert.equal(updatedPlan.statusCode, 200);

    const petitionResponse = await app.inject({
      method: 'POST',
      url: '/v1/programs/student/me/petitions',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        type: 'waiver',
        justification: 'Approved external equivalency.',
        targetRequirementGroupId: foundationGroup.id,
      }),
    });
    assert.equal(petitionResponse.statusCode, 201);
    const petition = petitionResponse.json();

    const petitionApproval = await app.inject({
      method: 'PATCH',
      url: `/v1/programs/${plan.program.id}/petitions/${petition.id}`,
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        status: 'approved',
        reviewerNotes: 'Approved by staff.',
      }),
    });
    assert.equal(petitionApproval.statusCode, 200);

    const departmentBlocked = await app.inject({
      method: 'POST',
      url: `/v1/programs/${plan.program.id}/approvals/${plan.id}/department`,
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ status: 'approved', notes: null }),
    });
    assert.equal(departmentBlocked.statusCode, 409);

    const advisorApproval = await app.inject({
      method: 'POST',
      url: `/v1/programs/${plan.program.id}/approvals/${plan.id}/advisor`,
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ status: 'approved', notes: 'Advisor approved.' }),
    });
    assert.equal(advisorApproval.statusCode, 200);

    const departmentApproval = await app.inject({
      method: 'POST',
      url: `/v1/programs/${plan.program.id}/approvals/${plan.id}/department`,
      headers: {
        authorization: 'Bearer instructor-token',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ status: 'approved', notes: 'Department approved.' }),
    });
    assert.equal(departmentApproval.statusCode, 200);

    const generatedSheet = await app.inject({
      method: 'POST',
      url: '/v1/programs/student/me/generate-sheet',
      headers: { authorization: 'Bearer student-token' },
    });
    assert.equal(generatedSheet.statusCode, 201);
    const sheet = generatedSheet.json();
    assert.equal(sheet.approvals.find((entry) => entry.stage === 'department').status, 'approved');
    assert.ok(sheet.generatedAt);
    assert.ok(sheet.sections.some((section) => section.requirementGroupId === foundationGroup.id));
  } finally {
    await app.close();
  }
});
