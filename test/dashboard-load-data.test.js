const test = require('node:test');
const assert = require('node:assert/strict');

test('dashboard data loading fetches the role-aware home dashboard by default', async () => {
  const { loadDashboardData } =
    await import('../apps/web/app/(app)/dashboard/load-dashboard-data.js');
  const calls = [];

  const payload = await loadDashboardData({
    fetchJson: async (path) => {
      calls.push(path);
      if (path === '/v1/tracking/dashboard/home') {
        return {
          availableModes: ['student'],
          defaultMode: 'student',
          student: {
            courses: [],
            selectedCourseId: null,
            attentionItems: [],
            courseSnapshots: [],
            submissionHealth: {
              failedChecks: 0,
              needsReview: 0,
              awaitingReview: 0,
              recentlyPassed: 0,
            },
            recentSubmissions: [],
            blockers: [],
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    },
  });

  assert.equal(calls[0], '/v1/tracking/dashboard/home');
  assert.equal(payload.defaultMode, 'student');
  assert.deepEqual(payload.availableModes, ['student']);
});

test('dashboard data loading forwards the requested mode', async () => {
  const { loadDashboardData } =
    await import('../apps/web/app/(app)/dashboard/load-dashboard-data.js');
  const calls = [];

  await loadDashboardData({
    mode: 'instructor',
    fetchJson: async (path) => {
      calls.push(path);
      return {
        availableModes: ['instructor', 'student'],
        defaultMode: 'instructor',
        instructor: {
          reviewSummary: {
            totalAwaitingReview: 0,
            oldestWaitingMinutes: null,
            submittedLast24Hours: 0,
            byCourse: [],
          },
          urgentQueue: [],
          courseSummaries: [],
          recentActivity: [],
          operations: [],
        },
      };
    },
  });

  assert.equal(calls[0], '/v1/tracking/dashboard/home?mode=instructor');
  assert.deepEqual(calls.length, 1);
});

test('dashboard data loading propagates fetch failures', async () => {
  const { loadDashboardData } =
    await import('../apps/web/app/(app)/dashboard/load-dashboard-data.js');

  await assert.rejects(
    loadDashboardData({
      fetchJson: async () => {
        throw new Error('Dashboard unavailable');
      },
    }),
    /Dashboard unavailable/
  );
});

test('dashboard data loading marks requests as authenticated', async () => {
  const { loadDashboardData } =
    await import('../apps/web/app/(app)/dashboard/load-dashboard-data.js');
  const calls = [];

  await loadDashboardData({
    fetchJson: async (path, init) => {
      calls.push({ path, init });
      return {
        availableModes: ['student'],
        defaultMode: 'student',
        student: {
          courses: [],
          selectedCourseId: null,
          attentionItems: [],
          courseSnapshots: [],
          submissionHealth: {
            failedChecks: 0,
            needsReview: 0,
            awaitingReview: 0,
            recentlyPassed: 0,
          },
          recentSubmissions: [],
          blockers: [],
        },
      };
    },
  });

  assert.equal(calls[0].path, '/v1/tracking/dashboard/home');
  assert.equal(calls[0].init.auth, true);
});
