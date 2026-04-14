'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/session';
import { useSession } from '../_components/session-context';
import styles from './page.module.css';

type Course = {
  id: string;
  name: string;
  code?: string;
  projectCount?: number;
  studentCount?: number;
  submissionCount?: number;
  approvedCount?: number;
};

function FileIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className={styles.skeleton} style={{ width: 30, height: 30, borderRadius: 7 }} />
        <span className={styles.skeleton} style={{ width: '55%', height: 14 }} />
      </div>
      <span className={styles.skeleton} style={{ width: '40%', height: 12 }} />
      <span className={styles.skeleton} style={{ width: '30%', height: 10 }} />
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: sessionLoading } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch('/v1/tracking/courses', { auth: true });
        if (!res.ok) {
          setError('Failed to load courses.');
          return;
        }
        const data = (await res.json()) as Course[];
        setCourses(data);
      } catch {
        setError('Could not connect to the API.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const identity = user?.username || user?.githubLogin || 'Your';
  const workspaceInitial = identity.slice(0, 1).toUpperCase();

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Your Courses</h1>
          <p className={styles.pageSubtitle}>
            {loading ? '—' : `${courses.length} course${courses.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link href="/instructor/courses/new" className={styles.newCourseBtn}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Course
        </Link>
      </div>

      {/* ── Workspace row ── */}
      <div className={styles.workspaceRow}>
        <span className={styles.workspaceAvatar}>{sessionLoading ? '…' : workspaceInitial}</span>
        <span className={styles.workspaceName}>
          {sessionLoading ? 'Loading…' : `${identity}'s Workspace`}
        </span>
        <span className={styles.workspaceBadge}>Your Workspace</span>
        <span className={styles.workspaceCount}>
          {loading ? '' : `${courses.length} course${courses.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* ── Error ── */}
      {error && <p className={styles.errorBar}>{error}</p>}

      {/* ── Course grid ── */}
      <div className={styles.courseGrid}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : courses.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📚</span>
            <p className={styles.emptyTitle}>No courses yet</p>
            <p className={styles.emptyDesc}>
              Create your first course and invite students to get started.
            </p>
            <Link href="/instructor/courses/new" className={styles.emptyLink}>
              Create your first course →
            </Link>
          </div>
        ) : (
          courses.map((course) => {
            const approved = course.approvedCount ?? 0;
            const total = course.submissionCount ?? 0;
            const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
            const projects = course.projectCount ?? 0;
            const students = course.studentCount ?? 0;

            return (
              <Link
                key={course.id}
                href={`/instructor/courses/${course.id}`}
                className={styles.courseCard}
              >
                {/* Top: icon + title + actions */}
                <div className={styles.courseCardTop}>
                  <div className={styles.courseCardLeft}>
                    <span className={styles.courseIcon}>
                      <FileIcon />
                    </span>
                    <span className={styles.courseTitle}>{course.name}</span>
                  </div>
                  <div className={styles.courseCardActions}>
                    <span className={styles.courseArrow}>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                    <span className={styles.courseMenu}>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className={styles.courseDivider} />

                {/* Bottom: meta + progress */}
                <div className={styles.courseCardBottom}>
                  <span className={styles.courseMeta}>
                    {projects} project{projects !== 1 ? 's' : ''} • {students} student
                    {students !== 1 ? 's' : ''}
                  </span>
                  <div className={styles.courseProgressBar}>
                    <div className={styles.courseProgressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.courseProgressText}>
                    {approved}/{total} approved
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
