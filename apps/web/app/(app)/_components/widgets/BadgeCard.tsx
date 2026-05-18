'use client';

import styles from './BadgeCard.module.css';

export type BadgeCardProps = {
  name: string;
  description?: string;
  iconUrl?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  earned?: boolean;
  progress?: number;
  threshold?: number;
  onClick?: () => void;
};

function rarityClass(rarity?: BadgeCardProps['rarity']): string {
  switch (rarity) {
    case 'legendary':
      return styles.legendary;
    case 'epic':
      return styles.epic;
    case 'rare':
      return styles.rare;
    default:
      return styles.common;
  }
}

const FALLBACK_ICON = (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path
      d="M16 4l3 7 7.5.7-5.7 5 1.7 7.5L16 20.7 9.5 24.2 11.2 16.7 5.5 11.7 13 11z"
      fill="currentColor"
      opacity=".85"
    />
  </svg>
);

export default function BadgeCard({
  name,
  description,
  iconUrl,
  rarity,
  earned = false,
  progress,
  threshold,
  onClick,
}: BadgeCardProps) {
  const classes = [styles.card, rarityClass(rarity), earned ? styles.earned : styles.locked]
    .filter(Boolean)
    .join(' ');
  const hasProgress =
    typeof progress === 'number' && typeof threshold === 'number' && threshold > 0;
  const pct = hasProgress ? Math.min(100, Math.round(((progress ?? 0) / threshold) * 100)) : 0;

  return (
    <button type="button" className={classes} onClick={onClick} aria-pressed={earned}>
      <div className={styles.iconHolder}>
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className={styles.icon} />
        ) : (
          FALLBACK_ICON
        )}
      </div>
      <strong className={styles.name}>{name}</strong>
      {description && <span className={styles.description}>{description}</span>}
      {hasProgress && (
        <div className={styles.progressTrack} aria-label={`${pct}% to unlock`}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      )}
      {hasProgress && (
        <span className={styles.progressLabel}>
          {progress} / {threshold}
        </span>
      )}
    </button>
  );
}
