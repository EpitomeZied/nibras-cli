'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../_components/widgets/EmptyState';
import StatTile from '../../_components/widgets/StatTile';
import { getMyReputation, type MyReputation } from '../../../lib/services/reputation';
import { friendlyMessage } from '../../../lib/api-clients/errors';

function formatRelative(iso: string): string {
  try {
    const date = new Date(iso);
    const diffMs = date.getTime() - Date.now();
    const diffMin = Math.round(diffMs / 60000);
    const diffHr = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHr / 24);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
    if (Math.abs(diffHr) < 48) return rtf.format(diffHr, 'hour');
    return rtf.format(diffDay, 'day');
  } catch {
    return iso;
  }
}

export default function ReputationPage() {
  const [reputation, setReputation] = useState<MyReputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyReputation();
      setReputation(data);
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
          <h1 className={styles.title}>Reputation</h1>
        </header>
        <div style={{ height: 280, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      </div>
    );
  }

  if (error || !reputation) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Reputation</h1>
        </header>
        <EmptyState
          title="No reputation data yet"
          description={error ?? "Once your account starts accruing points, you'll see the breakdown here."}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      </div>
    );
  }

  const history = reputation.history ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Reputation</h1>
        <p className={styles.subtitle}>
          Your reputation grows as you submit projects, help peers in the community, and earn badges.
        </p>
      </header>

      <div className={styles.kpis}>
        <StatTile label="Total" value={reputation.total.toLocaleString()} />
        <StatTile
          label="This Week"
          value={reputation.weeklyDelta >= 0 ? `+${reputation.weeklyDelta}` : reputation.weeklyDelta}
          trend={reputation.weeklyDelta > 0 ? 'up' : reputation.weeklyDelta < 0 ? 'down' : 'flat'}
        />
        <StatTile
          label="This Month"
          value={reputation.monthlyDelta >= 0 ? `+${reputation.monthlyDelta}` : reputation.monthlyDelta}
          trend={reputation.monthlyDelta > 0 ? 'up' : reputation.monthlyDelta < 0 ? 'down' : 'flat'}
        />
        <StatTile
          label="Percentile"
          value={reputation.percentile ? `${reputation.percentile}%` : '—'}
          caption={reputation.rank ? `Rank #${reputation.rank}` : undefined}
        />
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent activity</h2>
        {history.length === 0 ? (
          <EmptyState
            title="No reputation events yet"
            description="Your contributions will show up here once they're recorded."
          />
        ) : (
          <div className={styles.history}>
            {history.map((event) => (
              <div key={event.id} className={styles.event}>
                <span
                  className={`${styles.delta} ${
                    event.delta >= 0 ? styles.deltaPositive : styles.deltaNegative
                  }`}
                >
                  {event.delta >= 0 ? `+${event.delta}` : event.delta}
                </span>
                <div className={styles.eventBody}>
                  <span className={styles.eventReason}>{event.reason}</span>
                  {event.source && <span className={styles.eventSource}>{event.source}</span>}
                </div>
                <span className={styles.eventTime}>{formatRelative(event.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
