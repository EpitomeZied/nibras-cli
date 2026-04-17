'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type {
  CreateProjectRoleApplicationRequest,
  CreateTrackingSubmissionRequest,
  ProjectRoleApplication,
  StudentProjectsDashboardResponse,
  Team,
  TrackingCourseSummary,
  TrackingMilestone,
  TrackingProjectSummary,
} from '@nibras/contracts';
import { prefs } from '../../../lib/prefs';
import { apiFetch } from '../../../lib/session';
import { formatHoursMinutes, minutesUntil } from '../../../lib/utils';
import {
  getLevelLabel,
  getLevelName,
  getLevelBadgeSuffix,
  LEVEL_NAMES,
  MAX_LEVEL,
} from '../../../lib/levels';
import { useSession } from '../../_components/session-context';
import SubmissionModal from './submission-modal';
import TeamApplicationModal from './team-application-modal';
import styles from './projects.module.css';

type SessionUser = {
  githubLinked?: boolean;
  githubAppInstalled?: boolean;
  githubLogin?: string | null;
};

type GitHubStatus = {
  available: boolean;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  githubLogin: string;
  installUrl: string;
  statusMessage: string;
};

/* ── helpers ──────────────────────────────────────────────────────────────── */

function statusColor(status: string): string {
  if (status === 'approved' || status === 'graded') return styles.statusApproved;
  if (status === 'submitted' || status === 'under_review') return styles.statusReview;
  if (status === 'changes_requested') return styles.statusChanges;
  return styles.statusOpen;
}

function dueDateColor(dueAt: string | null | undefined, status: string): string {
  if (status === 'approved' || status === 'graded') return styles.dueDateDone;
  const minutes = minutesUntil(dueAt);
  if (minutes === null) return '';
  if (minutes < 0) return styles.dueDateOverdue;
  if (minutes <= 48 * 60) return styles.dueDateUrgent;
  return '';
}

function dueDateText(dueAt: string | null | undefined): string {
  if (!dueAt) return 'No due date';
  const minutes = minutesUntil(dueAt);
  if (minutes === null) return 'No due date';
  if (minutes < 0) return `Overdue by ${formatHoursMinutes(minutes)}`;
  if (minutes === 0) return 'Due now';
  return `Due in ${formatHoursMinutes(minutes)}`;
}

function statusIcon(status: string): string {
  if (status === 'approved' || status === 'graded') return '✓';
  if (status === 'submitted' || status === 'under_review') return '●';
  if (status === 'changes_requested') return '↩';
  return '○';
}

/* ── skeleton ─────────────────────────────────────────────────────────────── */

function Skeleton({ w = '100%', h = 14, r = 6 }: { w?: string; h?: number; r?: number }) {
  return (
    <span
      className={styles.skeleton}
      style={{ width: w, height: h, borderRadius: r, display: 'block' }}
      aria-hidden="true"
    />
  );
}

/* ── milestone card ───────────────────────────────────────────────────────── */

function MilestoneCard({
  milestone,
  actionMode,
  onSubmit,
}: {
  milestone: TrackingMilestone;
  actionMode: 'submit' | 'apply';
  onSubmit: (m: TrackingMilestone) => void;
}) {
  const [open, setOpen] = useState(false);
  const minutes = minutesUntil(milestone.dueAt);
  const isApproved = milestone.status === 'approved' || milestone.status === 'graded';
  const isSubmitted = milestone.status === 'submitted' || milestone.status === 'under_review';
  const canSubmit = !isApproved;

  return (
    <article className={`${styles.milestone} ${isApproved ? styles.milestoneApproved : ''}`}>
      {/* Left marker */}
      <div className={`${styles.milestoneMarker} ${statusColor(milestone.status)}`}>
        <span className={styles.milestoneIcon}>{statusIcon(milestone.status)}</span>
      </div>

      {/* Content */}
      <div className={styles.milestoneContent}>
        <button
          type="button"
          className={styles.milestoneHeader}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <div className={styles.milestoneHeaderLeft}>
            <div className={styles.milestoneTitleRow}>
              <strong className={styles.milestoneTitle}>{milestone.title}</strong>
              {milestone.isFinal && <span className={styles.finalBadge}>Final</span>}
              <span className={`${styles.statusPill} ${statusColor(milestone.status)}`}>
                {milestone.statusLabel}
              </span>
            </div>
            {milestone.dueAt && (
              <span
                className={`${styles.dueDate} ${dueDateColor(milestone.dueAt, milestone.status)}`}
              >
                {dueDateText(milestone.dueAt)}
                {minutes !== null && minutes < 0 && !isApproved ? ' ⚠' : ''}
              </span>
            )}
          </div>
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▾</span>
        </button>

        {!open && milestone.description && (
          <p className={styles.milestonePeek}>
            {milestone.description.length > 90
              ? `${milestone.description.slice(0, 90)}…`
              : milestone.description}
          </p>
        )}

        {open && (
          <div className={styles.milestoneBody}>
            {milestone.description && (
              <p className={styles.milestoneDesc}>{milestone.description}</p>
            )}
            <div className={styles.milestoneActions}>
              {canSubmit && (
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={() => onSubmit(milestone)}
                >
                  {actionMode === 'apply'
                    ? 'Apply for Team'
                    : isSubmitted
                      ? '↩ Resubmit'
                      : '↑ Submit'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/* ── main component ───────────────────────────────────────────────────────── */

export default function ProjectsDashboard({
  initialCourseId = null,
}: {
  initialCourseId?: string | null;
}) {
  const { user: sessionUser } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const courseIdFromUrl = searchParams.get('courseId');
  const [dashboard, setDashboard] = useState<StudentProjectsDashboardResponse | null>(null);
  const [courses, setCourses] = useState<TrackingCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [selectionReady, setSelectionReady] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState<TrackingMilestone | null>(null);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [activeApplication, setActiveApplication] = useState<ProjectRoleApplication | null>(null);
  const [activeTeams, setActiveTeams] = useState<Team[]>([]);
  const [applicationSubmitting, setApplicationSubmitting] = useState(false);
  const [applicationError, setApplicationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [githubStatus, setGitHubStatus] = useState<GitHubStatus>({
    available: false,
    githubLinked: false,
    githubAppInstalled: false,
    githubLogin: '',
    installUrl: '',
    statusMessage: 'GitHub status is temporarily unavailable.',
  });

  function replaceCourseQuery(courseId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (courseId) {
      params.set('courseId', courseId);
    } else {
      params.delete('courseId');
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function syncCourseSelection(courseId: string | null) {
    prefs.setSelectedCourseId(courseId);
    replaceCourseQuery(courseId);
  }

  async function loadGitHubStatus(): Promise<GitHubStatus> {
    try {
      const sessionResponse = await apiFetch('/v1/web/session', { auth: true });
      if (!sessionResponse.ok) {
        const body = (await sessionResponse.json().catch(() => ({}))) as { error?: string };
        return {
          available: false,
          githubLinked: false,
          githubAppInstalled: false,
          githubLogin: '',
          installUrl: '',
          statusMessage: body.error || 'GitHub status is temporarily unavailable.',
        };
      }

      const payload = (await sessionResponse.json()) as { user?: SessionUser };
      const user = payload.user || {};
      const githubLinked = Boolean(user.githubLinked);
      const githubAppInstalled = Boolean(user.githubAppInstalled);
      const githubLogin = user.githubLogin || '';

      if (!githubLinked || githubAppInstalled) {
        return {
          available: true,
          githubLinked,
          githubAppInstalled,
          githubLogin,
          installUrl: '',
          statusMessage: '',
        };
      }

      try {
        const installResponse = await apiFetch('/v1/github/install-url', { auth: true });
        if (!installResponse.ok) {
          const body = (await installResponse.json().catch(() => ({}))) as { error?: string };
          return {
            available: true,
            githubLinked,
            githubAppInstalled,
            githubLogin,
            installUrl: '',
            statusMessage: body.error || 'GitHub App install link is temporarily unavailable.',
          };
        }
        const installPayload = (await installResponse.json()) as { installUrl?: string };
        return {
          available: true,
          githubLinked,
          githubAppInstalled,
          githubLogin,
          installUrl: installPayload.installUrl || '',
          statusMessage: '',
        };
      } catch (error) {
        return {
          available: true,
          githubLinked,
          githubAppInstalled,
          githubLogin,
          installUrl: '',
          statusMessage:
            error instanceof Error
              ? error.message
              : 'GitHub App install link is temporarily unavailable.',
        };
      }
    } catch (error) {
      return {
        available: false,
        githubLinked: false,
        githubAppInstalled: false,
        githubLogin: '',
        installUrl: '',
        statusMessage:
          error instanceof Error ? error.message : 'GitHub status is temporarily unavailable.',
      };
    }
  }

  async function loadDashboard(courseId?: string | null) {
    setLoading(true);
    setError('');
    try {
      const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
      const [response, coursesResponse, nextGitHubStatus] = await Promise.all([
        apiFetch(`/v1/tracking/dashboard/student${query}`, { auth: true }),
        apiFetch('/v1/tracking/courses', { auth: true }),
        loadGitHubStatus(),
      ]);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed to load dashboard (${response.status}).`);
      }
      if (!coursesResponse.ok) {
        const body = (await coursesResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed to load courses (${coursesResponse.status}).`);
      }
      const payload = (await response.json()) as StudentProjectsDashboardResponse;
      const nextCourses = (await coursesResponse.json()) as TrackingCourseSummary[];
      setDashboard(payload);
      setCourses(nextCourses);
      setGitHubStatus(nextGitHubStatus);
      setSelectedProjectId((current) =>
        payload.projects.some((p) => p.id === current)
          ? current
          : (payload.activeProjectId ?? payload.projects[0]?.id ?? '')
      );
      const resolvedCourseId = payload.course?.id ?? nextCourses[0]?.id ?? null;
      if (resolvedCourseId !== activeCourseId) {
        setActiveCourseId(resolvedCourseId);
      }
      if (resolvedCourseId !== courseIdFromUrl) {
        syncCourseSelection(resolvedCourseId);
      } else if (resolvedCourseId) {
        prefs.setSelectedCourseId(resolvedCourseId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const preferredCourseId = courseIdFromUrl || initialCourseId || prefs.getSelectedCourseId();
    setActiveCourseId(preferredCourseId || null);
    setSelectionReady(true);
  }, [courseIdFromUrl, initialCourseId]);

  useEffect(() => {
    if (!selectionReady) {
      return;
    }
    void loadDashboard(activeCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourseId, selectionReady]);

  const activeProject = useMemo<TrackingProjectSummary | null>(
    () =>
      dashboard?.projects.find((p) => p.id === selectedProjectId) ?? dashboard?.projects[0] ?? null,
    [dashboard, selectedProjectId]
  );

  const activeMilestones = useMemo(
    () =>
      activeProject && dashboard ? (dashboard.milestonesByProject[activeProject.id] ?? []) : [],
    [dashboard, activeProject]
  );

  const activeStats = useMemo(
    () =>
      activeProject && dashboard ? (dashboard.statsByProject[activeProject.id] ?? null) : null,
    [dashboard, activeProject]
  );

  const finalMilestone = activeMilestones.find((m) => m.isFinal) ?? null;
  const teamApplicationRequired =
    activeProject?.deliveryMode === 'team' && activeProject.teamFormationStatus !== 'teams_locked';
  const teamWorkflowState =
    activeProject?.deliveryMode !== 'team'
      ? null
      : activeProject.teamFormationStatus === 'teams_locked'
        ? 'locked'
        : activeApplication
          ? 'applied'
          : 'needs_application';

  function handleCourseChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextCourseId = event.target.value || null;
    setActiveCourseId(nextCourseId);
    syncCourseSelection(nextCourseId);
  }

  function courseLabel(course: TrackingCourseSummary): string {
    return `${course.courseCode} · ${course.title}`;
  }

  const selectedCourse =
    courses.find((course) => course.id === (activeCourseId ?? dashboard?.course?.id ?? '')) ??
    dashboard?.course ??
    null;

  function openSubmit(milestone: TrackingMilestone) {
    if (teamApplicationRequired) {
      setApplicationOpen(true);
      setApplicationError('');
      return;
    }
    setActiveMilestone(milestone);
    setSubmitError('');
  }

  async function loadTeamState(projectId: string | null) {
    if (!projectId) {
      setActiveApplication(null);
      setActiveTeams([]);
      return;
    }
    try {
      const [applicationResponse, teamsResponse] = await Promise.all([
        apiFetch(`/v1/tracking/projects/${projectId}/applications/me`, { auth: true }),
        apiFetch(`/v1/tracking/projects/${projectId}/teams`, { auth: true }),
      ]);
      setActiveApplication(
        applicationResponse.ok
          ? ((await applicationResponse.json()) as ProjectRoleApplication | null)
          : null
      );
      setActiveTeams(teamsResponse.ok ? ((await teamsResponse.json()) as Team[]) : []);
    } catch {
      setActiveApplication(null);
      setActiveTeams([]);
    }
  }

  useEffect(() => {
    void loadTeamState(activeProject?.id ?? null);
  }, [activeProject?.id]);

  async function submitMilestone(payload: CreateTrackingSubmissionRequest) {
    if (!activeMilestone) {
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await apiFetch(`/v1/tracking/milestones/${activeMilestone.id}/submissions`, {
        auth: true,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Submission failed (${response.status}).`);
      }
      setActiveMilestone(null);
      setToast('✅ Milestone submitted successfully!');
      setTimeout(() => setToast(''), 4000);
      await loadDashboard(dashboard?.course?.id ?? null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitApplication(payload: CreateProjectRoleApplicationRequest) {
    if (!activeProject) {
      return;
    }
    setApplicationSubmitting(true);
    setApplicationError('');
    try {
      const response = await apiFetch(`/v1/tracking/projects/${activeProject.id}/applications`, {
        auth: true,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Application failed (${response.status}).`);
      }
      setApplicationOpen(false);
      await loadTeamState(activeProject.id);
      setToast('✅ Team application saved.');
      setTimeout(() => setToast(''), 4000);
      await loadDashboard(dashboard?.course?.id ?? null);
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : String(error));
    } finally {
      setApplicationSubmitting(false);
    }
  }

  /* student level — single global source of truth from User.yearLevel */
  const studentLevel = sessionUser?.yearLevel ?? 1;

  /* progress values */
  const approved = activeStats?.approved ?? 0;
  const underReview = activeStats?.underReview ?? 0;
  const total = activeStats?.total ?? 0;
  const open = Math.max(0, total - approved - underReview);
  const pctApproved = total > 0 ? (approved / total) * 100 : 0;
  const pctReview = total > 0 ? (underReview / total) * 100 : 0;
  const pctOpen = total > 0 ? (open / total) * 100 : 0;

  return (
    <main className={styles.page}>
      {/* ── Toast ───────────────────────────────────────────────── */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        {/* Left: eyebrow + title + subtitle */}
        <div className={styles.pageHeaderText}>
          <p className={styles.eyebrow}>
            {dashboard?.course
              ? `${dashboard.course.courseCode} · ${dashboard.course.termLabel}`
              : 'Project Tracking'}
          </p>
          <h1 className={styles.pageTitle}>
            {loading ? <Skeleton w="260px" h={32} /> : (dashboard?.course?.title ?? 'Projects')}
          </h1>
          <p className={styles.pageSub}>
            {loading ? null : 'Track milestones, submit work, and monitor your progress.'}
          </p>
        </div>

        {/* Right: course switcher stacked above stats */}
        <div className={styles.pageHeaderRight}>
          {courses.length > 0 && (
            <label className={styles.courseSwitcher}>
              <div className={styles.courseSwitcherHeader}>
                <span className={styles.courseSelectLabel}>Course</span>
                <span className={styles.courseSwitcherHint}>
                  {courses.length > 1 ? `${courses.length} available` : 'Current workspace'}
                </span>
              </div>
              <div className={styles.courseSelectShell}>
                <div className={styles.courseSelectCurrent} aria-hidden="true">
                  <span className={styles.courseCodeBadge}>
                    {selectedCourse?.courseCode ?? 'Course'}
                  </span>
                  <span className={styles.courseSelectText}>
                    <strong className={styles.courseSelectTitle}>
                      {selectedCourse?.title ?? 'Select a course'}
                    </strong>
                    <span className={styles.courseSelectMeta}>
                      {selectedCourse?.termLabel ?? 'Choose the course you want to work in'}
                    </span>
                  </span>
                </div>
                <select
                  className={styles.courseSelectNative}
                  aria-label="Choose course"
                  title={selectedCourse ? courseLabel(selectedCourse) : 'Choose course'}
                  value={activeCourseId ?? dashboard?.course?.id ?? ''}
                  onChange={handleCourseChange}
                  disabled={loading || courses.length <= 1}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {courseLabel(course)}
                    </option>
                  ))}
                </select>
                <span className={styles.courseSelectChevron} aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 6.5 8 10l4-3.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </label>
          )}
          <div className={styles.pageHeaderStats}>
            <div className={styles.headerStat}>
              <span>{loading ? '—' : approved}</span>
              <label>Approved</label>
            </div>
            <div className={styles.headerStatDivider} />
            <div className={styles.headerStat}>
              <span>{loading ? '—' : underReview}</span>
              <label>In Review</label>
            </div>
            <div className={styles.headerStatDivider} />
            <div className={styles.headerStat}>
              <span style={{ color: 'var(--primary-strong)' }}>
                {loading ? '—' : `${activeStats?.completion ?? 0}%`}
              </span>
              <label>Complete</label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && <div className={styles.errorBar}>{error}</div>}

      {/* ── Loading skeleton ─────────────────────────────────────── */}
      {loading && (
        <div className={styles.loadingGrid}>
          <div className={styles.skeletonPanel}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonMilestone}>
                <Skeleton w="28px" h={28} r={999} />
                <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                  <Skeleton w="55%" h={14} />
                  <Skeleton w="35%" h={11} />
                </div>
              </div>
            ))}
          </div>
          <div className={styles.skeletonPanel}>
            <Skeleton w="100%" h={80} r={12} />
            <Skeleton w="100%" h={14} />
            <Skeleton w="100%" h={14} />
          </div>
        </div>
      )}

      {/* ── Page error (from server) ─────────────────────────────── */}
      {!loading && dashboard?.pageError && (
        <div className={styles.emptyState}>
          <span className={styles.emptyEmoji}>📋</span>
          <h2>Nothing published yet</h2>
          <p>{dashboard.pageError}</p>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────── */}
      {!loading && (dashboard?.projects.length ?? 0) > 0 && (
        <>
          {/* Project tabs */}
          <div className={styles.projectTabs}>
            {dashboard!.projects.map((project) => {
              const stats = dashboard!.statsByProject[project.id];
              const pct = stats?.completion ?? 0;
              const isActive = project.id === activeProject?.id;
              const projectLevel = (project as { level?: number }).level ?? 1;
              const isLocked = projectLevel > studentLevel;
              const badgeSuffix = getLevelBadgeSuffix(projectLevel);
              return (
                <button
                  key={project.id}
                  type="button"
                  className={`${styles.projectTab} ${isActive ? styles.projectTabActive : ''} ${isLocked ? styles.projectTabLocked : ''}`}
                  onClick={() => {
                    if (!isLocked) setSelectedProjectId(project.id);
                  }}
                  disabled={isLocked}
                  title={
                    isLocked
                      ? `Complete all ${getLevelLabel(projectLevel - 1)} projects to unlock`
                      : undefined
                  }
                >
                  <div className={styles.tabTop}>
                    <strong className={styles.tabTitle}>
                      {isLocked && (
                        <span aria-hidden="true" style={{ marginRight: 4 }}>
                          🔒
                        </span>
                      )}
                      {project.title}
                    </strong>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span
                        className={`${styles.levelBadge} ${styles[`levelBadge${badgeSuffix}`] ?? ''}`}
                      >
                        {getLevelName(projectLevel)}
                      </span>
                      <span className={`${styles.tabStatus} ${statusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                  </div>
                  <span className={styles.tabMeta}>
                    {(dashboard!.milestonesByProject[project.id]?.length ?? 0) + ' milestone'}
                    {(dashboard!.milestonesByProject[project.id]?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                  {isLocked && (
                    <span className={styles.lockedHint}>
                      Unlock after completing {getLevelLabel(projectLevel - 1)}
                    </span>
                  )}
                  <div className={styles.tabProgress}>
                    <div className={styles.tabProgressTrack}>
                      <div className={styles.tabProgressFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span
                      className={styles.tabPct}
                      style={pct > 0 ? { color: 'var(--success)' } : undefined}
                    >
                      {pct}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main grid */}
          <div className={styles.mainGrid}>
            {/* LEFT: milestones */}
            <div className={styles.leftCol}>
              {/* Project overview strip */}
              <div className={styles.overviewStrip}>
                <span
                  className={`${styles.overviewStatus} ${statusColor(activeProject?.status ?? 'open')}`}
                >
                  {activeProject?.status ?? 'draft'}
                </span>
                {activeProject?.description && (
                  <p className={styles.overviewDesc}>{activeProject.description}</p>
                )}
                {activeProject?.deliveryMode === 'team' && (
                  <div className={styles.overviewMeta}>
                    <span className={styles.metaChip}>
                      <span className={styles.metaChipLabel}>Formation</span>
                      {activeProject.teamFormationStatus.replace(/_/g, ' ')}
                    </span>
                    {activeProject.teamName && (
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Team</span>
                        {activeProject.teamName}
                      </span>
                    )}
                    {activeProject.assignedRoleLabel && (
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Role</span>
                        {activeProject.assignedRoleLabel}
                      </span>
                    )}
                  </div>
                )}
                <div className={styles.overviewMeta}>
                  {activeProject?.gradeWeight && (
                    <span className={styles.metaChip}>
                      <span className={styles.metaChipLabel}>Weight</span>
                      {activeProject.gradeWeight}
                    </span>
                  )}
                  {activeProject?.type && (
                    <span className={styles.metaChip}>
                      <span className={styles.metaChipLabel}>Type</span>
                      {activeProject.type}
                    </span>
                  )}
                  {activeProject?.instructorName && (
                    <span className={styles.metaChip}>
                      <span className={styles.metaChipLabel}>Instructor</span>
                      {activeProject.instructorName}
                    </span>
                  )}
                </div>
                {activeProject?.deliveryMode === 'team' && activeProject.team.length > 0 && (
                  <div className={styles.segLegend}>
                    {activeProject.team.map((member) => (
                      <span key={member.userId}>
                        <span className={styles.dot} style={{ background: member.color }} />
                        {member.name}
                        {member.roleLabel ? ` · ${member.roleLabel}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {activeProject?.deliveryMode === 'team' &&
                  activeProject.team.length === 0 &&
                  activeTeams.length > 0 && (
                    <p className={styles.overviewDesc}>
                      Teams are locked. Your visible team workspace is ready.
                    </p>
                  )}
                {activeProject?.deliveryMode === 'team' && (
                  <div className={styles.teamWorkflowCard}>
                    <div>
                      <span className={styles.teamWorkflowLabel}>Team workflow</span>
                      <strong>
                        {teamWorkflowState === 'locked'
                          ? 'Teams locked'
                          : teamWorkflowState === 'applied'
                            ? 'Application submitted'
                            : 'Application required'}
                      </strong>
                      <p>
                        {teamWorkflowState === 'locked'
                          ? 'Your team is finalized. Continue with the shared submission workflow.'
                          : teamWorkflowState === 'applied'
                            ? 'Your ranked roles are on file. You can update them until instructors lock formation.'
                            : 'Rank your preferred roles before the instructor generates and locks teams.'}
                      </p>
                    </div>
                    <span className={styles.teamWorkflowStatus}>
                      {activeProject.teamFormationStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Milestones panel */}
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>Milestones</h2>
                  <span className={styles.panelCount}>
                    {approved} / {total} complete
                  </span>
                </div>

                {activeMilestones.length === 0 ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyEmoji}>🗂️</span>
                    <p>No milestones for this project yet.</p>
                  </div>
                ) : (
                  <div className={styles.milestoneList}>
                    {activeMilestones.map((m) => (
                      <MilestoneCard
                        key={m.id}
                        milestone={m}
                        actionMode={teamApplicationRequired ? 'apply' : 'submit'}
                        onSubmit={openSubmit}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Final submission */}
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>Final Submission</h2>
                  {finalMilestone && (
                    <span className={`${styles.statusPill} ${statusColor(finalMilestone.status)}`}>
                      {finalMilestone.statusLabel}
                    </span>
                  )}
                </div>
                <div className={styles.finalBox}>
                  <p className={styles.finalDesc}>
                    {teamApplicationRequired
                      ? activeApplication
                        ? 'Your application is saved. Update your ranked preferences any time before the team roster is locked.'
                        : 'Start the team workflow by ranking preferred roles and describing how you can contribute.'
                      : (finalMilestone?.description ??
                        'Submit the final repository state and write-up for instructor review.')}
                  </p>
                  <button
                    type="button"
                    className={`${styles.submitBtnLg} ${!finalMilestone ? styles.submitBtnDisabled : ''}`}
                    disabled={!finalMilestone && !teamApplicationRequired}
                    onClick={() =>
                      teamApplicationRequired
                        ? setApplicationOpen(true)
                        : finalMilestone && openSubmit(finalMilestone)
                    }
                  >
                    {teamApplicationRequired
                      ? activeApplication
                        ? '✎ Update Team Application'
                        : '🧩 Apply for Team Roles'
                      : !finalMilestone
                        ? '🔒 No final milestone configured'
                        : finalMilestone.status === 'approved' || finalMilestone.status === 'graded'
                          ? '✓ Final Project Approved'
                          : finalMilestone.status === 'submitted' ||
                              finalMilestone.status === 'under_review'
                            ? '↩ Resubmit Final Project'
                            : '📤 Submit Final Project'}
                  </button>
                </div>
              </section>
            </div>

            {/* RIGHT: progress + breakdown + resources */}
            <div className={styles.rightCol}>
              {/* Academic Standing panel */}
              <div className={styles.standingPanel}>
                <div className={styles.standingHead}>
                  <h2 className={styles.standingTitle}>Academic Standing</h2>
                  <span
                    className={`${styles.standingBadge} ${styles[`levelBadge${getLevelBadgeSuffix(studentLevel)}`] ?? ''}`}
                  >
                    {getLevelLabel(studentLevel)}
                  </span>
                </div>

                <div className={styles.levelJourney}>
                  {[1, 2, 3, 4].map((lvl) => {
                    const isDone = lvl < studentLevel;
                    const isActive = lvl === studentLevel;
                    const stepClass = isDone
                      ? styles.journeyDone
                      : isActive
                        ? styles.journeyActive
                        : styles.journeyLocked;
                    return (
                      <div key={lvl} className={`${styles.journeyStep} ${stepClass}`}>
                        <div className={styles.journeyDot}>{isDone ? '✓' : lvl}</div>
                        <div className={styles.journeyLabel}>
                          <span className={styles.journeyLabelYear}>Yr {lvl}</span>
                          {LEVEL_NAMES[lvl]}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className={styles.standingHint}>
                  {studentLevel < MAX_LEVEL
                    ? `Complete all ${getLevelLabel(studentLevel)} projects to advance to ${getLevelLabel(studentLevel + 1)}.`
                    : 'You have reached Senior standing. Congratulations!'}
                </p>
              </div>

              {/* Progress panel */}
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>Progress</h2>
                  <span className={styles.pctBig}>{activeStats?.completion ?? 0}%</span>
                </div>

                {/* Segmented bar */}
                <div className={styles.segBar}>
                  {pctApproved > 0 && (
                    <div
                      className={`${styles.seg} ${styles.segGreen}`}
                      style={{ width: `${pctApproved}%` }}
                      title={`Approved: ${approved}`}
                    />
                  )}
                  {pctReview > 0 && (
                    <div
                      className={`${styles.seg} ${styles.segPurple}`}
                      style={{ width: `${pctReview}%` }}
                      title={`In review: ${underReview}`}
                    />
                  )}
                  {pctOpen > 0 && (
                    <div
                      className={`${styles.seg} ${styles.segGray}`}
                      style={{ width: `${pctOpen}%` }}
                      title={`Open: ${open}`}
                    />
                  )}
                  {total === 0 && <div className={styles.seg} style={{ width: '100%' }} />}
                </div>

                <div className={styles.segLegend}>
                  <span>
                    <span className={styles.dot} style={{ background: 'var(--success)' }} />
                    Approved ({approved})
                  </span>
                  <span>
                    <span className={styles.dot} style={{ background: 'var(--purple)' }} />
                    Review ({underReview})
                  </span>
                  <span>
                    <span className={styles.dot} style={{ background: 'var(--surface-muted)' }} />
                    Open ({open})
                  </span>
                </div>

                <dl className={styles.statGrid}>
                  <div>
                    <dt>Time Remaining</dt>
                    <dd>{activeStats ? formatHoursMinutes(activeStats.minutesRemaining) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Approved</dt>
                    <dd>
                      {approved} / {total}
                    </dd>
                  </div>
                  <div>
                    <dt>In Review</dt>
                    <dd>{underReview}</dd>
                  </div>
                  <div>
                    <dt>Open</dt>
                    <dd>{open}</dd>
                  </div>
                </dl>
              </section>

              {/* Grading breakdown */}
              {activeProject?.rubric && activeProject.rubric.length > 0 && (
                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <h2 className={styles.panelTitle}>Grading Breakdown</h2>
                  </div>
                  <div className={styles.rubricList}>
                    {activeProject.rubric.map((item) => {
                      const rubricTotal =
                        activeProject.rubric.reduce((s, r) => s + r.maxScore, 0) || 1;
                      const w = Math.round((item.maxScore / rubricTotal) * 100);
                      return (
                        <div key={item.criterion} className={styles.rubricRow}>
                          <div className={styles.rubricInfo}>
                            <span className={styles.rubricCriterion}>{item.criterion}</span>
                            <div className={styles.rubricTrack}>
                              <div className={styles.rubricFill} style={{ width: `${w}%` }} />
                            </div>
                          </div>
                          <strong className={styles.rubricPct}>{w}%</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Resources */}
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>Resources</h2>
                </div>
                {activeProject?.resources?.length ? (
                  <div className={styles.resourceList}>
                    {activeProject.resources.map((r) => (
                      <a
                        key={r.url}
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.resourceLink}
                      >
                        <span className={styles.resourceIcon}>🔗</span>
                        <span>{r.label}</span>
                        <span className={styles.resourceArrow}>→</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noResources}>No resources linked for this project.</p>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      {/* ── Submission modal ────────────────────────────────────── */}
      {activeMilestone && (
        <SubmissionModal
          milestone={activeMilestone}
          githubStatus={githubStatus}
          submitting={submitting}
          submitError={submitError}
          onClose={() => setActiveMilestone(null)}
          onSubmit={submitMilestone}
        />
      )}
      {applicationOpen && activeProject && (
        <TeamApplicationModal
          project={activeProject}
          application={activeApplication}
          submitting={applicationSubmitting}
          submitError={applicationError}
          onClose={() => setApplicationOpen(false)}
          onSubmit={submitApplication}
        />
      )}
    </main>
  );
}
