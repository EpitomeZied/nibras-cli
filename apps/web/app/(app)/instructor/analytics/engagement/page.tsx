'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../../_components/widgets/EmptyState';
import StatTile from '../../../_components/widgets/StatTile';
import BarChart from '../../../_components/widgets/BarChart';
import { getEngagement, type EngagementResponse } from '../../../../lib/services/analytics';
import { friendlyMessage } from '../../../../lib/api-clients/errors';

export default function EngagementPage() {
  const [data, setData] = useState<EngagementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getEngagement());
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Engagement</h1>
        <p className={styles.subtitle}>
          Time spent on the platform broken down by day of week and course.
        </p>
      </header>

      {loading ? (
        <div style={{ height: 320, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error || !data ? (
        <EmptyState
          title="No engagement data"
          description={error ?? 'The signal will appear once students log activity.'}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      ) : (
        <>
          <div className={styles.kpis}>
            <StatTile label="Total hours" value={data.totalHours.toLocaleString()} />
            <StatTile label="Avg session" value={`${data.averageSession.toFixed(1)} min`} />
            <StatTile
              label="Weekly retention"
              value={`${Math.round(data.retentionWeekly * 100)}%`}
            />
          </div>

          <div className={styles.chartGrid}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Hours by day of week</h2>
              <BarChart
                data={data.byDay.map((d) => ({ label: d.bucket, value: d.hours }))}
                height={240}
              />
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>By course</h2>
              {data.byCourse.length === 0 ? (
                <span className={styles.subtitle}>No data.</span>
              ) : (
                <ul className={styles.courseList}>
                  {data.byCourse.map((c) => {
                    const max = Math.max(...data.byCourse.map((cc) => cc.hours), 1);
                    const pct = (c.hours / max) * 100;
                    return (
                      <li key={c.courseId} className={styles.courseRow}>
                        <span className={styles.courseCode}>{c.code}</span>
                        <div className={styles.courseBar}>
                          <div className={styles.courseBarFill} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={styles.courseHours}>{c.hours}h</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
