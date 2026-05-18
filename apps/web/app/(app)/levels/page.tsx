'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../_components/widgets/EmptyState';
import { getMyReputation, type MyReputation } from '../../lib/services/reputation';
import { friendlyMessage } from '../../lib/api-clients/errors';

const LEVELS = [
  { tier: 1, label: 'Beginner', threshold: 0, color: '#94a3b8' },
  { tier: 2, label: 'Apprentice', threshold: 250, color: '#22c55e' },
  { tier: 3, label: 'Practitioner', threshold: 750, color: '#38bdf8' },
  { tier: 4, label: 'Specialist', threshold: 1500, color: '#a78bfa' },
  { tier: 5, label: 'Expert', threshold: 3000, color: '#f59e0b' },
  { tier: 6, label: 'Master', threshold: 6000, color: '#ef4444' },
];

function computeCurrentTier(score: number) {
  let current = LEVELS[0];
  for (const tier of LEVELS) {
    if (score >= tier.threshold) current = tier;
  }
  return current;
}

function computeNextTier(score: number) {
  return LEVELS.find((tier) => tier.threshold > score) ?? null;
}

export default function LevelsPage() {
  const [reputation, setReputation] = useState<MyReputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReputation(await getMyReputation());
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = reputation?.total ?? 0;
  const current = useMemo(() => computeCurrentTier(total), [total]);
  const next = useMemo(() => computeNextTier(total), [total]);
  const pct = next
    ? Math.min(
        100,
        Math.round(((total - current.threshold) / (next.threshold - current.threshold)) * 100)
      )
    : 100;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Levels</h1>
        <p className={styles.subtitle}>
          Climb through tiers by earning reputation, completing milestones, and helping peers.
        </p>
      </header>

      <div className={styles.summaryCard}>
        {loading ? (
          <div style={{ height: 160 }} aria-hidden="true" />
        ) : error || !reputation ? (
          <EmptyState
            title="Level data not loaded"
            description={error ?? 'Sign in and wait for the platform to compute your tier.'}
            tone={error ? 'error' : 'default'}
            action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
          />
        ) : (
          <>
            <div className={styles.currentTier}>
              <span className={styles.currentBadge} style={{ background: current.color }}>
                {current.tier}
              </span>
              <div className={styles.currentText}>
                <strong>{current.label}</strong>
                <span>{total.toLocaleString()} reputation</span>
              </div>
            </div>
            <div className={styles.progressBlock}>
              <div className={styles.progressMeta}>
                <span>{next ? `Next: ${next.label}` : 'Max tier reached'}</span>
                <span>
                  {next
                    ? `${(next.threshold - total).toLocaleString()} to go`
                    : 'Legendary status'}
                </span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </>
        )}
      </div>

      <section className={styles.tiers}>
        <h2 className={styles.sectionTitle}>All tiers</h2>
        <ul className={styles.tierList}>
          {LEVELS.map((tier) => {
            const isCurrent = tier.tier === current.tier && !!reputation;
            const isUnlocked = !!reputation && total >= tier.threshold;
            return (
              <li
                key={tier.tier}
                className={`${styles.tierRow} ${isCurrent ? styles.tierRowActive : ''}`}
              >
                <span className={styles.tierBadge} style={{ background: tier.color }}>
                  {tier.tier}
                </span>
                <div className={styles.tierBody}>
                  <strong>{tier.label}</strong>
                  <span>{tier.threshold.toLocaleString()} points</span>
                </div>
                <span
                  className={`${styles.tierState} ${
                    isCurrent
                      ? styles.statusCurrent
                      : isUnlocked
                        ? styles.statusUnlocked
                        : styles.statusLocked
                  }`}
                >
                  {isCurrent ? 'Current' : isUnlocked ? 'Unlocked' : 'Locked'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
