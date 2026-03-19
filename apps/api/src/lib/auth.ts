import { FastifyReply, FastifyRequest } from "fastify";
import { AppStore, CourseMembershipRecord, UserRecord } from "../store";
import { requestBaseUrl } from "./request-base-url";

function getBearerToken(request: FastifyRequest): string | null {
  const raw = request.headers.authorization;
  if (!raw || !raw.startsWith("Bearer ")) {
    return null;
  }
  return raw.slice("Bearer ".length).trim();
}

export type AuthenticatedRequest = {
  token: string;
  user: UserRecord;
  memberships: CourseMembershipRecord[];
};

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
  store: AppStore
): Promise<AuthenticatedRequest | null> {
  const token = getBearerToken(request);
  if (!token) {
    reply.code(401).send({ error: "Missing bearer token." });
    return null;
  }
  const user = await store.getUserByToken(requestBaseUrl(request), token);
  if (!user) {
    reply.code(401).send({ error: "Invalid bearer token." });
    return null;
  }
  const memberships = await store.listCourseMemberships(requestBaseUrl(request), user.id);
  return { token, user, memberships };
}

export function hasCourseRole(
  auth: AuthenticatedRequest,
  courseId: string,
  allowedRoles: Array<CourseMembershipRecord["role"]>
): boolean {
  if (auth.user.systemRole === "admin") {
    return true;
  }
  return auth.memberships.some((entry) => entry.courseId === courseId && allowedRoles.includes(entry.role));
}

export function hasCourseAccess(auth: AuthenticatedRequest, courseId: string): boolean {
  return hasCourseRole(auth, courseId, ["student", "instructor", "ta"]);
}
