'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../_components/widgets/EmptyState';
import StatTile from '../../_components/widgets/StatTile';
import { serviceFetch } from '../../../lib/api-clients/service-fetch';
import { friendlyMessage } from '../../../lib/api-clients/errors';

type InsightSkill = {
  topic: string;
  course?: string;
  score: number;
  delta?: number;
};

type LearningInsights = {
  totalMinutes: number;
  weeklyMinutes: number;
  streakDays: number;
  activeCourses: number;
  strengths: InsightSkill[];
  weaknesses: InsightSkill[];
  nextActions: string[];
};

export default function LearningInsightsPage() {
  const [data, setData] = useState<LearningInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const insights = await serviceFetch<LearningInsights>(
        'community',
        '/chatbot/insights',
        { auth: true }
      );
      setData(insights);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Learning Insights</h1>
        </header>
        <div style={{ height: 280, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Learning Insights</h1>
        </header>
        <EmptyState
          title="No insights yet"
          description={error ?? "Spend some time on the platform and the tutor will summarize your activity here."}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Learning Insights</h1>
        <p className={styles.subtitle}>
          Personalized summaries of where you're strong, where you're struggling, and what to study next.
        </p>
      </header>

      <div className={styles.kpis}>
        <StatTile label="This Week" value={`${data.weeklyMinutes} min`} caption="time spent" />
        <StatTile label="All Time" value={`${Math.round(data.totalMinutes / 60)} h`} caption="cumulative" />
        <StatTile label="Streak" value={`${data.streakDays} days`} trend={data.streakDays > 0 ? 'up' : 'flat'} />
        <StatTile label="Active Courses" value={data.activeCourses} />
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Top strengths</h2>
          {data.strengths.length === 0 ? (
            <span className={styles.rowMeta}>No data yet.</span>
          ) : (
            <ul className={styles.list}>
              {data.strengths.map((s) => (
                <li key={`${s.topic}-${s.course ?? ''}`} className={styles.row}>
                  <div className={styles.rowLabel}>
                    <strong>{s.topic}</strong>
                    {s.course && <span className={styles.rowMeta}>{s.course}</span>}
                  </div>
                  <span className={styles.rowStrong}>{Math.round(s.score * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Focus areas</h2>
          {data.weaknesses.length === 0 ? (
            <span className={styles.rowMeta}>Nothing flagged.</span>
          ) : (
            <ul className={styles.list}>
              {data.weaknesses.map((s) => (
                <li key={`${s.topic}-${s.course ?? ''}`} className={styles.row}>
                  <div className={styles.rowLabel}>
                    <strong>{s.topic}</strong>
                    {s.course && <span className={styles.rowMeta}>{s.course}</span>}
                  </div>
                  <span className={styles.rowWeak}>{Math.round(s.score * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.nextActions.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Suggested next steps</h2>
          <ul className={styles.actionList}>
            {data.nextActions.map((action, idx) => (
              <li key={idx} className={styles.actionItem}>
                {action}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
