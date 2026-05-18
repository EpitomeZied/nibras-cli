'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../_components/widgets/EmptyState';
import StatTile from '../../_components/widgets/StatTile';
import BarChart from '../../_components/widgets/BarChart';
import { getOverview, type OverviewResponse } from '../../../lib/services/analytics';
import { friendlyMessage } from '../../../lib/api-clients/errors';

type Range = '7d' | '30d' | '90d' | 'term' | 'custom';

const ANALYTICS_RANGE_KEY = 'nibras.analytics.range';

function formatDelta(value: number): string {
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : `${value}`;
}

function deltaTrend(value: number): 'up' | 'down' | 'flat' {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

export default function AnalyticsOverviewPage() {
  const [range, setRange] = useState<Range>('30d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(ANALYTICS_RANGE_KEY);
    if (stored === '7d' || stored === '30d' || stored === '90d' || stored === 'term') {
      setRange(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || range === 'custom') return;
    window.localStorage.setItem(ANALYTICS_RANGE_KEY, range);
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (range === 'custom') {
        if (!fromDate || !toDate) {
          setLoading(false);
          return;
        }
        setData(await getOverview({ from: fromDate, to: toDate }));
      } else {
        setData(await getOverview({ range }));
      }
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics Overview</h1>
          <p className={styles.subtitle}>
            Aggregate signal across courses — submissions, pass rate, and rising topics.
          </p>
        </div>
        <div className={styles.rangePicker} role="tablist" aria-label="Date range">
          {(['7d', '30d', '90d', 'term', 'custom'] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              className={`${styles.rangeChip} ${range === r ? styles.rangeChipActive : ''}`}
              onClick={() => setRange(r)}
            >
              {r === 'term' ? 'Term' : r === 'custom' ? 'Custom' : r.replace('d', ' days')}
            </button>
          ))}
        </div>
      </header>

      {range === 'custom' && (
        <div className={styles.customRange}>
          <label className={styles.customLabel}>
            From
            <input
              type="date"
              className={styles.customInput}
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label className={styles.customLabel}>
            To
            <input
              type="date"
              className={styles.customInput}
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
        </div>
      )}

      {loading ? (
        <div style={{ height: 360, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error || !data ? (
        <EmptyState
          title="Analytics not loaded"
          description={error ?? "The analytics service hasn't returned data yet."}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      ) : (
        <>
          <div className={styles.kpis}>
            <StatTile
              label="Active Students"
              value={data.kpis.activeStudents.toLocaleString()}
              delta={formatDelta(data.kpis.activeStudentsDelta)}
              trend={deltaTrend(data.kpis.activeStudentsDelta)}
            />
            <StatTile
              label="Submissions"
              value={data.kpis.submissionsThisWeek.toLocaleString()}
              delta={formatDelta(data.kpis.submissionsDelta)}
              trend={deltaTrend(data.kpis.submissionsDelta)}
              caption="this week"
            />
            <StatTile
              label="Pass Rate"
              value={`${Math.round(data.kpis.passRate * 100)}%`}
              delta={`${formatDelta(Math.round(data.kpis.passRateDelta * 100))}%`}
              trend={deltaTrend(data.kpis.passRateDelta)}
            />
            <StatTile
              label="Median Grade"
              value={data.kpis.medianGrade.toFixed(1)}
            />
          </div>

          <div className={styles.chartGrid}>
            <section className={styles.chartCard}>
              <h2 className={styles.chartTitle}>Submissions per day</h2>
              <BarChart
                data={data.series.submissions.slice(-14).map((p) => ({
                  label: p.date.slice(5),
                  value: p.value,
                }))}
                height={220}
              />
            </section>
            <section className={styles.chartCard}>
              <h2 className={styles.chartTitle}>Pass rate per day</h2>
              <BarChart
                data={data.series.passRate.slice(-14).map((p) => ({
                  label: p.date.slice(5),
                  value: Math.round(p.value * 100),
                  color: 'var(--primary, #22c55e)',
                }))}
                height={220}
                yLabel="%"
              />
            </section>
          </div>

          <div className={styles.callouts}>
            <section className={styles.chartCard}>
              <h2 className={styles.chartTitle}>Rising topics</h2>
              {data.topRisingTopics.length === 0 ? (
                <span className={styles.subtitle}>No standout topics yet.</span>
              ) : (
                <ul className={styles.list}>
                  {data.topRisingTopics.map((t) => (
                    <li key={t.topic} className={styles.listRow}>
                      <span>{t.topic}</span>
                      <span
                        className={
                          t.delta >= 0 ? styles.deltaPositive : styles.deltaNegative
                        }
                      >
                        {formatDelta(t.delta)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className={styles.chartCard}>
              <h2 className={styles.chartTitle}>Flagged cohorts</h2>
              {data.flaggedCohorts.length === 0 ? (
                <span className={styles.subtitle}>Nothing flagged.</span>
              ) : (
                <ul className={styles.list}>
                  {data.flaggedCohorts.map((c, idx) => (
                    <li key={`${c.cohort}-${idx}`} className={styles.listRow}>
                      <div>
                        <strong>{c.cohort}</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                          {c.reason}
                        </div>
                      </div>
                      <span className={styles.flagBadge}>Review</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
