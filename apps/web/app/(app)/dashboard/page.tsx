"use client";

import { useEffect, useMemo, useState } from "react";
import type { TrackingMilestone } from "@nibras/contracts";
import { apiFetch } from "../../lib/session";
import { loadDashboardData } from "./load-dashboard-data.js";
import type { LoadDashboardDataResult } from "./load-dashboard-data.js";
import styles from "./page.module.css";

function formatShortDate(value: string | null): string {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function sortByDueDate(left: TrackingMilestone, right: TrackingMilestone): number {
  if (!left.dueAt && !right.dueAt) return 0;
  if (!left.dueAt) return 1;
  if (!right.dueAt) return -1;
  return left.dueAt.localeCompare(right.dueAt);
}

// Simple sparkline SVG path generator
function sparklinePath(values: number[]): string {
  if (values.length < 2) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 32;
  const step = w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

// Mock weekly data for chart bars
const CHART_DATA = [
  { label: "1 Jan", views: 28, purchases: 12 },
  { label: "2 Jan", views: 45, purchases: 22 },
  { label: "3 Jan", views: 38, purchases: 16 },
  { label: "4 Jan", views: 62, purchases: 30 },
  { label: "5 Jan", views: 50, purchases: 24 },
  { label: "6 Jan", views: 72, purchases: 38 },
  { label: "7 Jan", views: 58, purchases: 28 },
];

const MAX_CHART = 80;

export default function DashboardPage() {
  const [data, setData] = useState<LoadDashboardDataResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const payload = await loadDashboardData({
          fetchJson: async (path: string, init?: RequestInit & { auth?: boolean }) => {
            const response = await apiFetch(path, init);
            return response.json() as Promise<unknown>;
          }
        });

        if (!alive) return;
        setData(payload);
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  const me = data?.me || null;
  const dashboard = data?.dashboard || null;
  const installUrl = data?.installUrl || "";

  const allMilestones = useMemo(() => {
    if (!dashboard) return [];
    return Object.values(dashboard.milestonesByProject).flat();
  }, [dashboard]);

  const datedMilestones = useMemo(
    () => [...allMilestones].filter((item) => item.dueAt).sort(sortByDueDate),
    [allMilestones]
  );

  const totals = useMemo(() => {
    if (!dashboard) return { approved: 0, underReview: 0, total: 0 };
    return Object.values(dashboard.statsByProject).reduce(
      (acc, s) => ({
        approved: acc.approved + s.approved,
        underReview: acc.underReview + s.underReview,
        total: acc.total + s.total
      }),
      { approved: 0, underReview: 0, total: 0 }
    );
  }, [dashboard]);

  const activeProjects = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.projects.slice(0, 4).map((project) => ({
      project,
      stats: dashboard.statsByProject[project.id]
    }));
  }, [dashboard]);

  const displayName = me?.user.username || me?.user.githubLogin || "Developer";
  const nameParts = displayName.split(/[\s_-]+/);
  const firstName = nameParts[0]?.toUpperCase() || "DEVELOPER";

  const completionRate = totals.total > 0
    ? Math.round((totals.approved / totals.total) * 100)
    : 0;

  // Fake sparkline data based on real values
  const approvedSparkline = [
    Math.max(0, totals.approved - 3),
    Math.max(0, totals.approved - 2),
    Math.max(0, totals.approved - 4),
    Math.max(0, totals.approved - 1),
    totals.approved
  ];

  const reviewSparkline = [
    Math.max(0, totals.underReview + 1),
    Math.max(0, totals.underReview + 2),
    Math.max(0, totals.underReview),
    Math.max(0, totals.underReview + 1),
    totals.underReview
  ];

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const dateRange = `${weekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <main className={styles.page}>

      {/* ── Welcome Banner ───────────────────────────────────────── */}
      <section className={styles.welcomeBanner}>
        <div className={styles.welcomeText}>
          <p className={styles.welcomeGreeting}>Welcome back,</p>
          <h1 className={styles.welcomeName}>{displayName.toUpperCase()}</h1>
          <p className={styles.welcomeSub}>Track your progress, manage your projects and milestone activity.</p>
        </div>
        <div className={styles.bannerActions}>
          <span className={styles.dateChip}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="2" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1 5h12" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 1v2M10 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {dateRange}
          </span>
          {installUrl
            ? <a className={styles.addBtn} href={installUrl}>Install GitHub App +</a>
            : <a className={styles.addBtn} href="/projects">Open Projects +</a>
          }
        </div>
      </section>

      {error ? (
        <div className={styles.errorBar}>{error}</div>
      ) : null}

      {/* ── Stat Cards ───────────────────────────────────────────── */}
      <section className={styles.statsRow}>
        <article className={styles.statCard}>
          <div className={styles.statLeft}>
            <span className={styles.statLabel}>Approved</span>
            <strong className={styles.statValue}>
              {loading ? "—" : totals.approved}
            </strong>
            <span className={`${styles.statBadge} ${styles.badgeGreen}`}>
              +{completionRate}%
            </span>
          </div>
          <svg className={styles.sparkline} viewBox="0 0 80 32" fill="none">
            <path d={sparklinePath(approvedSparkline)} stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statLeft}>
            <span className={styles.statLabel}>Under Review</span>
            <strong className={styles.statValue}>
              {loading ? "—" : totals.underReview}
            </strong>
            <span className={`${styles.statBadge} ${styles.badgePurple}`}>
              In queue
            </span>
          </div>
          <svg className={styles.sparkline} viewBox="0 0 80 32" fill="none">
            <path d={sparklinePath(reviewSparkline)} stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statLeft}>
            <span className={styles.statLabel}>Total Projects</span>
            <strong className={styles.statValue}>
              {loading ? "—" : dashboard?.projects.length || 0}
            </strong>
            <span className={`${styles.statBadge} ${styles.badgeBlue}`}>
              Active
            </span>
          </div>
          <div className={styles.projectsIcon} aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="2" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" strokeWidth="1.5"/>
              <rect x="16" y="2" width="10" height="10" rx="2" fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="1.5"/>
              <rect x="2" y="16" width="10" height="10" rx="2" fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="1.5"/>
              <rect x="16" y="16" width="10" height="10" rx="2" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" strokeWidth="1.5"/>
            </svg>
          </div>
        </article>
      </section>

      {/* ── Main Grid ────────────────────────────────────────────── */}
      <div className={styles.mainGrid}>

        {/* Left column */}
        <div className={styles.leftCol}>

          {/* Statistics chart */}
          <section className={styles.panel}>
            <div className={styles.panelHeadRow}>
              <div>
                <h2 className={styles.panelTitle}>Statistics</h2>
                <span className={styles.panelSub}>your av. completion {completionRate}%</span>
              </div>
              <div className={styles.chartControls}>
                <button className={`${styles.chartTab} ${styles.chartTabActive}`}>1W</button>
                <button className={styles.chartTab}>1M</button>
                <button className={styles.chartTab}>1Y</button>
                <span className={styles.legendItem}><span className={styles.dot} style={{ background: "#34d399" }} />views</span>
                <span className={styles.legendItem}><span className={styles.dot} style={{ background: "#3b82f6" }} />milestones</span>
              </div>
            </div>
            <div className={styles.chart}>
              <div className={styles.chartBars}>
                {CHART_DATA.map((d) => (
                  <div key={d.label} className={styles.chartBarGroup}>
                    <div className={styles.chartBarPair}>
                      <div
                        className={`${styles.chartBar} ${styles.chartBarGreen}`}
                        style={{ height: `${(d.views / MAX_CHART) * 100}%` }}
                      />
                      <div
                        className={`${styles.chartBar} ${styles.chartBarBlue}`}
                        style={{ height: `${(d.purchases / MAX_CHART) * 100}%` }}
                      />
                    </div>
                    <span className={styles.chartLabel}>{d.label}</span>
                  </div>
                ))}
              </div>
              <div className={styles.chartGridLines}>
                {[80, 60, 40, 20, 0].map((v) => (
                  <div key={v} className={styles.gridLine}>
                    <span className={styles.gridLabel}>{v}k</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Activity / Homework */}
          <section className={styles.panel}>
            <div className={styles.panelHeadRow}>
              <div>
                <h2 className={styles.panelTitle}>Activity</h2>
                <span className={styles.panelSub}>
                  {dashboard?.activity.length
                    ? `You have ${dashboard.activity.length} recent events`
                    : "No recent activity recorded"}
                </span>
              </div>
              <a className={styles.viewAll} href="/projects">View all</a>
            </div>
            <div className={styles.activityList}>
              {loading && <p className={styles.emptyMsg}>Loading…</p>}
              {!loading && !dashboard?.activity.length
                ? <p className={styles.emptyMsg}>No activity yet.</p>
                : null
              }
              {dashboard?.activity.slice(0, 5).map((entry) => (
                <div key={entry.id} className={styles.activityRow}>
                  <div className={styles.activityDot} />
                  <div className={styles.activityBody}>
                    <strong>{entry.summary}</strong>
                    <span>{entry.action.replace(/_/g, " ")}</span>
                  </div>
                  <time className={styles.activityTime}>{formatShortDate(entry.createdAt)}</time>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className={styles.rightCol}>

          {/* My Projects */}
          <section className={styles.panel}>
            <div className={styles.panelHeadRow}>
              <h2 className={styles.panelTitle}>My Projects</h2>
              <a className={styles.viewAll} href="/projects">View all</a>
            </div>
            <div className={styles.courseList}>
              {loading && <p className={styles.emptyMsg}>Loading…</p>}
              {!loading && !activeProjects.length
                ? <p className={styles.emptyMsg}>No projects yet.</p>
                : null
              }
              {activeProjects.map(({ project, stats }) => (
                <div key={project.id} className={styles.courseCard}>
                  <div className={styles.courseThumbnail}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                      <rect x="1" y="1" width="20" height="20" rx="4" fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth="1.2"/>
                      <path d="M7 11l3 3 5-5" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className={styles.courseInfo}>
                    <strong className={styles.courseTitle}>{project.title}</strong>
                    <span className={styles.courseMeta}>
                      {stats?.total ?? 0} milestones · {stats?.approved ?? 0} practical works
                    </span>
                  </div>
                  <div className={styles.courseStats}>
                    <span className={styles.coursePercent}>{stats?.completion ?? 0}%</span>
                    <span className={`${styles.courseBadge} ${(stats?.completion ?? 0) >= 50 ? styles.badgeGreen : styles.badgeBlue}`}>
                      {stats?.approved ?? 0}x
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Progress Breakdown */}
          <section className={styles.panel}>
            <div className={styles.panelHeadRow}>
              <h2 className={styles.panelTitle}>Progress</h2>
              <span className={styles.filterChip}>All projects</span>
            </div>
            <div className={styles.locationList}>
              {activeProjects.length === 0 && !loading
                ? <p className={styles.emptyMsg}>No data yet.</p>
                : null
              }
              {activeProjects.map(({ project, stats }) => {
                const pct = stats?.completion ?? 0;
                return (
                  <div key={project.id} className={styles.locationRow}>
                    <span className={styles.locationName}>{project.title}</span>
                    <div className={styles.locationBar}>
                      <div
                        className={styles.locationFill}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={styles.locationPct}>{pct}%</span>
                  </div>
                );
              })}
              {/* Upcoming deadlines */}
              {datedMilestones.slice(0, 3).map((m) => (
                <div key={m.id} className={styles.deadlineRow}>
                  <span className={styles.deadlineDot} />
                  <div className={styles.deadlineBody}>
                    <strong>{m.title}</strong>
                    <span>{m.statusLabel}</span>
                  </div>
                  <time className={styles.deadlineDate}>{formatShortDate(m.dueAt)}</time>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
