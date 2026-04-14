'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/session';
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

function BookIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
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
  );
}

function MenuIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={styles.skeleton} style={{ width: 32, height: 32, borderRadius: 8 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <span className={styles.skeleton} style={{ width: 24, height: 24, borderRadius: 6 }} />
          <span className={styles.skeleton} style={{ width: 24, height: 24, borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
        <span className={styles.skeleton} style={{ width: '70%', height: 16 }} />
        <span className={styles.skeleton} style={{ width: '40%', height: 12 }} />
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '14px 0 12px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className={styles.skeleton} style={{ width: '55%', height: 12 }} />
        <span className={styles.skeleton} style={{ width: '100%', height: 4, borderRadius: 999 }} />
        <span className={styles.skeleton} style={{ width: '30%', height: 11 }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
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

  const totalStudents = courses.reduce((s, c) => s + (c.studentCount ?? 0), 0);
  const totalSubmissions = courses.reduce((s, c) => s + (c.submissionCount ?? 0), 0);
  const totalApproved = courses.reduce((s, c) => s + (c.approvedCount ?? 0), 0);

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Your Courses</h1>
          <p className={styles.pageSubtitle}>
            {loading ? 'Loading…' : `${courses.length} course${courses.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link href="/instructor/courses/new" className={styles.newCourseBtn}>
          <svg
            width="13"
            height="13"
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

      {/* ── Error ── */}
      {error && <p className={styles.errorBar}>{error}</p>}

      {/* ── Stats row ── */}
      {!loading && courses.length > 0 && (
        <div className={styles.statsRow}>
          <div className={styles.statChip}>
            <span className={styles.statValue}>{courses.length}</span>
            <span className={styles.statLabel}>Courses</span>
          </div>
          <div className={styles.statChip}>
            <span className={styles.statValue}>{totalStudents}</span>
            <span className={styles.statLabel}>Students</span>
          </div>
          <div className={styles.statChip}>
            <span className={styles.statValue}>{totalSubmissions}</span>
            <span className={styles.statLabel}>Submissions</span>
          </div>
          <div className={styles.statChip}>
            <span className={styles.statValue}>{totalApproved}</span>
            <span className={styles.statLabel}>Approved</span>
          </div>
        </div>
      )}

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
            <span className={styles.emptyIconWrap}>
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="12" y1="7" x2="12" y2="13" />
                <line x1="9" y1="10" x2="15" y2="10" />
              </svg>
            </span>
            <p className={styles.emptyTitle}>No courses yet</p>
            <p className={styles.emptyDesc}>
              Create your first course and invite students to start tracking progress.
            </p>
            <Link href="/instructor/courses/new" className={styles.emptyCta}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create your first course
            </Link>
          </div>
        ) : (
          courses.map((course) => {
            const approved = course.approvedCount ?? 0;
            const total = course.submissionCount ?? 0;
            const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
            const projects = course.projectCount ?? 0;
            const students = course.studentCount ?? 0;
            const needsSetup = students === 0 && projects === 0;
            const courseName = course.name || 'Untitled Course';

            return (
              <Link
                key={course.id}
                href={`/instructor/courses/${course.id}`}
                className={styles.courseCard}
              >
                {/* Top row: icon + action buttons */}
                <div className={styles.courseCardTop}>
                  <span className={styles.courseIcon}>
                    <BookIcon />
                  </span>
                  <div className={styles.courseCardActions}>
                    <span className={styles.courseArrow}>
                      <ArrowIcon />
                    </span>
                    <span className={styles.courseMenu}>
                      <MenuIcon />
                    </span>
                  </div>
                </div>

                {/* Title block */}
                <div className={styles.courseTitleBlock}>
                  <span className={styles.courseTitle}>{courseName}</span>
                  {course.code ? (
                    <span className={styles.courseCode}>{course.code}</span>
                  ) : needsSetup ? (
                    <span className={styles.courseSetupHint}>Setup needed</span>
                  ) : null}
                </div>

                {/* Divider */}
                <div className={styles.courseDivider} />

                {/* Bottom: meta + progress */}
                <div className={styles.courseCardBottom}>
                  {needsSetup ? (
                    <span className={styles.courseMetaSetup}>
                      No students or projects yet &mdash; get started →
                    </span>
                  ) : (
                    <span className={styles.courseMeta}>
                      {projects} project{projects !== 1 ? 's' : ''} &bull; {students} student
                      {students !== 1 ? 's' : ''}
                    </span>
                  )}
                  <div className={styles.courseProgressBar}>
                    <div className={styles.courseProgressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.courseProgressText}>
                    {total === 0 ? 'No submissions yet' : `${approved}/${total} approved`}
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
