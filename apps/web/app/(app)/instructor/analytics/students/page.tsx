'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../../_components/widgets/EmptyState';
import Sparkline from '../../../_components/widgets/Sparkline';
import { getStudents, type StudentRow } from '../../../../lib/services/analytics';
import { friendlyMessage } from '../../../../lib/api-clients/errors';

type RiskLevel = 'low' | 'medium' | 'high';

export default function StudentsAnalyticsPage() {
  const [risk, setRisk] = useState<RiskLevel | 'all'>('all');
  const [cohort, setCohort] = useState<string | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getStudents({
        risk: risk === 'all' ? undefined : risk,
        cohort: cohort ?? undefined,
      });
      setRows(response.rows ?? []);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [risk, cohort]);

  useEffect(() => {
    void load();
  }, [load]);

  const cohorts = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.cohort) set.add(row.cohort);
    }
    return [...set].sort();
  }, [rows]);

  function riskClass(level: RiskLevel) {
    if (level === 'high') return styles.riskHigh;
    if (level === 'medium') return styles.riskMedium;
    return styles.riskLow;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Students</h1>
          <p className={styles.subtitle}>
            Per-student engagement, grades, and risk classification.
          </p>
        </div>
        <div className={styles.riskFilter} role="tablist" aria-label="Risk filter">
          {(['all', 'low', 'medium', 'high'] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={risk === r}
              className={`${styles.riskChip} ${risk === r ? styles.riskChipActive : ''}`}
              onClick={() => setRisk(r)}
            >
              {r === 'all' ? 'All' : r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {(cohorts.length > 0 || cohort) && (
        <div className={styles.cohortFilter}>
          <span className={styles.cohortLabel}>Cohort:</span>
          <button
            type="button"
            className={`${styles.cohortChip} ${cohort === null ? styles.cohortChipActive : ''}`}
            onClick={() => setCohort(null)}
          >
            All
          </button>
          {cohorts.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.cohortChip} ${cohort === c ? styles.cohortChipActive : ''}`}
              onClick={() => setCohort(cohort === c ? null : c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ height: 300, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error || rows.length === 0 ? (
        <EmptyState
          title="No student data"
          description={error ?? "Student analytics haven't loaded yet."}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Cohort</th>
                <th className={styles.numeric}>Hrs / wk</th>
                <th className={styles.numeric}>Avg grade</th>
                <th>Trend</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId}>
                  <td>
                    <div className={styles.userCell}>
                      <strong>{row.username}</strong>
                      {row.email && <span className={styles.cohort}>{row.email}</span>}
                    </div>
                  </td>
                  <td>
                    {row.cohort ? (
                      <button
                        type="button"
                        className={styles.cohortLink}
                        onClick={() => setCohort(row.cohort ?? null)}
                      >
                        {row.cohort}
                      </button>
                    ) : (
                      <span className={styles.cohort}>—</span>
                    )}
                  </td>
                  <td className={styles.numeric}>{row.hoursWeekly.toFixed(1)}</td>
                  <td className={styles.numeric}>{row.averageGrade.toFixed(1)}</td>
                  <td>
                    <Sparkline
                      values={Array.from({ length: 8 }, (_, idx) =>
                        Math.max(0, row.averageGrade + (row.trend ?? 0) * (idx / 8) + (idx % 2 ? -0.2 : 0.2))
                      )}
                      width={80}
                      height={28}
                      color={
                        (row.trend ?? 0) >= 0
                          ? 'var(--primary, #22c55e)'
                          : 'var(--danger, #ef4444)'
                      }
                    />
                  </td>
                  <td>
                    <span className={`${styles.riskBadge} ${riskClass(row.riskLevel)}`}>
                      {row.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
