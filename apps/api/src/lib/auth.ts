import { FastifyReply, FastifyRequest } from 'fastify';
import { AppStore, CourseMembershipRecord, UserRecord } from '../store';
import { requestBaseUrl } from './request-base-url';
import { Errors } from './errors';

function getBearerToken(request: FastifyRequest): string | null {
  const raw = request.headers.authorization;
  if (!raw || !raw.startsWith('Bearer ')) {
    return null;
  }
  return raw.slice('Bearer '.length).trim();
}

function getCookieValue(request: FastifyRequest, name: string): string | null {
  const raw = request.headers.cookie;
  if (!raw) {
    return null;
  }
  for (const part of raw.split(';')) {
    const [cookieName, ...rest] = part.trim().split('=');
    if (cookieName === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function getWebSessionToken(request: FastifyRequest): string | null {
  return getCookieValue(request, 'nibras_web_session');
}

export type AuthenticatedRequest = {
  authKind: 'bearer' | 'web';
  token: string;
  user: UserRecord;
  memberships: CourseMembershipRecord[];
};

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
  store: AppStore
): Promise<AuthenticatedRequest | null> {
  const apiBaseUrl = requestBaseUrl(request);
  const bearerToken = getBearerToken(request);
  const webSessionToken = getWebSessionToken(request);

  const authKind = bearerToken ? 'bearer' : webSessionToken ? 'web' : null;
  const token = bearerToken || webSessionToken;
  if (!authKind || !token) {
    reply.code(401).send(Errors.authRequired());
    return null;
  }

  // Bearer token may be either a CLI access token OR a web session token that
  // was passed via the ?st= redirect parameter (for browsers that block
  // cross-domain cookies). Try access token first, fall back to web session.
  const user =
    authKind === 'bearer'
      ? ((await store.getUserByToken(apiBaseUrl, token)) ??
         (await store.getUserByWebSession(apiBaseUrl, token)))
      : await store.getUserByWebSession(apiBaseUrl, token);
  if (!user) {
    reply.code(401).send(Errors.invalidSession());
    return null;
  }
  const memberships = await store.listCourseMemberships(apiBaseUrl, user.id);
  return { authKind, token, user, memberships };
}

export function hasCourseRole(
  auth: AuthenticatedRequest,
  courseId: string,
  allowedRoles: Array<CourseMembershipRecord['role']>
): boolean {
  if (auth.user.systemRole === 'admin') {
    return true;
  }
  return auth.memberships.some(
    (entry) => entry.courseId === courseId && allowedRoles.includes(entry.role)
  );
}

export function hasCourseAccess(auth: AuthenticatedRequest, courseId: string): boolean {
  return hasCourseRole(auth, courseId, ['student', 'instructor', 'ta']);
}
