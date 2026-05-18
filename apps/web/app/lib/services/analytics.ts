import { serviceFetchOptional } from '../api-clients/service-fetch';

export type AnalyticsRange = '7d' | '30d' | '90d' | 'term';

export type DateRangeFilters = {
  range?: AnalyticsRange;
  courseId?: string;
  from?: string;
  to?: string;
};

export type OverviewKpis = {
  activeStudents: number;
  activeStudentsDelta: number;
  submissionsThisWeek: number;
  submissionsDelta: number;
  passRate: number;
  passRateDelta: number;
  medianGrade: number;
};

export type OverviewSeries = {
  submissions: Array<{ date: string; value: number }>;
  passRate: Array<{ date: string; value: number }>;
};

export type OverviewResponse = {
  kpis: OverviewKpis;
  series: OverviewSeries;
  topRisingTopics: Array<{ topic: string; delta: number }>;
  flaggedCohorts: Array<{ cohort: string; reason: string }>;
};

export type CourseSummary = {
  courseId: string;
  code: string;
  title: string;
  enrolled: number;
  activeWeekly: number;
  completionRate: number;
  averageGrade: number;
  passRate: number;
};

export type EngagementBucket = {
  bucket: string;
  hours: number;
  sessions: number;
};

export type EngagementResponse = {
  totalHours: number;
  averageSession: number;
  retentionWeekly: number;
  byDay: EngagementBucket[];
  byCourse: Array<{ courseId: string; code: string; hours: number }>;
};

export type StudentRow = {
  studentId: string;
  username: string;
  email?: string;
  cohort?: string;
  hoursWeekly: number;
  averageGrade: number;
  riskLevel: 'low' | 'medium' | 'high';
  trend?: number;
};

export type StudentsResponse = {
  rows: StudentRow[];
  total: number;
};

// Aggregate instructor analytics endpoints were invented by the port. The
// legacy backend only exposes per-student / per-course endpoints, not the
// cross-course aggregates these pages need. Each function returns `null` when
// the backend 404s so the corresponding page renders `EmptyState`.

function toQuery(filters: DateRangeFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.range) out.range = filters.range;
  if (filters.courseId) out.courseId = filters.courseId;
  if (filters.from) out.from = filters.from;
  if (filters.to) out.to = filters.to;
  return out;
}

export async function getOverview(filters: DateRangeFilters = {}) {
  return serviceFetchOptional<OverviewResponse>('admin', '/analytics/overview', {
    auth: true,
    query: toQuery(filters),
  });
}

export async function getCourseSummaries(
  filters: DateRangeFilters = {}
): Promise<CourseSummary[]> {
  const data = await serviceFetchOptional<CourseSummary[]>('admin', '/analytics/courses', {
    auth: true,
    query: toQuery(filters),
  });
  return data ?? [];
}

export async function getEngagement(filters: DateRangeFilters = {}) {
  return serviceFetchOptional<EngagementResponse>('admin', '/analytics/engagement', {
    auth: true,
    query: toQuery(filters),
  });
}

export async function getStudents(
  filters: DateRangeFilters & { cohort?: string; risk?: StudentRow['riskLevel'] } = {}
): Promise<StudentsResponse> {
  const query = toQuery(filters);
  if (filters.cohort) query.cohort = filters.cohort;
  if (filters.risk) query.risk = filters.risk;
  const data = await serviceFetchOptional<StudentsResponse>('admin', '/analytics/students', {
    auth: true,
    query,
  });
  return data ?? { rows: [], total: 0 };
}
