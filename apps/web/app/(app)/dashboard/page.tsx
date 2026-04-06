'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { TrackingMilestone } from '@nibras/contracts';
import { apiFetch } from '../../lib/session';
import { loadDashboardData } from './load-dashboard-data.js';
import type { LoadDashboardDataResult } from './load-dashboard-data.js';
import styles from './page.module.css';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return 'No due date';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function sortByDueDate(a: TrackingMilestone, b: TrackingMilestone): number {
  if (!a.dueAt && !b.dueAt) return 0;
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return a.dueAt.localeCompare(b.dueAt);
}

function actionEmoji(action: string): string {
  if (action.includes('approve')) return '✅';
  if (action.includes('review')) return '👀';
  if (action.includes('submit')) return '📤';
  if (action.includes('comment')) return '💬';
  if (action.includes('create')) return '🆕';
  if (action.includes('fail') || action.includes('reject')) return '❌';
  if (action.includes('push') || action.includes('commit')) return '📦';
  return '⚡';
}

/* ── sub-components ───────────────────────────────────────────────────────── */

function SkeletonLine({ w = '100%', h = 14 }: { w?: string; h?: number }) {
  return (
    <div
      className={styles.skeleton}
      style={{ width: w, height: h, borderRadius: 6 }}
      aria-hidden="true"
    />
  );
}

function MilestoneBar({
  approved,
  underReview,
  total,
}: {
  approved: number;
  underReview: number;
  total: number;
}) {
  if (total === 0) {
    return (
      <div className={styles.milestoneBar}>
        <div className={styles.milestoneSegEmpty} style={{ width: '100%' }} />
      </div>
    );
  }
  const pctApproved = (approved / total) * 100;
  const pctReview = (underReview / total) * 100;
  const pctOpen = Math.max(0, 100 - pctApproved - pctReview);
  return (
    <div className={styles.milestoneBar}>
      {pctApproved > 0 && (
        <div
          className={`${styles.milestoneSegment} ${styles.segGreen}`}
          style={{ width: `${pctApproved}%` }}
          title={`Approved: ${approved}`}
        />
      )}
      {pctReview > 0 && (
        <div
          className={`${styles.milestoneSegment} ${styles.segPurple}`}
          style={{ width: `${pctReview}%` }}
          title={`Under review: ${underReview}`}
        />
      )}
      {pctOpen > 0 && (
        <div
          className={`${styles.milestoneSegment} ${styles.segGray}`}
          style={{ width: `${pctOpen}%` }}
          title={`Open: ${total - approved - underReview}`}
        />
      )}
    </div>
  );
}

/* ── main page ────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const [data, setData] = useState<LoadDashboardDataResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const payload = await loadDashboardData({
          fetchJson: async (path: string, init?: RequestInit & { auth?: boolean }) => {
            const res = await apiFetch(path, init);
            return res.json() as Promise<unknown>;
          },
        });
        if (alive) setData(payload);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const me = data?.me ?? null;
  const dashboard = data?.dashboard ?? null;
  const installUrl = data?.installUrl ?? '';
  const githubAppInstalled = (me as { user?: { githubAppInstalled?: boolean } } | null)?.user
    ?.githubAppInstalled;
  const showInstallBanner = !loading && (installUrl || githubAppInstalled === false);

  const displayName = me?.user?.username || me?.user?.githubLogin || 'Developer';
  const firstName = displayName.split(/[\s_-]+/)[0]?.replace(/[^a-zA-Z]/g, '') || 'Developer';

  /* derived stats */
  const totals = useMemo(() => {
    if (!dashboard) return { approved: 0, underReview: 0, open: 0, total: 0 };
    return Object.values(dashboard.statsByProject).reduce(
      (acc, s) => ({
        approved: acc.approved + s.approved,
        underReview: acc.underReview + s.underReview,
        open: acc.open + Math.max(0, s.total - s.approved - s.underReview),
        total: acc.total + s.total,
      }),
      { approved: 0, underReview: 0, open: 0, total: 0 }
    );
  }, [dashboard]);

  const completionPct = totals.total > 0 ? Math.round((totals.approved / totals.total) * 100) : 0;

  const allMilestones = useMemo(
    () => (dashboard ? Object.values(dashboard.milestonesByProject).flat() : []),
    [dashboard]
  );

  const datedMilestones = useMemo(
    () => [...allMilestones].filter((m) => m.dueAt).sort(sortByDueDate),
    [allMilestones]
  );

  const overdueMilestones = useMemo(
    () => datedMilestones.filter((m) => daysUntil(m.dueAt!) < 0 && m.statusLabel !== 'approved'),
    [datedMilestones]
  );

  const upcomingMilestones = useMemo(
    () =>
      datedMilestones
        .filter((m) => daysUntil(m.dueAt!) >= 0 && m.statusLabel !== 'approved')
        .slice(0, 5),
    [datedMilestones]
  );

  const activeProjects = useMemo(
    () =>
      (dashboard?.projects ?? []).slice(0, 5).map((p) => ({
        project: p,
        stats: dashboard!.statsByProject[p.id],
      })),
    [dashboard]
  );

  /* welcome sub-text */
  const welcomeSub = useMemo(() => {
    if (loading) return null;
    if (overdueMilestones.length > 0)
      return `⚠️ You have ${overdueMilestones.length} overdue milestone${overdueMilestones.length > 1 ? 's' : ''} — check deadlines below.`;
    if (upcomingMilestones.length > 0) {
      const next = upcomingMilestones[0];
      const days = daysUntil(next.dueAt!);
      return `📅 Next deadline: ${next.title} — ${days === 0 ? 'today!' : days === 1 ? 'tomorrow' : `in ${days} days`}`;
    }
    if (totals.total > 0) return `🎉 All caught up! ${completionPct}% of milestones approved.`;
    return '🚀 Start by exploring your projects below.';
  }, [loading, overdueMilestones, upcomingMilestones, totals, completionPct]);

  return (
    <main className={styles.page}>
      {/* ── GitHub App install banner ─────────────────────────────── */}
      {showInstallBanner && (
        <div className={styles.installBanner}>
          <span className={styles.installIcon}>🔗</span>
          <div className={styles.installText}>
            <strong>Connect GitHub App</strong>
            <span>Install the Nibras GitHub App to enable automatic submission tracking.</span>
          </div>
          {installUrl ? (
            <a href={installUrl} className={styles.installBtn}>
              Install now →
            </a>
          ) : (
            <Link href="/settings" className={styles.installBtn}>
              Go to Settings →
            </Link>
          )}
        </div>
      )}

      {error && <div className={styles.errorBar}>{error}</div>}

      {/* ── Welcome banner ────────────────────────────────────────── */}
      <section className={styles.welcomeBanner}>
        <div className={styles.welcomeText}>
          <p className={styles.welcomeGreeting}>{getGreeting()},</p>
          <h1 className={styles.welcomeName}>{firstName.toUpperCase()}</h1>
          {loading ? (
            <SkeletonLine w="260px" h={13} />
          ) : (
            <p className={styles.welcomeSub}>{welcomeSub}</p>
          )}
        </div>
        <div className={styles.bannerMeta}>
          {dashboard?.course && (
            <span className={styles.courseChip}>
              🎓 {dashboard.course.courseCode} — {dashboard.course.title}
            </span>
          )}
          <div className={styles.bannerActions}>
            <Link href="/projects" className={styles.quickActionBtn}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <rect
                  x="0.5"
                  y="0.5"
                  width="5"
                  height="5"
                  rx="1.2"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <rect
                  x="7.5"
                  y="0.5"
                  width="5"
                  height="5"
                  rx="1.2"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <rect
                  x="0.5"
                  y="7.5"
                  width="5"
                  height="5"
                  rx="1.2"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <rect
                  x="7.5"
                  y="7.5"
                  width="5"
                  height="5"
                  rx="1.2"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
              Projects
            </Link>
            <Link href="/instructor/onboarding" className={styles.quickActionBtn}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M6.5 5.5v4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx="6.5" cy="3.5" r="0.7" fill="currentColor" />
              </svg>
              CLI Guide
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <section className={styles.statsRow}>
        {/* Approved */}
        <article className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M3 9l4 4 8-8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className={styles.statBody}>
            <span className={styles.statLabel}>Approved</span>
            <strong className={styles.statValue}>
              {loading ? <SkeletonLine w="40px" h={30} /> : totals.approved}
            </strong>
            <span className={`${styles.statBadge} ${styles.badgeGreen}`}>
              {completionPct}% done
            </span>
          </div>
        </article>

        {/* Under Review */}
        <article className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M9 5v4l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className={styles.statBody}>
            <span className={styles.statLabel}>Under Review</span>
            <strong className={styles.statValue}>
              {loading ? <SkeletonLine w="40px" h={30} /> : totals.underReview}
            </strong>
            <span className={`${styles.statBadge} ${styles.badgePurple}`}>In queue</span>
          </div>
        </article>

        {/* Total milestones */}
        <article className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect
                x="2"
                y="2"
                width="6"
                height="6"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect
                x="10"
                y="2"
                width="6"
                height="6"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect
                x="2"
                y="10"
                width="6"
                height="6"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect
                x="10"
                y="10"
                width="6"
                height="6"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <div className={styles.statBody}>
            <span className={styles.statLabel}>Total Milestones</span>
            <strong className={styles.statValue}>
              {loading ? <SkeletonLine w="40px" h={30} /> : totals.total}
            </strong>
            <span className={`${styles.statBadge} ${styles.badgeBlue}`}>
              {loading ? '—' : `${totals.open} open`}
            </span>
          </div>
        </article>
      </section>

      {/* ── Main grid ────────────────────────────────────────────── */}
      <div className={styles.mainGrid}>
        {/* LEFT column */}
        <div className={styles.leftCol}>
          {/* Milestone progress */}
          <section className={styles.panel}>
            <div className={styles.panelHeadRow}>
              <div>
                <h2 className={styles.panelTitle}>Milestone Progress</h2>
                <span className={styles.panelSub}>
                  {loading
                    ? 'Loading…'
                    : `${totals.approved} approved · ${totals.underReview} in review · ${totals.open} open`}
                </span>
              </div>
              <span className={styles.filterChip}>{completionPct}% complete</span>
            </div>

            {loading ? (
              <div className={styles.skeletonList}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className={styles.skeletonProjectRow}>
                    <SkeletonLine w="120px" h={12} />
                    <SkeletonLine w="100%" h={10} />
                    <SkeletonLine w="36px" h={12} />
                  </div>
                ))}
              </div>
            ) : activeProjects.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyEmoji}>📂</span>
                <p>No projects yet.</p>
                <Link href="/projects" className={styles.emptyLink}>
                  Browse projects →
                </Link>
              </div>
            ) : (
              <div className={styles.projectProgressList}>
                {/* Overall bar */}
                <div className={styles.overallBar}>
                  <div className={styles.overallBarLabel}>
                    <span>Overall</span>
                    <span>{completionPct}%</span>
                  </div>
                  <MilestoneBar
                    approved={totals.approved}
                    underReview={totals.underReview}
                    total={totals.total}
                  />
                  <div className={styles.barLegend}>
                    <span className={styles.legendDot} style={{ background: '#34d399' }} />
                    <span>Approved</span>
                    <span className={styles.legendDot} style={{ background: '#a78bfa' }} />
                    <span>Review</span>
                    <span
                      className={styles.legendDot}
                      style={{ background: 'var(--surface-muted)' }}
                    />
                    <span>Open</span>
                  </div>
                </div>

                {/* Per-project rows */}
                {activeProjects.map(({ project, stats }) => {
                  const pct = stats?.completion ?? 0;
                  const dotColor = pct >= 80 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#60a5fa';
                  return (
                    <div key={project.id} className={styles.projectProgressRow}>
                      <span
                        className={styles.projectDot}
                        style={{ background: dotColor }}
                        title={`${pct}% complete`}
                      />
                      <span className={styles.projectName}>{project.title}</span>
                      <div className={styles.locationBar}>
                        <div
                          className={styles.locationFill}
                          style={{ width: `${pct}%`, background: dotColor }}
                        />
                      </div>
                      <span className={styles.locationPct}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Activity feed */}
          <section className={styles.panel}>
            <div className={styles.panelHeadRow}>
              <div>
                <h2 className={styles.panelTitle}>Activity</h2>
                <span className={styles.panelSub}>
                  {loading
                    ? 'Loading…'
                    : dashboard?.activity?.length
                      ? `${dashboard.activity.length} recent events`
                      : 'No recent activity'}
                </span>
              </div>
              <Link href="/projects" className={styles.viewAll}>
                View all
              </Link>
            </div>

            {loading ? (
              <div className={styles.skeletonList}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={styles.activityRow}>
                    <SkeletonLine w="28px" h={28} />
                    <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                      <SkeletonLine w="60%" h={12} />
                      <SkeletonLine w="40%" h={10} />
                    </div>
                    <SkeletonLine w="50px" h={11} />
                  </div>
                ))}
              </div>
            ) : !dashboard?.activity?.length ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyEmoji}>🌱</span>
                <p>No activity yet. Submit your first milestone!</p>
              </div>
            ) : (
              <div className={styles.activityList}>
                {dashboard.activity.slice(0, 6).map((entry) => (
                  <div key={entry.id} className={styles.activityRow}>
                    <span className={styles.activityEmoji} aria-hidden="true">
                      {actionEmoji(entry.action)}
                    </span>
                    <div className={styles.activityBody}>
                      <strong>{entry.summary}</strong>
                      <span>{entry.action.replace(/_/g, ' ')}</span>
                    </div>
                    <time className={styles.activityTime}>{formatShortDate(entry.createdAt)}</time>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT column */}
        <div className={styles.rightCol}>
          {/* My Projects */}
          <section className={styles.panel}>
            <div className={styles.panelHeadRow}>
              <h2 className={styles.panelTitle}>My Projects</h2>
              <Link href="/projects" className={styles.viewAll}>
                View all
              </Link>
            </div>

            {loading ? (
              <div className={styles.skeletonList}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className={styles.courseCard}>
                    <SkeletonLine w="38px" h={38} />
                    <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                      <SkeletonLine w="70%" h={12} />
                      <SkeletonLine w="50%" h={10} />
                    </div>
                  </div>
                ))}
              </div>
            ) : !activeProjects.length ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyEmoji}>📋</span>
                <p>No projects assigned yet.</p>
              </div>
            ) : (
              <div className={styles.courseList}>
                {activeProjects.map(({ project, stats }) => {
                  const pct = stats?.completion ?? 0;
                  const dotColor = pct >= 80 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#60a5fa';
                  return (
                    <div key={project.id} className={styles.courseCard}>
                      <div
                        className={styles.courseThumbnail}
                        style={{ background: `${dotColor}1a`, border: `1px solid ${dotColor}40` }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 18 18"
                          fill="none"
                          aria-hidden="true"
                        >
                          <rect
                            x="1"
                            y="1"
                            width="16"
                            height="16"
                            rx="3.5"
                            fill={`${dotColor}30`}
                            stroke={dotColor}
                            strokeWidth="1.2"
                          />
                          <path
                            d="M5 9l3 3 5-5"
                            stroke={dotColor}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <div className={styles.courseInfo}>
                        <strong className={styles.courseTitle}>{project.title}</strong>
                        <span className={styles.courseMeta}>
                          {stats?.total ?? 0} milestones · {stats?.approved ?? 0} approved
                        </span>
                      </div>
                      <div className={styles.courseStats}>
                        <span className={styles.coursePercent} style={{ color: dotColor }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Deadlines */}
          <section className={styles.panel}>
            <div className={styles.panelHeadRow}>
              <div>
                <h2 className={styles.panelTitle}>Deadlines</h2>
                <span className={styles.panelSub}>
                  {loading
                    ? 'Loading…'
                    : overdueMilestones.length > 0
                      ? `${overdueMilestones.length} overdue`
                      : upcomingMilestones.length > 0
                        ? `${upcomingMilestones.length} upcoming`
                        : 'All clear 🎉'}
                </span>
              </div>
            </div>

            {loading ? (
              <div className={styles.skeletonList}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className={styles.deadlineRow}>
                    <SkeletonLine w="7px" h={7} />
                    <div style={{ flex: 1, display: 'grid', gap: 5 }}>
                      <SkeletonLine w="70%" h={12} />
                      <SkeletonLine w="40%" h={10} />
                    </div>
                    <SkeletonLine w="48px" h={11} />
                  </div>
                ))}
              </div>
            ) : overdueMilestones.length === 0 && upcomingMilestones.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyEmoji}>✅</span>
                <p>No upcoming deadlines — you&apos;re all caught up!</p>
              </div>
            ) : (
              <div className={styles.deadlineList}>
                {overdueMilestones.slice(0, 3).map((m) => {
                  const d = daysUntil(m.dueAt!);
                  return (
                    <div key={m.id} className={`${styles.deadlineRow} ${styles.deadlineOverdue}`}>
                      <span className={`${styles.deadlineDot} ${styles.dotRed}`} />
                      <div className={styles.deadlineBody}>
                        <strong>{m.title}</strong>
                        <span>
                          {Math.abs(d)} day{Math.abs(d) !== 1 ? 's' : ''} overdue
                        </span>
                      </div>
                      <time className={`${styles.deadlineDate} ${styles.dateRed}`}>
                        {formatShortDate(m.dueAt)}
                      </time>
                    </div>
                  );
                })}
                {upcomingMilestones.map((m) => {
                  const d = daysUntil(m.dueAt!);
                  const urgent = d <= 2;
                  return (
                    <div key={m.id} className={styles.deadlineRow}>
                      <span
                        className={styles.deadlineDot}
                        style={{ background: urgent ? '#fbbf24' : 'var(--primary)' }}
                      />
                      <div className={styles.deadlineBody}>
                        <strong>{m.title}</strong>
                        <span>{m.statusLabel}</span>
                      </div>
                      <time
                        className={styles.deadlineDate}
                        style={{ color: urgent ? '#fbbf24' : undefined }}
                      >
                        {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : formatShortDate(m.dueAt)}
                      </time>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
