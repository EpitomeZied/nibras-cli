import { serviceFetch, serviceFetchOptional } from '../api-clients/service-fetch';

export type Contest = {
  id: string;
  name: string;
  host: 'codeforces' | 'leetcode' | 'atcoder' | 'nibras' | string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  url?: string;
  registered?: boolean;
  reminderSet?: boolean;
  bookmarked?: boolean;
};

export type PracticeProblem = {
  id: string;
  title: string;
  host: string;
  difficulty: number;
  tags: string[];
  url: string;
  solved?: boolean;
  bookmarked?: boolean;
};

export type RankingEntry = {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  delta?: number;
  contestsLast30d?: number;
  badges?: number;
};

export type ContestHistoryEntry = {
  contestId: string;
  name: string;
  startedAt: string;
  rank: number;
  participants: number;
  delta: number;
  ratingAfter: number;
};

export type LinkedAccount = {
  host: 'codeforces' | 'leetcode' | string;
  handle: string;
  verified: boolean;
  linkedAt?: string;
};

// ── Contests ────────────────────────────────────────────────────────────────
export async function listContests(filters: { upcoming?: boolean; host?: string } = {}) {
  return serviceFetch<Contest[]>('competitions', '/contests', {
    auth: true,
    query: filters as Record<string, string | boolean>,
  });
}

export async function setContestReminder(contestId: string, on: boolean) {
  return serviceFetch<{ reminderSet: boolean }>(
    'competitions',
    `/user-contests/${contestId}/reminder`,
    {
      method: 'POST',
      auth: true,
      body: { on },
    }
  );
}

export async function setContestBookmark(contestId: string, on: boolean) {
  return serviceFetch<{ bookmarked: boolean }>(
    'competitions',
    `/user-contests/${contestId}/bookmark`,
    {
      method: 'POST',
      auth: true,
      body: { on },
    }
  );
}

// ── Practice problems ───────────────────────────────────────────────────────
export async function listProblems(filters: {
  tag?: string;
  difficultyMin?: number;
  difficultyMax?: number;
  host?: string;
  q?: string;
  page?: number;
  limit?: number;
} = {}) {
  return serviceFetch<{ items: PracticeProblem[]; total: number }>(
    'competitions',
    '/problems',
    {
      auth: true,
      query: filters as Record<string, string | number>,
    }
  );
}

// Invented by the port: legacy dashboard doesn't expose problem bookmarks.
// Optional variant swallows 404 so the UI can hide the affordance silently.
// Returns the optimistic `on` value when the endpoint is unavailable so the
// caller can continue without crashing on `null`.
export async function setProblemBookmark(
  problemId: string,
  on: boolean
): Promise<{ bookmarked: boolean }> {
  const data = await serviceFetchOptional<{ bookmarked: boolean }>(
    'competitions',
    `/problems/${problemId}/bookmark`,
    {
      method: 'POST',
      auth: true,
      body: { on },
    }
  );
  return data ?? { bookmarked: on };
}

// ── Ranking ─────────────────────────────────────────────────────────────────
// Invented endpoint — degrades to empty list when backend returns 404.
export async function getRanking(host?: string): Promise<RankingEntry[]> {
  const data = await serviceFetchOptional<RankingEntry[]>('competitions', '/ranking', {
    auth: true,
    query: host ? { host } : undefined,
  });
  return data ?? [];
}

// ── History ─────────────────────────────────────────────────────────────────
export async function getMyHistory(host?: string): Promise<ContestHistoryEntry[]> {
  const data = await serviceFetchOptional<ContestHistoryEntry[]>(
    'competitions',
    '/contests/user-contests/history',
    {
      auth: true,
      query: host ? { host } : undefined,
    }
  );
  return data ?? [];
}

// ── Linked accounts ─────────────────────────────────────────────────────────
// Legacy backend has no GET list endpoint — only verify-flow POSTs. Degrade
// to empty so the chips section just renders empty.
export async function getLinkedAccounts(): Promise<LinkedAccount[]> {
  const data = await serviceFetchOptional<LinkedAccount[]>(
    'competitions',
    '/contests/accounts',
    { auth: true }
  );
  return data ?? [];
}

export async function linkAccount(payload: { host: string; handle: string; token?: string }) {
  return serviceFetch<LinkedAccount>('competitions', '/contests/accounts/link', {
    method: 'POST',
    auth: true,
    // Legacy contract uses `platform`, not `host`.
    body: {
      platform: payload.host,
      handle: payload.handle,
      ...(payload.token ? { token: payload.token } : {}),
    },
  });
}

// Invented by the port: legacy dashboard has no unlink endpoint.
export async function unlinkAccount(host: string): Promise<{ unlinked: true } | null> {
  return serviceFetchOptional<{ unlinked: true }>(
    'competitions',
    `/contests/accounts/${host}`,
    {
      method: 'DELETE',
      auth: true,
    }
  );
}
