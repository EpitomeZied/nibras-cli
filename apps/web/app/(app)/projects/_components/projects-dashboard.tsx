'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  StudentProjectsDashboardResponse,
  TrackingMilestone,
  TrackingProjectSummary,
} from '@nibras/contracts';
import { apiFetch, discoverApiBaseUrl } from '../../../lib/session';
import styles from './projects.module.css';

type SubmissionType = 'github' | 'link' | 'text';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function statusColor(status: string): string {
  if (status === 'approved' || status === 'graded') return styles.statusApproved;
  if (status === 'submitted' || status === 'under_review') return styles.statusReview;
  if (status === 'changes_requested') return styles.statusChanges;
  return styles.statusOpen;
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function dueDateColor(dueAt: string | null | undefined, status: string): string {
  if (status === 'approved' || status === 'graded') return styles.dueDateDone;
  const days = daysUntil(dueAt);
  if (days === null) return '';
  if (days < 0) return styles.dueDateOverdue;
  if (days <= 2) return styles.dueDateUrgent;
  return '';
}

function dueDateText(dueAt: string | null | undefined, label: string | undefined): string {
  if (!dueAt) return label || 'No due date';
  const days = daysUntil(dueAt);
  if (days === null) return label || '';
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return label || '';
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
  onSubmit,
}: {
  milestone: TrackingMilestone;
  onSubmit: (m: TrackingMilestone) => void;
}) {
  const [open, setOpen] = useState(false);
  const days = daysUntil(milestone.dueAt);
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
              {dueDateText(milestone.dueAt, milestone.dueDateLabel)}
              {days !== null && days < 0 && !isApproved ? ' ⚠' : ''}
            </span>
          )}
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▾</span>
        </button>

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
                  {isSubmitted ? '↩ Resubmit' : '↑ Submit'}
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
  const [dashboard, setDashboard] = useState<StudentProjectsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeMilestone, setActiveMilestone] = useState<TrackingMilestone | null>(null);
  const [submissionType, setSubmissionType] = useState<SubmissionType>('github');
  const [submissionValue, setSubmissionValue] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  async function loadDashboard(courseId?: string | null) {
    setLoading(true);
    setError('');
    try {
      const baseUrl = await discoverApiBaseUrl();
      setApiBaseUrl(baseUrl);
      const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
      const response = await apiFetch(`/v1/tracking/dashboard/student${query}`, { auth: true });
      const payload = (await response.json()) as StudentProjectsDashboardResponse;
      setDashboard(payload);
      setSelectedProjectId((current) =>
        payload.projects.some((p) => p.id === current)
          ? current
          : (payload.activeProjectId ?? payload.projects[0]?.id ?? '')
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard(initialCourseId);
  }, [initialCourseId]);

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

  function openSubmit(milestone: TrackingMilestone) {
    setActiveMilestone(milestone);
    setSubmissionType('github');
    setSubmissionValue('');
    setNotes('');
    setSubmitError('');
  }

  async function submitMilestone() {
    if (!activeMilestone || !submissionValue.trim()) {
      setSubmitError('Please fill in the submission field.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await apiFetch(`/v1/tracking/milestones/${activeMilestone.id}/submissions`, {
        auth: true,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submissionType,
          submissionValue,
          notes,
          repoUrl: submissionType === 'github' ? submissionValue : '',
          branch: 'main',
          commitSha: '',
        }),
      });
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
              return (
                <button
                  key={project.id}
                  type="button"
                  className={`${styles.projectTab} ${isActive ? styles.projectTabActive : ''}`}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <div className={styles.tabTop}>
                    <strong className={styles.tabTitle}>{project.title}</strong>
                    <span className={`${styles.tabStatus} ${statusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                  <div className={styles.tabProgress}>
                    <div className={styles.tabProgressTrack}>
                      <div className={styles.tabProgressFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.tabPct}>{pct}%</span>
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
                      <MilestoneCard key={m.id} milestone={m} onSubmit={openSubmit} />
                    ))}
                  </div>
                )}
              </section>

              {/* Final submission */}
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>Final Submission</h2>
                </div>
                <div className={styles.finalBox}>
                  <p className={styles.finalDesc}>
                    Submit the final repository state and write-up for instructor review.
                  </p>
                  <button
                    type="button"
                    className={`${styles.submitBtnLg} ${!finalMilestone ? styles.submitBtnDisabled : ''}`}
                    disabled={!finalMilestone}
                    onClick={() => finalMilestone && openSubmit(finalMilestone)}
                  >
                    {!finalMilestone
                      ? '🔒 No final milestone configured'
                      : '📤 Submit Final Project'}
                  </button>
                </div>
              </section>
            </div>

            {/* RIGHT: progress + breakdown + resources */}
            <div className={styles.rightCol}>
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
                    <span className={styles.dot} style={{ background: '#34d399' }} />
                    Approved ({approved})
                  </span>
                  <span>
                    <span className={styles.dot} style={{ background: '#a78bfa' }} />
                    Review ({underReview})
                  </span>
                  <span>
                    <span className={styles.dot} style={{ background: 'var(--surface-muted)' }} />
                    Open ({open})
                  </span>
                </div>

                <dl className={styles.statGrid}>
                  <div>
                    <dt>Days Remaining</dt>
                    <dd>{activeStats?.daysRemaining ?? '—'}</dd>
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
        <div
          className={styles.backdrop}
          onClick={(e) => e.target === e.currentTarget && setActiveMilestone(null)}
        >
          <div className={styles.modal}>
            {/* Header */}
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Submit Milestone</h2>
                <p className={styles.modalSub}>{activeMilestone.title}</p>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setActiveMilestone(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Type selector */}
            <div className={styles.typeTabs}>
              {(['github', 'link', 'text'] as SubmissionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.typeTab} ${submissionType === t ? styles.typeTabActive : ''}`}
                  onClick={() => setSubmissionType(t)}
                >
                  {t === 'github' ? '🐙 GitHub' : t === 'link' ? '🔗 Link' : '✏️ Text'}
                </button>
              ))}
            </div>

            {/* GitHub webhook hint */}
            {submissionType === 'github' && (
              <div className={styles.githubHint}>
                <strong>Webhook tip</strong>
                <p>After submitting, add a webhook in your GitHub repo pointing to:</p>
                <code className={styles.webhookUrl}>
                  {apiBaseUrl ? `${apiBaseUrl}/v1/github/webhooks` : '/v1/github/webhooks'}
                </code>
              </div>
            )}

            {/* Submission field */}
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                {submissionType === 'github'
                  ? 'Repository URL'
                  : submissionType === 'link'
                    ? 'Submission URL'
                    : 'Write-up'}
              </span>
              {submissionType === 'text' ? (
                <textarea
                  className={styles.textarea}
                  rows={5}
                  value={submissionValue}
                  onChange={(e) => setSubmissionValue(e.target.value)}
                  placeholder="Describe what you built, your approach, and key decisions…"
                />
              ) : (
                <input
                  className={styles.input}
                  type="url"
                  value={submissionValue}
                  onChange={(e) => setSubmissionValue(e.target.value)}
                  placeholder={
                    submissionType === 'github'
                      ? 'https://github.com/you/repo'
                      : 'https://example.com/submission'
                  }
                />
              )}
            </label>

            {/* Notes */}
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Notes to Reviewer <em className={styles.optional}>(optional)</em>
              </span>
              <textarea
                className={styles.textarea}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the reviewer should know?"
              />
            </label>

            {/* Submit error */}
            {submitError && <p className={styles.submitError}>{submitError}</p>}

            {/* Actions */}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setActiveMilestone(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                disabled={submitting}
                onClick={() => void submitMilestone()}
              >
                {submitting ? 'Submitting…' : '📤 Submit Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
