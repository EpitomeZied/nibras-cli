import { AuthenticatedRequest, hasCourseAccess, hasCourseRole } from "../../../lib/auth";
import { ProjectRecord, SubmissionRecord } from "../../../store";

export function canViewCourse(auth: AuthenticatedRequest, courseId: string): boolean {
  return hasCourseAccess(auth, courseId);
}

export function canManageCourse(auth: AuthenticatedRequest, courseId: string): boolean {
  return hasCourseRole(auth, courseId, ["instructor", "ta"]);
}

export function canManageProject(auth: AuthenticatedRequest, project: ProjectRecord): boolean {
  if (!project.courseId) {
    return false;
  }
  return canManageCourse(auth, project.courseId);
}

export function hasAnyInstructorAccess(auth: AuthenticatedRequest): boolean {
  if (auth.user.systemRole === "admin") {
    return true;
  }
  return auth.memberships.some((entry) => entry.role === "instructor" || entry.role === "ta");
}

export function canViewSubmission(
  auth: AuthenticatedRequest,
  project: ProjectRecord | null,
  submission: SubmissionRecord
): boolean {
  if (auth.user.systemRole === "admin" || submission.userId === auth.user.id) {
    return true;
  }
  if (!project) {
    return false;
  }
  return canManageProject(auth, project);
}
