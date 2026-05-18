'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../../_components/widgets/EmptyState';
import { getCourseSummaries, type CourseSummary } from '../../../../lib/services/analytics';
import { friendlyMessage } from '../../../../lib/api-clients/errors';

export default function CoursesAnalyticsPage() {
  const [rows, setRows] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getCourseSummaries());
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
        <h1 className={styles.title}>Course Analytics</h1>
        <p className={styles.subtitle}>
          Per-course completion, average grade, and pass rate.
        </p>
      </header>

      {loading ? (
        <div style={{ height: 300, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error || rows.length === 0 ? (
        <EmptyState
          title={error ? 'Could not load courses' : 'No courses'}
          description={error ?? 'No course analytics returned for your accounts.'}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th className={styles.numeric}>Enrolled</th>
                <th className={styles.numeric}>Active / wk</th>
                <th>Completion</th>
                <th className={styles.numeric}>Avg grade</th>
                <th className={styles.numeric}>Pass rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const passPct = Math.round(row.passRate * 100);
                const completionPct = Math.round(row.completionRate * 100);
                return (
                  <tr key={row.courseId} className={styles.row}>
                    <td className={styles.code}>{row.code}</td>
                    <td>{row.title}</td>
                    <td className={styles.numeric}>{row.enrolled}</td>
                    <td className={styles.numeric}>{row.activeWeekly}</td>
                    <td>
                      <span className={styles.progressTrack}>
                        <span
                          className={styles.progressFill}
                          style={{ width: `${completionPct}%` }}
                        />
                      </span>
                      {completionPct}%
                    </td>
                    <td className={styles.numeric}>{row.averageGrade.toFixed(1)}</td>
                    <td
                      className={`${styles.numeric} ${
                        passPct >= 70 ? styles.passHigh : styles.passLow
                      }`}
                    >
                      {passPct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
