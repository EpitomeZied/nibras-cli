'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../_components/widgets/EmptyState';
import BadgeCard from '../_components/widgets/BadgeCard';
import StatTile from '../_components/widgets/StatTile';
import { getAllBadges, checkAwardBadges, type Badge } from '../../lib/services/gamification';
import { getMyReputation, type MyReputation } from '../../lib/services/reputation';
import { friendlyMessage } from '../../lib/api-clients/errors';

const TrophyIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M4 3h8v2a4 4 0 01-8 0V3z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M8 9v3M5 13h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path
      d="M3 4H1.5v1.5A2.5 2.5 0 004 8M13 4h1.5v1.5A2.5 2.5 0 0112 8"
      stroke="currentColor"
      strokeWidth="1.4"
    />
  </svg>
);

const SparkleIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M12 12l-2-2M4 12l2-2M12 4l-2 2"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

export default function AchievementsPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [reputation, setReputation] = useState<MyReputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allBadges, newlyAwarded, myRep] = await Promise.allSettled([
        getAllBadges(),
        checkAwardBadges(),
        getMyReputation(),
      ]);

      const list = allBadges.status === 'fulfilled' ? allBadges.value : [];
      const awardedById = new Map<string, Badge>();
      if (newlyAwarded.status === 'fulfilled') {
        for (const b of newlyAwarded.value) awardedById.set(b.id, b);
      }
      const merged = list.map((b) =>
        awardedById.has(b.id) ? { ...b, ...awardedById.get(b.id)! } : b
      );

      setBadges(merged);
      setReputation(myRep.status === 'fulfilled' ? myRep.value : null);

      if (allBadges.status === 'rejected' && myRep.status === 'rejected') {
        setError(friendlyMessage(allBadges.reason));
      }
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
        <div className={styles.skeleton} aria-hidden="true">
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="Couldn't load achievements"
          description={error}
          tone="error"
          action={{ label: 'Retry', onClick: () => void load() }}
        />
      </div>
    );
  }

  const earned = badges.filter((b) => Boolean(b.earnedAt));
  const locked = badges.filter((b) => !b.earnedAt);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Achievements</h1>
          <p className={styles.subtitle}>Track the badges you've earned and the ones still ahead.</p>
        </div>
      </header>

      <div className={styles.summary}>
        <StatTile label="Badges Earned" value={earned.length} icon={TrophyIcon} caption={`of ${badges.length}`} />
        <StatTile
          label="Reputation"
          value={reputation?.total ?? '—'}
          delta={reputation?.weeklyDelta ? `${reputation.weeklyDelta >= 0 ? '+' : ''}${reputation.weeklyDelta} this week` : undefined}
          trend={reputation?.weeklyDelta && reputation.weeklyDelta > 0 ? 'up' : reputation?.weeklyDelta && reputation.weeklyDelta < 0 ? 'down' : 'flat'}
          icon={SparkleIcon}
        />
        <StatTile
          label="Rank Percentile"
          value={reputation?.percentile ? `${reputation.percentile}%` : '—'}
          caption={reputation?.rank ? `#${reputation.rank} overall` : undefined}
        />
        <StatTile
          label="Legendary"
          value={badges.filter((b) => b.rarity === 'legendary' && b.earnedAt).length}
          caption="Rarest unlocks"
        />
      </div>

      {earned.length === 0 && locked.length === 0 ? (
        <EmptyState
          title="No badges yet"
          description="Complete projects, submit milestones, and contribute to the community to start unlocking badges."
        />
      ) : (
        <>
          {earned.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Earned</h2>
                <span className={styles.sectionMeta}>{earned.length} unlocked</span>
              </div>
              <div className={styles.grid}>
                {earned.map((badge) => (
                  <BadgeCard
                    key={badge.id}
                    name={badge.name}
                    description={badge.description}
                    iconUrl={badge.iconUrl}
                    rarity={badge.rarity}
                    earned
                  />
                ))}
              </div>
            </section>
          )}
          {locked.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Locked</h2>
                <span className={styles.sectionMeta}>{locked.length} to go</span>
              </div>
              <div className={styles.grid}>
                {locked.map((badge) => (
                  <BadgeCard
                    key={badge.id}
                    name={badge.name}
                    description={badge.description}
                    iconUrl={badge.iconUrl}
                    rarity={badge.rarity}
                    progress={badge.progress}
                    threshold={badge.threshold}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
