import { serviceFetch } from '../api-clients/service-fetch';

export type GradesPayloadCourse = {
  courseId: string;
  code: string;
  title: string;
  grade?: number | null;
  letter?: string | null;
  credits?: number;
};

export type GradesPayload = {
  studentId?: string;
  courses: GradesPayloadCourse[];
  gpa?: number;
  completedCredits?: number;
};

export type RecommendationTrack = {
  trackId: string;
  name: string;
  description?: string;
  score: number;
  matchedSkills?: string[];
  missingSkills?: string[];
  suggestedCourses?: Array<{ courseId: string; code: string; title: string }>;
};

export type RecommendationResponse = {
  recommended: RecommendationTrack[];
  rationale?: string;
  computedAt?: string;
};

export async function getGradesPayload(): Promise<GradesPayload> {
  try {
    return await serviceFetch<GradesPayload>('tracking', '/v1/programs/student/me/sheet', {
      auth: true,
    });
  } catch {
    return { courses: [] };
  }
}

export async function recommendTrack(payload: GradesPayload): Promise<RecommendationResponse> {
  return serviceFetch<RecommendationResponse>('recommendation', '/recommend', {
    method: 'POST',
    auth: true,
    body: payload as unknown as Record<string, unknown>,
  });
}
