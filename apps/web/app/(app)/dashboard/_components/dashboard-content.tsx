'use client';

import Link from 'next/link';
import type {
  DashboardHomeResponse,
  DashboardMode,
  InstructorHomeDashboard,
  StudentHomeDashboard,
} from '@nibras/contracts';
import { formatHoursMinutes, formatShortDate, getGreeting } from '../../../lib/utils';
import styles from '../page.module.css';

type DashboardUser = {
  username?: string | null;
} | null;

type StudentBlocker = StudentHomeDashboard['blockers'][number];
type StudentAttentionItem = StudentHomeDashboard['attentionItems'][number];
type StudentSubmission = StudentHomeDashboard['recentSubmissions'][number];
type StudentCourseSnapshot = StudentHomeDashboard['courseSnapshots'][number];
type InstructorUrgentQueueItem = InstructorHomeDashboard['urgentQueue'][number];
type InstructorActivityItem = InstructorHomeDashboard['recentActivity'][number];
type InstructorCourseSummary = InstructorHomeDashboard['courseSummaries'][number];
type DashboardAction = { label: string; href: string };

function getDisplayName(username?: string | null): string {
  if (!username) return 'there';
  return username
    .split(/[._\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'No timestamp available';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatWaitingTime(value: number | null): string {
  return value == null ? 'No pending queue' : formatHoursMinutes(value);
}

function actionSummaryLabel(mode: DashboardMode): string {
  return mode === 'student' ? 'Student workspace' : 'Instructor workspace';
}

function uniqueActions(actions: Array<DashboardAction | null | undefined>): DashboardAction[] {
  const seen = new Set<string>();
  const result: DashboardAction[] = [];
  for (const action of actions) {
    if (!action || !action.href || !action.label) continue;
    const key = `${action.href}::${action.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}

function getStudentHeroActions(student: StudentHomeDashboard): DashboardAction[] {
  return uniqueActions([
    student.blockers[0]?.cta,
    student.attentionItems[0]?.cta,
    student.attentionItems[1]?.cta,
    student.courseSnapshots[0]?.projects[0]
      ? {
          label: 'Open projects',
          href: student.courseSnapshots[0].projects[0].href,
        }
      : { label: 'Open projects', href: '/projects' },
  ]).slice(0, 2);
}

function getInstructorHeroActions(instructor: InstructorHomeDashboard): DashboardAction[] {
  return uniqueActions([
    instructor.urgentQueue[0]?.cta,
    instructor.operations[0]
      ? {
          label: instructor.operations[0].label,
          href: instructor.operations[0].href,
        }
      : null,
    instructor.operations[1]
      ? {
          label: instructor.operations[1].label,
          href: instructor.operations[1].href,
        }
      : null,
  ]).slice(0, 2);
}

function studentHeroSummary(student: StudentHomeDashboard): string {
  const attentionCount = student.attentionItems.length;
  const blockerCount = student.blockers.length;
  const courseCount = student.courses.length;
  if (blockerCount > 0) {
    return `${blockerCount} blocker${blockerCount === 1 ? '' : 's'} need attention across ${courseCount} course${courseCount === 1 ? '' : 's'}.`;
  }
  if (attentionCount > 0) {
    return `${attentionCount} active item${attentionCount === 1 ? '' : 's'} are ready for your next move.`;
  }
  return `You are enrolled in ${courseCount} course${courseCount === 1 ? '' : 's'} and the workspace is clear.`;
}

function instructorHeroSummary(instructor: InstructorHomeDashboard): string {
  const pendingCourses = instructor.reviewSummary.byCourse.length;
  const awaiting = instructor.reviewSummary.totalAwaitingReview;
  if (awaiting > 0) {
    return `${awaiting} submission${awaiting === 1 ? '' : 's'} are waiting across ${pendingCourses} course${pendingCourses === 1 ? '' : 's'}.`;
  }
  return 'No urgent review queue right now. Use the operations board to keep courses moving.';
}

function blockerTone(kind: StudentBlocker['kind']): string {
  return kind === 'no_published_projects' ? styles.toneWarning : styles.toneDanger;
}

function attentionTone(kind: StudentAttentionItem['kind']): string {
  if (kind === 'failed_submission' || kind === 'changes_requested') return styles.toneDanger;
  if (kind === 'due_soon' || kind === 'needs_review') return styles.toneWarning;
  return styles.toneSuccess;
}

function statusTone(status: string): string {
  if (status === 'failed' || status === 'changes_requested') return styles.toneDanger;
  if (status === 'needs_review' || status === 'queued' || status === 'running') {
    return styles.toneWarning;
  }
  if (status === 'passed' || status === 'approved' || status === 'graded') {
    return styles.toneSuccess;
  }
  return styles.toneNeutral;
}

function metricTone(value: DashboardMode, index: number): string {
  if (value === 'student') {
    return [styles.metricDanger, styles.metricWarning, styles.metricWarning, styles.metricSuccess][
      index
    ];
  }
  return [styles.metricDanger, styles.metricWarning, styles.metricSuccess, styles.metricNeutral][
    index
  ];
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyBody}>{body}</p>
    </div>
  );
}

function Hero({
  dashboard,
  activeMode,
  user,
  onModeChange,
}: {
  dashboard: DashboardHomeResponse;
  activeMode: DashboardMode;
  user: DashboardUser;
  onModeChange: (mode: DashboardMode) => void;
}) {
  const student = dashboard.student;
  const instructor = dashboard.instructor;
  const actions =
    activeMode === 'student' && student
      ? getStudentHeroActions(student)
      : instructor
        ? getInstructorHeroActions(instructor)
        : [];
  const summary =
    activeMode === 'student' && student
      ? studentHeroSummary(student)
      : instructor
        ? instructorHeroSummary(instructor)
        : 'Dashboard data is unavailable right now.';

  return (
    <section className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroContent}>
        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <span className={styles.heroEyebrow}>{actionSummaryLabel(activeMode)}</span>
            <h1 className={styles.heroTitle}>
              {getGreeting()}, {getDisplayName(user?.username)}
            </h1>
            <p className={styles.heroSubtitle}>{summary}</p>
          </div>
          {dashboard.availableModes.length > 1 && (
            <div className={styles.modeSwitch} role="tablist" aria-label="Dashboard mode switch">
              {dashboard.availableModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onModeChange(mode)}
                  className={`${styles.modeButton} ${
                    mode === activeMode ? styles.modeButtonActive : ''
                  }`}
                  aria-pressed={mode === activeMode}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.heroActions}>
          {actions.map((action, index) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className={index === 0 ? styles.heroActionPrimary : styles.heroActionSecondary}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metrics({
  activeMode,
  dashboard,
}: {
  activeMode: DashboardMode;
  dashboard: DashboardHomeResponse;
}) {
  const items =
    activeMode === 'student' && dashboard.student
      ? [
          {
            label: 'Failed checks',
            value: String(dashboard.student.submissionHealth.failedChecks),
            meta: 'Needs a resubmission path',
          },
          {
            label: 'Needs review',
            value: String(dashboard.student.submissionHealth.needsReview),
            meta: 'Ready for staff feedback',
          },
          {
            label: 'Awaiting review',
            value: String(dashboard.student.submissionHealth.awaitingReview),
            meta: 'In progress or queued',
          },
          {
            label: 'Recently passed',
            value: String(dashboard.student.submissionHealth.recentlyPassed),
            meta: 'Successful in the last week',
          },
        ]
      : dashboard.instructor
        ? [
            {
              label: 'Awaiting review',
              value: String(dashboard.instructor.reviewSummary.totalAwaitingReview),
              meta: 'Total pending instructor queue',
            },
            {
              label: 'Oldest wait',
              value: formatWaitingTime(dashboard.instructor.reviewSummary.oldestWaitingMinutes),
              meta: 'Longest outstanding submission',
            },
            {
              label: 'Submitted 24h',
              value: String(dashboard.instructor.reviewSummary.submittedLast24Hours),
              meta: 'New review demand',
            },
            {
              label: 'Courses in queue',
              value: String(dashboard.instructor.reviewSummary.byCourse.length),
              meta: 'Courses with pending review',
            },
          ]
        : [];

  return (
    <section className={styles.metricsGrid}>
      {items.map((item, index) => (
        <article
          key={item.label}
          className={`${styles.metricCard} ${metricTone(activeMode, index)}`}
        >
          <span className={styles.metricLabel}>{item.label}</span>
          <strong className={styles.metricValue}>{item.value}</strong>
          <span className={styles.metricMeta}>{item.meta}</span>
        </article>
      ))}
    </section>
  );
}

function SectionHeader({ eyebrow, title, hint }: { eyebrow: string; title: string; hint: string }) {
  return (
    <header className={styles.panelHeader}>
      <div className={styles.panelHeaderCopy}>
        <span className={styles.panelEyebrow}>{eyebrow}</span>
        <h2 className={styles.panelTitle}>{title}</h2>
      </div>
      <p className={styles.panelHint}>{hint}</p>
    </header>
  );
}

function StudentPanels({ student }: { student: StudentHomeDashboard }) {
  return (
    <>
      <div className={styles.primaryGrid}>
        <section className={styles.panel}>
          <SectionHeader
            eyebrow="Blockers"
            title="What needs unblocking"
            hint="Surface the actions that keep project progress from stalling."
          />
          <div className={styles.cardGrid}>
            {student.blockers.length === 0 ? (
              <EmptyPanel
                title="No blockers right now"
                body="GitHub links, course memberships, and project publication are all in a healthy state."
              />
            ) : (
              student.blockers.map((blocker) => (
                <article
                  key={blocker.id}
                  className={`${styles.actionCard} ${blockerTone(blocker.kind)}`}
                >
                  <span className={styles.cardKicker}>Blocker</span>
                  <h3 className={styles.cardTitle}>{blocker.title}</h3>
                  <p className={styles.cardBody}>{blocker.body}</p>
                  <Link href={blocker.cta.href} className={styles.cardAction}>
                    {blocker.cta.label}
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <SectionHeader
            eyebrow="Attention"
            title="Next high-value moves"
            hint="The most important student actions are grouped here before you drill into projects."
          />
          <div className={styles.listStack}>
            {student.attentionItems.length === 0 ? (
              <EmptyPanel
                title="No urgent attention items"
                body="Recent submissions and milestone activity are stable across your current workload."
              />
            ) : (
              student.attentionItems.map((item) => (
                <article key={item.id} className={`${styles.listCard} ${attentionTone(item.kind)}`}>
                  <div className={styles.listCardHeader}>
                    <div>
                      <span className={styles.cardKicker}>{item.courseTitle}</span>
                      <h3 className={styles.listTitle}>{item.projectTitle}</h3>
                    </div>
                    <span className={styles.statusChip}>{item.statusText}</span>
                  </div>
                  <p className={styles.listBody}>{item.reason}</p>
                  <div className={styles.metaRow}>
                    <span>{item.milestoneTitle || 'General project update'}</span>
                    <span>{item.dueAt ? `Due ${formatShortDate(item.dueAt)}` : 'No due date'}</span>
                  </div>
                  <Link href={item.cta.href} className={styles.inlineAction}>
                    {item.cta.label}
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <SectionHeader
          eyebrow="Recent submissions"
          title="Latest delivery signal"
          hint="Submission status stays visible without leaving the dashboard."
        />
        <div className={styles.listStack}>
          {student.recentSubmissions.length === 0 ? (
            <EmptyPanel
              title="No recent submissions yet"
              body="Once you start submitting milestones, the latest statuses and links will appear here."
            />
          ) : (
            student.recentSubmissions.map((submission) => (
              <SubmissionRow key={submission.id} submission={submission} />
            ))
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <SectionHeader
          eyebrow="Courses"
          title="Course progress snapshots"
          hint="Course cards are still available, but they now support the action-first workflow instead of leading it."
        />
        <div className={styles.snapshotGrid}>
          {student.courseSnapshots.length === 0 ? (
            <EmptyPanel
              title="No active course snapshots"
              body="When projects are published in your courses, progress and milestone timing will show up here."
            />
          ) : (
            student.courseSnapshots.map((snapshot) => (
              <CourseSnapshotCard key={snapshot.courseId} snapshot={snapshot} />
            ))
          )}
        </div>
      </section>
    </>
  );
}

function SubmissionRow({ submission }: { submission: StudentSubmission }) {
  return (
    <article className={`${styles.listRow} ${statusTone(submission.status)}`}>
      <div className={styles.listRowMain}>
        <div className={styles.listRowHeader}>
          <h3 className={styles.listTitle}>{submission.projectTitle}</h3>
          <span className={styles.statusChip}>{submission.statusLabel}</span>
        </div>
        <p className={styles.listBody}>
          {submission.milestoneTitle || submission.projectKey} •{' '}
          {formatDateTime(submission.submittedAt || submission.createdAt)}
        </p>
      </div>
      <Link href={submission.href} className={styles.inlineAction}>
        Open
      </Link>
    </article>
  );
}

function CourseSnapshotCard({ snapshot }: { snapshot: StudentCourseSnapshot }) {
  return (
    <article className={styles.snapshotCard}>
      <div className={styles.snapshotHeader}>
        <div>
          <span className={styles.cardKicker}>Course snapshot</span>
          <h3 className={styles.cardTitle}>{snapshot.courseTitle}</h3>
        </div>
        <div className={styles.snapshotCompletion}>
          <strong>{snapshot.completion}%</strong>
          <span>complete</span>
        </div>
      </div>

      <div className={styles.progressTrack} aria-hidden="true">
        <span className={styles.progressFill} style={{ width: `${snapshot.completion}%` }} />
      </div>

      <div className={styles.statPairGrid}>
        <div className={styles.statPair}>
          <strong>{snapshot.approved}</strong>
          <span>approved</span>
        </div>
        <div className={styles.statPair}>
          <strong>{snapshot.underReview}</strong>
          <span>under review</span>
        </div>
        <div className={styles.statPair}>
          <strong>{snapshot.open}</strong>
          <span>open</span>
        </div>
      </div>

      <div className={styles.snapshotSection}>
        <span className={styles.sectionLabel}>Next milestones</span>
        {snapshot.nextMilestones.length === 0 ? (
          <p className={styles.inlineNote}>
            No milestone deadlines are queued for this course yet.
          </p>
        ) : (
          <div className={styles.miniList}>
            {snapshot.nextMilestones.slice(0, 3).map((milestone) => (
              <div key={milestone.milestoneId} className={styles.miniListItem}>
                <div>
                  <strong>{milestone.title}</strong>
                  <span>{milestone.projectTitle}</span>
                </div>
                <span>{milestone.dueAt ? formatShortDate(milestone.dueAt) : 'No due date'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.snapshotSection}>
        <span className={styles.sectionLabel}>Projects</span>
        <div className={styles.projectMiniGrid}>
          {snapshot.projects.slice(0, 3).map((project) => (
            <Link key={project.projectId} href={project.href} className={styles.projectMiniCard}>
              <strong>{project.title}</strong>
              <span>{project.completion}% complete</span>
              <span>{project.nextMilestoneTitle || 'No upcoming milestone selected'}</span>
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

function InstructorPanels({ instructor }: { instructor: InstructorHomeDashboard }) {
  return (
    <>
      <div className={styles.primaryGrid}>
        <section className={styles.panel}>
          <SectionHeader
            eyebrow="Urgent queue"
            title="Oldest pending reviews first"
            hint="This queue is ordered to surface the submissions that have waited the longest."
          />
          <div className={styles.listStack}>
            {instructor.urgentQueue.length === 0 ? (
              <EmptyPanel
                title="No urgent reviews"
                body="The review queue is clear. Activity and course operations remain available below."
              />
            ) : (
              instructor.urgentQueue.map((entry) => (
                <UrgentQueueRow key={entry.submissionId} entry={entry} />
              ))
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <SectionHeader
            eyebrow="Operations"
            title="Fast course moves"
            hint="Common instructor actions stay within one click of the dashboard."
          />
          <div className={styles.cardGrid}>
            {instructor.operations.map((operation) => (
              <Link key={operation.id} href={operation.href} className={styles.operationCard}>
                <span className={styles.cardKicker}>Operation</span>
                <h3 className={styles.cardTitle}>{operation.label}</h3>
                <p className={styles.cardBody}>{operation.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <SectionHeader
          eyebrow="Recent activity"
          title="What changed recently"
          hint="A compact instructor timeline keeps course movement visible without opening each workspace."
        />
        <div className={styles.listStack}>
          {instructor.recentActivity.length === 0 ? (
            <EmptyPanel
              title="No recent instructor activity"
              body="Publishing, reviews, and course events will surface here once work starts flowing."
            />
          ) : (
            instructor.recentActivity.map((entry) => <ActivityRow key={entry.id} entry={entry} />)
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <SectionHeader
          eyebrow="Courses"
          title="Course operating view"
          hint="Course summaries are now secondary so the dashboard can prioritize queue management first."
        />
        <div className={styles.courseSummaryGrid}>
          {instructor.courseSummaries.length === 0 ? (
            <EmptyPanel
              title="No instructor courses available"
              body="Once instructor or TA memberships exist, course-level review and activity summaries will render here."
            />
          ) : (
            instructor.courseSummaries.map((course) => (
              <InstructorCourseCard key={course.courseId} course={course} />
            ))
          )}
        </div>
      </section>
    </>
  );
}

function UrgentQueueRow({ entry }: { entry: InstructorUrgentQueueItem }) {
  return (
    <article className={`${styles.listRow} ${styles.toneWarning}`}>
      <div className={styles.listRowMain}>
        <div className={styles.listRowHeader}>
          <h3 className={styles.listTitle}>{entry.projectTitle}</h3>
          <span className={styles.statusChip}>
            {formatWaitingTime(entry.waitingMinutes)} waiting
          </span>
        </div>
        <p className={styles.listBody}>
          {entry.studentName} • {entry.courseTitle} • submitted {formatDateTime(entry.submittedAt)}
        </p>
      </div>
      <Link href={entry.cta.href} className={styles.inlineAction}>
        {entry.cta.label}
      </Link>
    </article>
  );
}

function ActivityRow({ entry }: { entry: InstructorActivityItem }) {
  const body = `${entry.summary} • ${formatDateTime(entry.createdAt)}`;
  if (entry.href) {
    return (
      <Link href={entry.href} className={`${styles.listRow} ${styles.toneNeutral}`}>
        <div className={styles.listRowMain}>
          <div className={styles.listRowHeader}>
            <h3 className={styles.listTitle}>{entry.courseTitle || 'Instructor activity'}</h3>
            <span className={styles.statusChip}>{entry.action}</span>
          </div>
          <p className={styles.listBody}>{body}</p>
        </div>
      </Link>
    );
  }
  return (
    <article className={`${styles.listRow} ${styles.toneNeutral}`}>
      <div className={styles.listRowMain}>
        <div className={styles.listRowHeader}>
          <h3 className={styles.listTitle}>{entry.courseTitle || 'Instructor activity'}</h3>
          <span className={styles.statusChip}>{entry.action}</span>
        </div>
        <p className={styles.listBody}>{body}</p>
      </div>
    </article>
  );
}

function InstructorCourseCard({ course }: { course: InstructorCourseSummary }) {
  return (
    <Link href={`/instructor/courses/${course.courseId}`} className={styles.courseSummaryCard}>
      <div className={styles.snapshotHeader}>
        <div>
          <span className={styles.cardKicker}>{course.courseCode}</span>
          <h3 className={styles.cardTitle}>{course.title}</h3>
        </div>
        <span className={styles.statusChip}>{course.termLabel}</span>
      </div>

      <div className={styles.statPairGrid}>
        <div className={styles.statPair}>
          <strong>{course.pendingReviewCount}</strong>
          <span>pending review</span>
        </div>
        <div className={styles.statPair}>
          <strong>{course.publishedProjectCount}</strong>
          <span>published projects</span>
        </div>
        <div className={styles.statPair}>
          <strong>{course.memberCount}</strong>
          <span>members</span>
        </div>
      </div>

      <p className={styles.inlineNote}>
        {course.lastActivityAt
          ? `Last activity ${formatDateTime(course.lastActivityAt)}`
          : 'No recent activity recorded'}
      </p>
    </Link>
  );
}

export function DashboardSkeleton() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.skeletonBlock} style={{ width: 140, height: 14 }} />
          <div className={styles.skeletonBlock} style={{ width: '52%', height: 44 }} />
          <div className={styles.skeletonBlock} style={{ width: '72%', height: 18 }} />
          <div className={styles.heroActions}>
            <div className={styles.skeletonBlock} style={{ width: 148, height: 46 }} />
            <div className={styles.skeletonBlock} style={{ width: 148, height: 46 }} />
          </div>
        </div>
      </section>

      <section className={styles.metricsGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={styles.metricCard}>
            <div className={styles.skeletonBlock} style={{ width: 90, height: 12 }} />
            <div className={styles.skeletonBlock} style={{ width: 120, height: 30 }} />
            <div className={styles.skeletonBlock} style={{ width: '85%', height: 12 }} />
          </div>
        ))}
      </section>

      <div className={styles.primaryGrid}>
        <div className={styles.panel}>
          <div className={styles.skeletonColumn}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={styles.skeletonCard} />
            ))}
          </div>
        </div>
        <div className={styles.panel}>
          <div className={styles.skeletonColumn}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={styles.skeletonCard} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className={styles.page}>
      <section className={styles.errorPanel}>
        <span className={styles.heroEyebrow}>Dashboard error</span>
        <h1 className={styles.heroTitle}>The action hub could not load.</h1>
        <p className={styles.heroSubtitle}>{message}</p>
        <button type="button" onClick={onRetry} className={styles.heroActionPrimary}>
          Retry dashboard
        </button>
      </section>
    </div>
  );
}

export default function DashboardContent({
  dashboard,
  activeMode,
  user,
  onModeChange,
}: {
  dashboard: DashboardHomeResponse;
  activeMode: DashboardMode;
  user: DashboardUser;
  onModeChange: (mode: DashboardMode) => void;
}) {
  return (
    <div className={styles.page}>
      <Hero dashboard={dashboard} activeMode={activeMode} user={user} onModeChange={onModeChange} />
      <Metrics activeMode={activeMode} dashboard={dashboard} />
      {activeMode === 'student' && dashboard.student ? (
        <StudentPanels student={dashboard.student} />
      ) : activeMode === 'instructor' && dashboard.instructor ? (
        <InstructorPanels instructor={dashboard.instructor} />
      ) : (
        <section className={styles.panel}>
          <EmptyPanel
            title="Dashboard mode unavailable"
            body="The selected role is not available for this account right now."
          />
        </section>
      )}
    </div>
  );
}
