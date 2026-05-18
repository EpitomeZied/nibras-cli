import { serviceFetch } from '../api-clients/service-fetch';

export type CommunityAuthor = {
  userId: string;
  username: string;
  avatarUrl?: string;
  reputation?: number;
  badges?: number;
};

export type CommunityQuestion = {
  id: string;
  title: string;
  body: string;
  author: CommunityAuthor;
  tags: string[];
  score: number;
  myVote?: 1 | 0 | -1;
  answerCount: number;
  acceptedAnswerId?: string | null;
  views?: number;
  createdAt: string;
  updatedAt?: string;
};

export type CommunityAnswer = {
  id: string;
  questionId: string;
  body: string;
  author: CommunityAuthor;
  score: number;
  myVote?: 1 | 0 | -1;
  accepted: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type CommunityThread = {
  id: string;
  courseId?: string;
  title: string;
  body?: string;
  author: CommunityAuthor;
  tags: string[];
  replyCount: number;
  pinned: boolean;
  closed: boolean;
  createdAt: string;
  lastActivityAt?: string;
};

export type CommunityPost = {
  id: string;
  threadId: string;
  body: string;
  author: CommunityAuthor;
  score: number;
  myVote?: 1 | 0 | -1;
  createdAt: string;
};

export type CommunityTag = {
  name: string;
  count: number;
  description?: string;
};

export type QuestionFilters = {
  q?: string;
  tag?: string;
  sort?: 'newest' | 'top' | 'unanswered' | 'active';
  page?: number;
  limit?: number;
};

export type ThreadFilters = {
  q?: string;
  tag?: string;
  pinned?: boolean;
  closed?: boolean;
  page?: number;
  limit?: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

type VoteValue = 1 | -1;

type LegacyVoteResponse = {
  message?: string;
  action?: string;
  voteValue?: number;
  votesCount?: number;
};

function toQuery(filters: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}

function normalizeVoteResponse(
  body: LegacyVoteResponse
): { score: number; myVote: 1 | 0 | -1 } {
  const score = typeof body.votesCount === 'number' ? body.votesCount : 0;
  const raw = typeof body.voteValue === 'number' ? body.voteValue : 0;
  const myVote = raw === 1 ? 1 : raw === -1 ? -1 : 0;
  return { score, myVote };
}

// ── Questions ───────────────────────────────────────────────────────────────
export async function listQuestions(filters: QuestionFilters = {}) {
  return serviceFetch<Paginated<CommunityQuestion>>('community', '/community/questions', {
    auth: true,
    query: toQuery(filters),
  });
}

export async function getQuestion(questionId: string) {
  return serviceFetch<CommunityQuestion>(
    'community',
    `/community/questions/${questionId}`,
    { auth: true }
  );
}

export async function createQuestion(payload: {
  title: string;
  body: string;
  tags?: string[];
}) {
  return serviceFetch<CommunityQuestion>('community', '/community/questions', {
    method: 'POST',
    auth: true,
    body: payload as Record<string, unknown>,
  });
}

export async function voteQuestion(questionId: string, direction: VoteValue) {
  const body = await serviceFetch<LegacyVoteResponse>('community', '/community/votes', {
    method: 'POST',
    auth: true,
    body: { targetType: 'question', targetId: questionId, value: direction },
  });
  return normalizeVoteResponse(body);
}

// ── Answers ─────────────────────────────────────────────────────────────────
export async function listAnswers(questionId: string) {
  return serviceFetch<CommunityAnswer[]>(
    'community',
    `/community/answers/question/${questionId}`,
    { auth: true }
  );
}

export async function createAnswer(questionId: string, body: string) {
  return serviceFetch<CommunityAnswer>(
    'community',
    `/community/answers/${questionId}`,
    {
      method: 'POST',
      auth: true,
      body: { body },
    }
  );
}

export async function voteAnswer(answerId: string, direction: VoteValue) {
  const body = await serviceFetch<LegacyVoteResponse>('community', '/community/votes', {
    method: 'POST',
    auth: true,
    body: { targetType: 'answer', targetId: answerId, value: direction },
  });
  return normalizeVoteResponse(body);
}

export async function acceptAnswer(answerId: string) {
  return serviceFetch<{ accepted: true }>(
    'community',
    `/community/answers/${answerId}/accept`,
    {
      method: 'PATCH',
      auth: true,
      body: {},
    }
  );
}

// ── Discussions / Threads ───────────────────────────────────────────────────
//
// The legacy backend exposes threads only PER COURSE. There is no global
// "all courses" list endpoint — the page must pick a course first.
export async function listThreads(courseId: string, filters: ThreadFilters = {}) {
  return serviceFetch<Paginated<CommunityThread>>(
    'community',
    `/community/threads/course/${courseId}`,
    {
      auth: true,
      query: toQuery(filters),
    }
  );
}

export async function getThread(threadId: string) {
  return serviceFetch<CommunityThread>(
    'community',
    `/community/threads/${threadId}`,
    { auth: true }
  );
}

export async function createThread(
  courseId: string,
  payload: {
    title: string;
    body?: string;
    tags?: string[];
  }
) {
  return serviceFetch<CommunityThread>(
    'community',
    `/community/threads/${courseId}`,
    {
      method: 'POST',
      auth: true,
      body: payload as Record<string, unknown>,
    }
  );
}

export async function setThreadPinned(threadId: string, pinned: boolean) {
  return serviceFetch<CommunityThread>(
    'community',
    `/community/threads/${threadId}/${pinned ? 'pin' : 'unpin'}`,
    {
      method: 'PATCH',
      auth: true,
      body: {},
    }
  );
}

export async function setThreadClosed(threadId: string, closed: boolean) {
  return serviceFetch<CommunityThread>(
    'community',
    `/community/threads/${threadId}/${closed ? 'close' : 'open'}`,
    {
      method: 'PATCH',
      auth: true,
      body: {},
    }
  );
}

// ── Posts ───────────────────────────────────────────────────────────────────
export async function listPosts(threadId: string) {
  return serviceFetch<CommunityPost[]>(
    'community',
    `/community/posts/thread/${threadId}`,
    { auth: true }
  );
}

export async function createPost(threadId: string, body: string) {
  return serviceFetch<CommunityPost>(
    'community',
    `/community/posts/${threadId}`,
    {
      method: 'POST',
      auth: true,
      body: { body },
    }
  );
}

export async function votePost(postId: string, direction: VoteValue) {
  const body = await serviceFetch<LegacyVoteResponse>('community', '/community/votes', {
    method: 'POST',
    auth: true,
    body: { targetType: 'post', targetId: postId, value: direction },
  });
  return normalizeVoteResponse(body);
}

// ── Tags ────────────────────────────────────────────────────────────────────
export async function listTags(): Promise<CommunityTag[]> {
  const data = await serviceFetch<CommunityTag[] | { tags: CommunityTag[] }>(
    'community',
    '/community/tags',
    { auth: true }
  );
  if (Array.isArray(data)) return data;
  return data?.tags ?? [];
}
