import type {
  GitHubConfigResponse,
  MeResponse,
  StudentProjectsDashboardResponse,
  TrackingCourseSummary,
} from '@nibras/contracts';

export type GitHubAppStatus = 'configured' | 'unconfigured' | 'unavailable';

export type LoadDashboardDataResult = {
  me: MeResponse;
  courses: TrackingCourseSummary[];
  dashboard: StudentProjectsDashboardResponse;
  githubConfig: GitHubConfigResponse | null;
  installUrl: string;
  githubAppMessage: string;
  githubAppStatus: GitHubAppStatus;
};

export function loadDashboardData(args: {
  fetchJson: (path: string, init?: RequestInit & { auth?: boolean }) => Promise<unknown>;
  courseId?: string | null;
}): Promise<LoadDashboardDataResult>;
