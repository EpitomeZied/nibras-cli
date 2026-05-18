'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../_components/widgets/EmptyState';
import LeaderboardTable, {
  type LeaderboardRow,
} from '../../_components/widgets/LeaderboardTable';
import { getRanking, type RankingEntry } from '../../../lib/services/competitions';
import { useSession } from '../../_components/session-context';
import { friendlyMessage } from '../../../lib/api-clients/errors';

type Host = 'all' | 'codeforces' | 'leetcode' | 'atcoder';

export default function RankingPage() {
  const { user } = useSession();
  const [host, setHost] = useState<Host>('all');
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getRanking(host === 'all' ? undefined : host));
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows: LeaderboardRow[] = entries.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    username: entry.username,
    score: entry.rating,
    delta: entry.delta,
    badges: entry.badges,
    meta:
      entry.contestsLast30d !== undefined
        ? `${entry.contestsLast30d} contests · 30d`
        : undefined,
  }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Ranking</h1>
          <p className={styles.subtitle}>
            How you rank against the cohort across linked competitive platforms.
          </p>
        </div>
        <div className={styles.hostPicker} role="tablist" aria-label="Host">
          {(['all', 'codeforces', 'leetcode', 'atcoder'] as const).map((h) => (
            <button
              key={h}
              type="button"
              role="tab"
              aria-selected={host === h}
              className={`${styles.hostChip} ${host === h ? styles.hostChipActive : ''}`}
              onClick={() => setHost(h)}
            >
              {h === 'all' ? 'All' : h[0].toUpperCase() + h.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div style={{ height: 320, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error || rows.length === 0 ? (
        <EmptyState
          title={error ? 'Could not load ranking' : 'No ranking data'}
          description={error ?? 'Linked accounts will populate the leaderboard here.'}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      ) : (
        <LeaderboardTable
          rows={rows}
          highlightUserId={user?.username ?? null}
          scoreLabel="Rating"
          showBadges
        />
      )}
    </div>
  );
}
