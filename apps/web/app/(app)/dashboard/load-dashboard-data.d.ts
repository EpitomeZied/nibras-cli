import type {
  GitHubConfigResponse,
  MeResponse,
  StudentProjectsDashboardResponse
} from "@nibras/contracts";

export type GitHubAppStatus = "configured" | "unconfigured" | "unavailable";

export type LoadDashboardDataResult = {
  me: MeResponse;
  dashboard: StudentProjectsDashboardResponse;
  githubConfig: GitHubConfigResponse | null;
  installUrl: string;
  githubAppMessage: string;
  githubAppStatus: GitHubAppStatus;
};

export function loadDashboardData(args: {
  fetchJson: (path: string, init?: RequestInit & { auth?: boolean }) => Promise<unknown>;
}): Promise<LoadDashboardDataResult>;
