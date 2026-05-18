'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../_components/widgets/EmptyState';
import LeaderboardTable, {
  type LeaderboardRow,
} from '../../_components/widgets/LeaderboardTable';
import {
  getLeaderboard,
  getMyLeaderboardRank,
  type LeaderboardFilters,
  type MyRank,
} from '../../../lib/services/gamification';
import { useSession } from '../../_components/session-context';
import { friendlyMessage } from '../../../lib/api-clients/errors';

type Period = NonNullable<LeaderboardFilters['period']>;
type Scope = NonNullable<LeaderboardFilters['scope']>;

export default function LeaderboardPage() {
  const { user } = useSession();
  const [period, setPeriod] = useState<Period>('week');
  const [scope, setScope] = useState<Scope>('global');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [boardResult, myResult] = await Promise.allSettled([
        getLeaderboard({ period, scope, limit: 50 }),
        getMyLeaderboardRank({ period, scope }),
      ]);
      if (boardResult.status === 'fulfilled') {
        const entries = boardResult.value.entries ?? [];
        setRows(
          entries.map((e) => ({
            rank: e.rank,
            userId: e.userId,
            username: e.username,
            avatarUrl: e.avatarUrl,
            score: e.score,
            delta: e.delta,
            badges: e.badges,
            level: e.level,
          }))
        );
      } else {
        setRows([]);
        setError(friendlyMessage(boardResult.reason));
      }
      setMyRank(myResult.status === 'fulfilled' ? myResult.value : null);
    } finally {
      setLoading(false);
    }
  }, [period, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const myUserId = user?.username ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Leaderboard</h1>
          <p className={styles.subtitle}>See where you stand against the community.</p>
        </div>
        <div className={styles.filters}>
          <div role="tablist" aria-label="Period" className={styles.tabGroup}>
            {(['today', 'week', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                className={`${styles.tab} ${period === p ? styles.tabActive : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p === 'all' ? 'All-time' : p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div className={styles.scopePicker}>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as Scope)}
              className={styles.select}
              aria-label="Scope"
            >
              <option value="global">Global</option>
              <option value="course">My course</option>
              <option value="cohort">My cohort</option>
            </select>
          </div>
        </div>
      </header>

      {myRank && myRank.rank !== null && (
        <div className={styles.myRow}>
          <div className={styles.myRowLeft}>
            <span className={styles.myRank}>#{myRank.rank}</span>
            <div className={styles.myRowText}>
              <strong>Your rank</strong>
              <span>
                {myRank.level !== undefined ? `Level ${myRank.level} · ` : ''}
                {myRank.badges ?? 0} badges
              </span>
            </div>
          </div>
          <div className={styles.myRowRight}>
            <div className={styles.myScore}>{myRank.score.toLocaleString()}</div>
            {myRank.delta !== undefined && myRank.delta !== 0 && (
              <div
                className={styles.myDelta}
                style={{ color: myRank.delta > 0 ? 'var(--primary, #22c55e)' : 'var(--danger, #ef4444)' }}
              >
                {myRank.delta > 0 ? '▲' : '▼'} {Math.abs(myRank.delta)}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.tableSkeleton} aria-hidden="true" style={{ height: 320 }} />
      ) : error && rows.length === 0 ? (
        <EmptyState
          title="Leaderboard unavailable"
          description={error}
          tone="error"
          action={{ label: 'Retry', onClick: () => void load() }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No one on this board yet"
          description="Check back after the cohort earns its first points."
        />
      ) : (
        <LeaderboardTable
          rows={rows}
          highlightUserId={myUserId}
          scoreLabel="Points"
          showBadges
          showLevel
        />
      )}
    </div>
  );
}
