const test = require('node:test');
const assert = require('node:assert/strict');

test('dashboard route loading falls back to the API default when no mode is provided', async () => {
  const { loadDashboardRouteData } =
    await import('../apps/web/app/(app)/dashboard/dashboard-runtime.js');
  const calls = [];

  const result = await loadDashboardRouteData({
    fetchJson: async (path) => {
      calls.push(path);
      return {
        availableModes: ['instructor', 'student'],
        defaultMode: 'instructor',
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

  assert.deepEqual(calls, ['/v1/tracking/dashboard/home']);
  assert.equal(result.activeMode, 'instructor');
  assert.equal(result.resetModeQuery, false);
});

test('dashboard route loading clears invalid mode parameters after using the default payload', async () => {
  const { loadDashboardRouteData } =
    await import('../apps/web/app/(app)/dashboard/dashboard-runtime.js');

  const result = await loadDashboardRouteData({
    requestedMode: 'invalid-mode',
    fetchJson: async () => ({
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
    }),
  });

  assert.equal(result.activeMode, 'student');
  assert.equal(result.requestedMode, null);
  assert.equal(result.resetModeQuery, true);
});

test('dashboard route loading retries without the mode when the override is unavailable', async () => {
  const { loadDashboardRouteData } =
    await import('../apps/web/app/(app)/dashboard/dashboard-runtime.js');
  const calls = [];

  const result = await loadDashboardRouteData({
    requestedMode: 'instructor',
    fetchJson: async (path) => {
      calls.push(path);
      if (path === '/v1/tracking/dashboard/home?mode=instructor') {
        const error = new Error('Forbidden');
        error.status = 403;
        throw error;
      }
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

  assert.deepEqual(calls, [
    '/v1/tracking/dashboard/home?mode=instructor',
    '/v1/tracking/dashboard/home',
  ]);
  assert.equal(result.activeMode, 'student');
  assert.equal(result.requestedMode, null);
  assert.equal(result.resetModeQuery, true);
});
