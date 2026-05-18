'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../../_components/widgets/EmptyState';
import {
  listAssignments,
  type BackendAssignment,
} from '../../../../lib/services/backend-courses';
import { friendlyMessage } from '../../../../lib/api-clients/errors';

function dueBadgeClass(dueAt: string | undefined, status: BackendAssignment['status']) {
  if (!dueAt) return styles.dueOk;
  if (status === 'late') return styles.dueLate;
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 0) return styles.dueLate;
  if (diff < 1000 * 60 * 60 * 48) return styles.dueSoon;
  return styles.dueOk;
}

function statusBadgeClass(status: BackendAssignment['status']) {
  switch (status) {
    case 'in_progress':
      return styles.statusInProgress;
    case 'submitted':
      return styles.statusSubmitted;
    case 'graded':
      return styles.statusGraded;
    case 'late':
      return styles.statusLate;
    default:
      return styles.statusNotStarted;
  }
}

function formatDue(iso: string | undefined): string {
  if (!iso) return 'No due date';
  try {
    return `Due ${new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  } catch {
    return iso;
  }
}

export default function CourseAssignmentsPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId ?? '';
  const [assignments, setAssignments] = useState<BackendAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      setAssignments(await listAssignments(courseId));
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = [...assignments].sort((a, b) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });

  return (
    <div className={styles.page}>
      <header className={styles.breadcrumb}>
        <Link href={`/catalog/${courseId}`}>← Back to course</Link>
      </header>
      <h1 className={styles.title}>Assignments</h1>

      {loading ? (
        <div style={{ height: 240, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error || sorted.length === 0 ? (
        <EmptyState
          title={error ? 'Could not load assignments' : 'No assignments'}
          description={error ?? 'Course assignments will appear here.'}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      ) : (
        <div className={styles.list}>
          {sorted.map((assignment) => (
            <Link
              key={assignment.id}
              href={`/catalog/${courseId}/assignments/${assignment.id}`}
              className={styles.row}
            >
              <div>
                <h2 className={styles.assignmentTitle}>{assignment.title}</h2>
                <p className={styles.assignmentMeta}>
                  {assignment.pointsPossible} pts
                  {typeof assignment.score === 'number' &&
                    ` · scored ${assignment.score}/${assignment.pointsPossible}`}
                </p>
              </div>
              <span className={`${styles.dueBadge} ${dueBadgeClass(assignment.dueAt, assignment.status)}`}>
                {formatDue(assignment.dueAt)}
              </span>
              <span className={`${styles.statusBadge} ${statusBadgeClass(assignment.status)}`}>
                {assignment.status.replace('_', ' ')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
