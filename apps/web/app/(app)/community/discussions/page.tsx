'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../_components/widgets/EmptyState';
import { listThreads, type CommunityThread } from '../../../lib/services/community';
import { useSession } from '../../_components/session-context';
import { friendlyMessage } from '../../../lib/api-clients/errors';

function formatRelative(iso?: string): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    const diffMs = date.getTime() - Date.now();
    const diffMin = Math.round(diffMs / 60000);
    const diffHr = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHr / 24);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
    if (Math.abs(diffHr) < 48) return rtf.format(diffHr, 'hour');
    return rtf.format(diffDay, 'day');
  } catch {
    return iso;
  }
}

export default function DiscussionsPage() {
  const { user } = useSession();
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const courses = useMemo(() => {
    return (user?.memberships ?? []).map((m) => ({ id: m.courseId, role: m.role }));
  }, [user]);

  const load = useCallback(async () => {
    if (!courseId) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await listThreads(courseId, { limit: 30 });
      setThreads(response.items ?? []);
    } catch (err) {
      setError(friendlyMessage(err));
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (!courseId && courses.length > 0) {
      setCourseId(courses[0].id);
      return;
    }
    void load();
  }, [load, courseId, courses]);

  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const aTime = a.lastActivityAt ?? a.createdAt;
      const bTime = b.lastActivityAt ?? b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [threads]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Course Discussions</h1>
          <p className={styles.subtitle}>
            Long-form threads scoped to your courses — announcements, study groups, project chatter.
          </p>
        </div>
        <button type="button" className={styles.startBtn} disabled>
          Start a thread
        </button>
      </header>

      {courses.length > 0 && (
        <div className={styles.filters}>
          <div className={styles.coursePicker} role="tablist" aria-label="Course filter">
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={courseId === c.id}
                className={`${styles.courseChip} ${courseId === c.id ? styles.courseChipActive : ''}`}
                onClick={() => setCourseId(c.id)}
              >
                {c.id}
              </button>
            ))}
          </div>
        </div>
      )}

      {!courseId ? (
        <EmptyState
          title={courses.length === 0 ? 'No courses to discuss' : 'Pick a course to see threads'}
          description={
            courses.length === 0
              ? 'Discussion threads are scoped per course. Enrol in a course to see its threads.'
              : 'Discussion threads are scoped per course. Choose one above to load its threads.'
          }
        />
      ) : loading ? (
        <div style={{ height: 280, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error ? (
        <EmptyState
          title="Discussions unavailable"
          description={error}
          tone="error"
          action={{ label: 'Retry', onClick: () => void load() }}
        />
      ) : sortedThreads.length === 0 ? (
        <EmptyState
          title="No threads yet"
          description="Be the first to start a discussion in this course."
        />
      ) : (
        <div className={styles.threadList}>
          {sortedThreads.map((thread) => (
            <Link
              key={thread.id}
              href={`/community/discussions/${thread.id}`}
              className={`${styles.thread} ${thread.pinned ? styles.threadPinned : ''} ${
                thread.closed ? styles.threadClosed : ''
              }`}
            >
              <div className={styles.body}>
                <div className={styles.threadTitleRow}>
                  <h2 className={styles.threadTitle}>{thread.title}</h2>
                  {thread.pinned && <span className={styles.pinnedTag}>Pinned</span>}
                  {thread.closed && <span className={styles.closedTag}>Closed</span>}
                </div>
                {thread.body && <p className={styles.snippet}>{thread.body}</p>}
                <div className={styles.threadMeta}>
                  <span>{thread.author.username}</span>
                  <span>·</span>
                  <span>{formatRelative(thread.lastActivityAt ?? thread.createdAt)}</span>
                  {thread.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.threadStats}>
                <strong>{thread.replyCount}</strong>
                <span>replies</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
