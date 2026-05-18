'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../../../_components/widgets/EmptyState';
import {
  getAssignmentById,
  type AssignmentDetail,
} from '../../../../../lib/services/backend-courses';
import { friendlyMessage } from '../../../../../lib/api-clients/errors';
import { renderMarkdown } from '../../../../../lib/markdown';

function statusBadgeClass(status: AssignmentDetail['status']) {
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

function formatDue(iso?: string): string {
  if (!iso) return 'No due date';
  try {
    return `Due ${new Date(iso).toLocaleString()}`;
  } catch {
    return iso;
  }
}

export default function AssignmentDetailPage() {
  const params = useParams<{ courseId: string; assignmentId: string }>();
  const courseId = params?.courseId ?? '';
  const assignmentId = params?.assignmentId ?? '';
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAssignmentById(assignmentId);
      setAssignment(data);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ height: 320, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className={styles.page}>
        <header className={styles.breadcrumb}>
          <Link href={`/catalog/${courseId}/assignments`}>← Back to assignments</Link>
        </header>
        <EmptyState
          title="Could not load assignment"
          description={error ?? "The assignment couldn't be loaded."}
          tone={error ? 'error' : 'default'}
          action={{ label: 'Retry', onClick: () => void load() }}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.breadcrumb}>
        <Link href={`/catalog/${courseId}/assignments`}>← Back to assignments</Link>
      </header>

      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{assignment.title}</h1>
          <span className={`${styles.statusBadge} ${statusBadgeClass(assignment.status)}`}>
            {assignment.status.replace('_', ' ')}
          </span>
        </div>
        <span className={styles.subtitle}>
          {formatDue(assignment.dueAt)} · {assignment.pointsPossible} pts
          {typeof assignment.score === 'number' &&
            ` · scored ${assignment.score}/${assignment.pointsPossible}`}
        </span>
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Brief</h2>
            {assignment.content || assignment.description ? (
              <div
                className={styles.description}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(assignment.content ?? assignment.description ?? ''),
                }}
              />
            ) : (
              <p className={styles.description}>No brief provided.</p>
            )}
          </section>

          {assignment.rubric && assignment.rubric.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Rubric</h2>
              <ul className={styles.rubricList}>
                {assignment.rubric.map((r, idx) => (
                  <li key={idx} className={styles.rubricRow}>
                    <span className={styles.rubricCriterion}>{r.criterion}</span>
                    <span className={styles.rubricWeight}>{r.weight}%</span>
                    {r.description && (
                      <p className={styles.rubricDescription}>{r.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className={styles.aside}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Details</h2>
            <div className={styles.metaRow}>
              <span>Points</span>
              <span>{assignment.pointsPossible}</span>
            </div>
            <div className={styles.metaRow}>
              <span>Status</span>
              <span>{assignment.status.replace('_', ' ')}</span>
            </div>
            {assignment.dueAt && (
              <div className={styles.metaRow}>
                <span>Due</span>
                <span>{formatDue(assignment.dueAt).replace('Due ', '')}</span>
              </div>
            )}
          </section>

          {assignment.resources && assignment.resources.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Resources</h2>
              <ul className={styles.resourceList}>
                {assignment.resources.map((r) => (
                  <li key={r.url}>
                    <a className={styles.resourceLink} href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
