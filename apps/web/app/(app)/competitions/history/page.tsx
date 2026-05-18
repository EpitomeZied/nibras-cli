'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../_components/widgets/EmptyState';
import Sparkline from '../../_components/widgets/Sparkline';
import {
  getMyHistory,
  type ContestHistoryEntry,
} from '../../../lib/services/competitions';
import { friendlyMessage } from '../../../lib/api-clients/errors';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<ContestHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getMyHistory());
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = [...entries].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  const currentRating = sorted[0]?.ratingAfter ?? 0;
  const ratingTrend = entries.map((e) => e.ratingAfter);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Contest History</h1>
        <p className={styles.subtitle}>
          Your past contest performance — rank, rating delta, and trend.
        </p>
      </header>

      {loading ? (
        <div style={{ height: 280, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error || entries.length === 0 ? (
        <EmptyState
          title={error ? 'Could not load history' : 'No history yet'}
          description={error ?? 'Participate in a contest to see your history here.'}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      ) : (
        <>
          <div className={styles.ratingCard}>
            <div>
              <div className={styles.ratingMetaLabel}>Current rating</div>
              <div className={styles.ratingValue}>{currentRating.toLocaleString()}</div>
            </div>
            <Sparkline values={ratingTrend} width={220} height={48} />
            <div className={styles.ratingMeta}>
              <span className={styles.ratingMetaLabel}>Contests</span>
              <span className={styles.ratingMetaValue}>{entries.length} on record</span>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Contest</th>
                  <th>Date</th>
                  <th className={styles.numeric}>Rank</th>
                  <th className={styles.numeric}>Δ</th>
                  <th className={styles.numeric}>Rating</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry) => (
                  <tr key={entry.contestId}>
                    <td>{entry.name}</td>
                    <td>{formatDate(entry.startedAt)}</td>
                    <td className={styles.numeric}>
                      {entry.rank.toLocaleString()} / {entry.participants.toLocaleString()}
                    </td>
                    <td
                      className={`${styles.numeric} ${
                        entry.delta >= 0 ? styles.deltaPositive : styles.deltaNegative
                      }`}
                    >
                      {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                    </td>
                    <td className={styles.numeric}>{entry.ratingAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
