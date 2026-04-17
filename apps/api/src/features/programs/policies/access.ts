import { AuthenticatedRequest } from '../../../lib/auth';

export function canManagePrograms(auth: AuthenticatedRequest): boolean {
  if (auth.user.systemRole === 'admin') return true;
  return auth.memberships.some((entry) => entry.role === 'instructor' || entry.role === 'ta');
}

export function canApproveProgramStage(
  auth: AuthenticatedRequest,
  stage: 'advisor' | 'department'
): boolean {
  if (stage === 'department') {
    return auth.user.systemRole === 'admin';
  }
  return canManagePrograms(auth);
}
