'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/session';
import { useFetch } from '../../lib/use-fetch';
import { useSession } from '../_components/session-context';
import styles from './instructor.module.css';

type Course = {
  id: string;
  slug: string;
  title: string;
  termLabel: string;
  courseCode: string;
  isActive: boolean;
};

/** Group courses by termLabel, sorted by label so "Year 1" < "Year 2" etc. */
function groupByTerm(courses: Course[]): { term: string; courses: Course[] }[] {
  const map = new Map<string, Course[]>();
  for (const c of courses) {
    const key = c.termLabel || 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([term, courses]) => ({ term, courses }));
}

function QuickStartStep({
  number,
  title,
  desc,
  href,
  linkLabel,
}: {
  number: string;
  title: string;
  desc: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className={styles.quickStep}>
      <div className={styles.quickStepNumber}>{number}</div>
      <div className={styles.quickStepContent}>
        <strong>{title}</strong>
        <p>{desc}</p>
        <Link href={href} className={styles.quickStepLink}>
          {linkLabel} →
        </Link>
      </div>
    </div>
  );
}

export default function InstructorPage() {
  const { user, loading: sessionLoading } = useSession();
  const isAdmin = user?.systemRole === 'admin';
  const router = useRouter();

  // Redirect non-admins away once session is resolved
  useEffect(() => {
    if (!sessionLoading && user && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [sessionLoading, user, isAdmin, router]);

  const { data: fetchedCourses, loading, error } = useFetch<Course[]>('/v1/tracking/courses');
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Block render until session resolves; redirect effect handles non-admins
  if (sessionLoading || !isAdmin) return null;

  // Use local state if we've done any mutations, otherwise use fetched data
  const allCourses = courses ?? fetchedCourses ?? [];
  const groups = groupByTerm(allCourses);
  const useGroups = groups.length > 1;

  async function handleDelete(courseId: string) {
    setDeletingId(courseId);
    setConfirmId(null);
    try {
      const res = await apiFetch(`/v1/admin/courses/${courseId}`, {
        method: 'DELETE',
        auth: true,
      });
      if (res.ok) {
        setCourses((prev) => (prev ?? fetchedCourses ?? []).filter((c) => c.id !== courseId));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.page}>
      {/* Confirm delete overlay */}
      {confirmId && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <h3>Delete course?</h3>
            <p>
              This will permanently delete{' '}
              <strong>{allCourses.find((c) => c.id === confirmId)?.title}</strong> and all its
              projects, milestones, and submissions. This cannot be undone.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.btnSecondary} onClick={() => setConfirmId(null)}>
                Cancel
              </button>
              <button
                className={styles.btnDanger}
                onClick={() => void handleDelete(confirmId)}
                disabled={deletingId === confirmId}
              >
                {deletingId === confirmId ? 'Deleting…' : 'Delete course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1>Instructor</h1>
          <p className={styles.subtitle}>
            Manage courses, reusable templates, team formation, programs, and review workflows.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/instructor/onboarding" className={styles.btnSecondary}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <rect
                x="1"
                y="3"
                width="13"
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M4 7h7M4 10h5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <path d="M1 6h13" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            CLI Setup Guide
          </Link>
          <Link href="/instructor/courses/new" className={styles.btnPrimary}>
            + New Course
          </Link>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Courses</span>
          <strong>{allCourses.length}</strong>
          <p>Course workspaces currently managed in the system.</p>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Templates</span>
          <strong>{allCourses.length > 0 ? 'Ready' : 'Pending'}</strong>
          <p>Reusable project blueprints are available from each course workspace.</p>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Programs</span>
          <strong>Builder</strong>
          <p>Academic planning, requirements, tracks, and petitions are managed here too.</p>
        </article>
      </div>

      <div className={styles.featureWorkbench}>
        <div className={styles.workbenchCard}>
          <span className={styles.summaryLabel}>Templates</span>
          <h2>Create repeatable project blueprints.</h2>
          <p className={styles.muted}>
            Use templates to define milestones, team size, and role slots once, then launch new
            projects from the same structure.
          </p>
          <div className={styles.workbenchActions}>
            {allCourses[0] ? (
              <Link
                href={`/instructor/courses/${allCourses[0].id}/templates`}
                className={styles.btnPrimary}
              >
                Open Templates
              </Link>
            ) : (
              <Link href="/instructor/courses/new" className={styles.btnPrimary}>
                Create Course First
              </Link>
            )}
          </div>
        </div>

        <div className={styles.workbenchCard}>
          <span className={styles.summaryLabel}>Team Formation</span>
          <h2>Collect applications and lock team rosters.</h2>
          <p className={styles.muted}>
            Team project coordination now runs inside the same instructor workspace, from role
            preference intake to suggested and locked teams.
          </p>
          <div className={styles.workbenchActions}>
            <Link href="/projects" className={styles.btnSecondary}>
              View Student Side
            </Link>
          </div>
        </div>

        <div className={styles.workbenchCard}>
          <span className={styles.summaryLabel}>Programs</span>
          <h2>Build the academic planning layer.</h2>
          <p className={styles.muted}>
            Manage program versions, requirement groups, tracks, and petition review in the same
            system used for course delivery.
          </p>
          <div className={styles.workbenchActions}>
            <Link href="/instructor/programs" className={styles.btnPrimary}>
              Open Programs
            </Link>
          </div>
        </div>
      </div>

      {loading && (
        <div className={styles.courseGrid}>
          {[1, 2, 3].map((n) => (
            <div key={n} className={styles.courseCardSkeleton}>
              <div
                className="skeletonLine"
                style={{ width: '40%', height: 12, marginBottom: 10 }}
              />
              <div className="skeletonLine" style={{ width: '75%', height: 16, marginBottom: 8 }} />
              <div className="skeletonLine" style={{ width: '55%', height: 12 }} />
            </div>
          ))}
        </div>
      )}

      {error && <p className={styles.errorText}>{error}</p>}

      {/* Empty state: rich quick-start */}
      {!loading && !error && allCourses.length === 0 && (
        <div className={styles.emptyStateRich}>
          <div className={styles.emptyStateHeader}>
            <div className={styles.emptyStateIcon}>🎓</div>
            <h2>Create your first course</h2>
            <p>
              Follow these three steps to get your course up and running — web setup, CLI install,
              and your first student submission.
            </p>
          </div>

          <div className={styles.quickSteps}>
            <QuickStartStep
              number="01"
              title="Create a course"
              desc="Define your course code, title, term, and add your first project milestone."
              href="/instructor/courses/new"
              linkLabel="Create course"
            />
            <QuickStartStep
              number="02"
              title="Set up the CLI"
              desc="Install the Nibras CLI, authenticate with GitHub, and bootstrap a project locally."
              href="/instructor/onboarding"
              linkLabel="View CLI guide"
            />
            <QuickStartStep
              number="03"
              title="Invite students"
              desc="Share your course join link. Students install the CLI and start submitting immediately."
              href="/instructor/courses/new"
              linkLabel="Create course first"
            />
          </div>

          <Link
            href="/instructor/courses/new"
            className={styles.btnPrimary}
            style={{ alignSelf: 'center', marginTop: 8 }}
          >
            Get started — create a course
          </Link>
        </div>
      )}

      {/* Grouped course grid */}
      {allCourses.length > 0 && (
        <div className={styles.courseGroups}>
          {useGroups ? (
            groups.map(({ term, courses: groupCourses }) => (
              <section key={term} className={styles.courseGroup}>
                <div className={styles.courseGroupHeader}>
                  <span className={styles.courseGroupLabel}>{term}</span>
                  <span className={styles.courseGroupCount}>
                    {groupCourses.length} course{groupCourses.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className={styles.courseGrid}>
                  {groupCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      isAdmin={isAdmin}
                      onDelete={() => setConfirmId(course.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className={styles.courseGrid}>
              {allCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  isAdmin={isAdmin}
                  onDelete={() => setConfirmId(course.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CourseCard({
  course,
  isAdmin,
  onDelete,
}: {
  course: Course;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  return (
    <div className={styles.courseCardWrap}>
      <Link href={`/instructor/courses/${course.id}`} className={styles.courseCard}>
        <div className={styles.courseCardTop}>
          <span className={styles.courseCode}>{course.courseCode}</span>
          <span
            className={`${styles.courseBadge} ${course.isActive ? styles.courseBadgeActive : styles.courseBadgeArchived}`}
          >
            {course.isActive ? 'Active' : 'Archived'}
          </span>
        </div>
        <strong className={styles.courseTitle}>{course.title}</strong>
        <span className={styles.muted}>{course.termLabel}</span>
      </Link>
      {isAdmin && (
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          title="Delete course"
          aria-label={`Delete ${course.title}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
