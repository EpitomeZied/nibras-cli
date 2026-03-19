import {
  InstructorDashboardResponse,
  InstructorDashboardResponseSchema,
  StudentProjectsDashboardResponse,
  StudentProjectsDashboardResponseSchema,
  TrackingMilestone,
  TrackingProjectSummary
} from "@nibras/contracts";
import { MilestoneRecord, ProjectRecord, ReviewRecord, StudentDashboardRecord, SubmissionRecord } from "../../../store";

function formatDateLabel(value: string | null): string {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function milestoneStatus(milestoneId: string, submissions: SubmissionRecord[], reviews: ReviewRecord[]): string {
  const latestSubmission = submissions
    .filter((entry) => entry.milestoneId === milestoneId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (!latestSubmission) {
    return "open";
  }
  const latestReview = reviews
    .filter((entry) => entry.submissionId === latestSubmission.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (!latestReview) {
    return "submitted";
  }
  return latestReview.status === "changes_requested" ? "submitted" : latestReview.status;
}

export function presentMilestone(
  milestone: MilestoneRecord,
  submissions: SubmissionRecord[],
  reviews: ReviewRecord[]
): TrackingMilestone {
  const status = milestoneStatus(milestone.id, submissions, reviews);
  return {
    id: milestone.id,
    projectId: milestone.projectId,
    title: milestone.title,
    description: milestone.description,
    order: milestone.order,
    dueAt: milestone.dueAt,
    dueDateLabel: formatDateLabel(milestone.dueAt),
    status,
    statusLabel: statusLabel(status),
    isFinal: milestone.isFinal
  };
}

export function presentProject(project: ProjectRecord): TrackingProjectSummary {
  const rubricTotal = project.rubric.reduce((sum, item) => sum + (item.maxScore || 0), 0);
  return {
    id: project.id,
    projectKey: project.projectKey,
    courseId: project.courseId || "",
    title: project.title,
    description: project.description,
    status: project.status,
    deliveryMode: project.deliveryMode,
    gradeWeight: rubricTotal ? `${rubricTotal} pts rubric` : null,
    startDate: null,
    endDate: null,
    instructorName: project.instructorUserId ? "Course Staff" : null,
    type: project.deliveryMode === "team" ? "Team" : "Individual",
    rubric: project.rubric,
    resources: project.resources,
    team: []
  };
}

export function presentStudentDashboard(args: {
  dashboard: StudentDashboardRecord;
  submissionsByMilestone: Record<string, SubmissionRecord[]>;
  reviewsByMilestone: Record<string, ReviewRecord[]>;
}): StudentProjectsDashboardResponse {
  const milestonesByProject = Object.fromEntries(
    Object.entries(args.dashboard.milestonesByProject).map(([projectId, milestones]) => {
      const rendered = milestones.map((milestone) => presentMilestone(
        milestone,
        args.submissionsByMilestone[milestone.id] || [],
        args.reviewsByMilestone[milestone.id] || []
      ));
      return [projectId, rendered];
    })
  );

  return StudentProjectsDashboardResponseSchema.parse({
    course: args.dashboard.course,
    memberships: args.dashboard.memberships.map((entry) => ({
      courseId: entry.courseId,
      userId: entry.userId,
      role: entry.role
    })),
    projects: args.dashboard.projects.map(presentProject),
    milestonesByProject,
    activeProjectId: args.dashboard.activeProjectId,
    activity: args.dashboard.activity,
    statsByProject: args.dashboard.statsByProject,
    pageError: args.dashboard.pageError
  });
}

export function presentInstructorDashboard(value: InstructorDashboardResponse): InstructorDashboardResponse {
  return InstructorDashboardResponseSchema.parse(value);
}
