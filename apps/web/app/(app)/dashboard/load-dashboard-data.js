const GITHUB_APP_UNCONFIGURED_MESSAGE =
  'GitHub App installation is not configured for this deployment.';
const GITHUB_APP_UNAVAILABLE_MESSAGE = 'GitHub App status is temporarily unavailable.';

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function loadDashboardData({ fetchJson, courseId }) {
  const dashboardPath = courseId
    ? `/v1/tracking/dashboard/student?courseId=${encodeURIComponent(courseId)}`
    : '/v1/tracking/dashboard/student';
  const githubConfigResultPromise = fetchJson('/v1/github/config')
    .then((githubConfig) => ({ status: 'fulfilled', githubConfig }))
    .catch((error) => ({ status: 'rejected', error }));

  const [me, courses, dashboard] = await Promise.all([
    fetchJson('/v1/web/session', { auth: true }),
    fetchJson('/v1/tracking/courses', { auth: true }),
    fetchJson(dashboardPath, { auth: true }),
  ]);

  const githubConfigResult = await githubConfigResultPromise;

  if (githubConfigResult.status === 'rejected') {
    return {
      me,
      courses,
      dashboard,
      githubConfig: null,
      installUrl: '',
      githubAppMessage: GITHUB_APP_UNAVAILABLE_MESSAGE,
      githubAppStatus: 'unavailable',
    };
  }

  const { githubConfig } = githubConfigResult;

  if (!githubConfig.configured) {
    return {
      me,
      courses,
      dashboard,
      githubConfig,
      installUrl: '',
      githubAppMessage: GITHUB_APP_UNCONFIGURED_MESSAGE,
      githubAppStatus: 'unconfigured',
    };
  }

  try {
    const installPayload = await fetchJson('/v1/github/install-url', { auth: true });
    return {
      me,
      courses,
      dashboard,
      githubConfig,
      installUrl: installPayload.installUrl || '',
      githubAppMessage: '',
      githubAppStatus: 'configured',
    };
  } catch (error) {
    return {
      me,
      courses,
      dashboard,
      githubConfig,
      installUrl: '',
      githubAppMessage: toErrorMessage(error),
      githubAppStatus: 'configured',
    };
  }
}
