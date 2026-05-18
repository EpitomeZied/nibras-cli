'use client';

import styles from './StatTile.module.css';

export type StatTileProps = {
  label: string;
  value: string | number;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: React.ReactNode;
  caption?: string;
};

const TREND_ICON: Record<'up' | 'down' | 'flat', React.ReactNode> = {
  up: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3 7.5L6 4.5L9 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  down: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  flat: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

export default function StatTile({ label, value, delta, trend, icon, caption }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <div className={styles.head}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.label}>{label}</span>
      </div>
      <strong className={styles.value}>{value}</strong>
      {(delta || caption) && (
        <div className={styles.foot}>
          {delta && (
            <span
              className={`${styles.delta} ${
                trend === 'down' ? styles.deltaDown : trend === 'flat' ? styles.deltaFlat : styles.deltaUp
              }`}
            >
              {trend && TREND_ICON[trend]}
              {delta}
            </span>
          )}
          {caption && <span className={styles.caption}>{caption}</span>}
        </div>
      )}
    </div>
  );
}
