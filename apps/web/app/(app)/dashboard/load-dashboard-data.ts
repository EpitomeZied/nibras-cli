import type { StudentProjectsDashboardResponse, TrackingCourseSummary } from '@nibras/contracts';

const GITHUB_APP_UNCONFIGURED_MESSAGE =
  'GitHub App installation is not configured for this deployment.';
const GITHUB_APP_UNAVAILABLE_MESSAGE = 'GitHub App status is temporarily unavailable.';

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type FetchJson = (path: string, init?: RequestInit & { auth?: boolean }) => Promise<unknown>;

type GithubConfig = {
  configured: boolean;
};

type InstallPayload = {
  installUrl?: string;
};

type MePayload = {
  user?: {
    username?: string;
    email?: string;
    githubLogin?: string | null;
    githubLinked?: boolean;
    githubAppInstalled?: boolean;
    systemRole?: string | null;
  };
};

export type LoadDashboardDataResult = {
  me: MePayload;
  courses: TrackingCourseSummary[];
  dashboard: StudentProjectsDashboardResponse;
  githubConfig: GithubConfig | null;
  installUrl: string;
  githubAppMessage: string;
  githubAppStatus: 'configured' | 'unconfigured' | 'unavailable';
};

export async function loadDashboardData({
  fetchJson,
  courseId,
}: {
  fetchJson: FetchJson;
  courseId?: string | null;
}): Promise<LoadDashboardDataResult> {
  const dashboardPath = courseId
    ? `/v1/tracking/dashboard/student?courseId=${encodeURIComponent(courseId)}`
    : '/v1/tracking/dashboard/student';
  const githubConfigResultPromise = fetchJson('/v1/github/config')
    .then((githubConfig) => ({
      status: 'fulfilled' as const,
      githubConfig: githubConfig as GithubConfig,
    }))
    .catch((error: unknown) => ({ status: 'rejected' as const, error }));

  const [me, courses, dashboard] = await Promise.all([
    fetchJson('/v1/web/session', { auth: true }),
    fetchJson('/v1/tracking/courses', { auth: true }),
    fetchJson(dashboardPath, { auth: true }),
  ]);

  const githubConfigResult = await githubConfigResultPromise;

  if (githubConfigResult.status === 'rejected') {
    return {
      me: me as MePayload,
      courses: courses as TrackingCourseSummary[],
      dashboard: dashboard as StudentProjectsDashboardResponse,
      githubConfig: null,
      installUrl: '',
      githubAppMessage: GITHUB_APP_UNAVAILABLE_MESSAGE,
      githubAppStatus: 'unavailable',
    };
  }

  const { githubConfig } = githubConfigResult;

  if (!githubConfig.configured) {
    return {
      me: me as MePayload,
      courses: courses as TrackingCourseSummary[],
      dashboard: dashboard as StudentProjectsDashboardResponse,
      githubConfig,
      installUrl: '',
      githubAppMessage: GITHUB_APP_UNCONFIGURED_MESSAGE,
      githubAppStatus: 'unconfigured',
    };
  }

  try {
    const installPayload = (await fetchJson('/v1/github/install-url', {
      auth: true,
    })) as InstallPayload;
    return {
      me: me as MePayload,
      courses: courses as TrackingCourseSummary[],
      dashboard: dashboard as StudentProjectsDashboardResponse,
      githubConfig,
      installUrl: installPayload.installUrl || '',
      githubAppMessage: '',
      githubAppStatus: 'configured',
    };
  } catch (error) {
    return {
      me: me as MePayload,
      courses: courses as TrackingCourseSummary[],
      dashboard: dashboard as StudentProjectsDashboardResponse,
      githubConfig,
      installUrl: '',
      githubAppMessage: toErrorMessage(error),
      githubAppStatus: 'configured',
    };
  }
}
