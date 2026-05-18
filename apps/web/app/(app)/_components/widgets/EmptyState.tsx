'use client';

import styles from './EmptyState.module.css';

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  tone?: 'default' | 'error';
};

const DEFAULT_ICON = (
  <svg
    width="40"
    height="40"
    viewBox="0 0 40 40"
    fill="none"
    aria-hidden="true"
    className={styles.defaultIcon}
  >
    <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
    <path
      d="M14 22c1.5 1.5 3.5 2.4 6 2.4s4.5-.9 6-2.4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="15.5" cy="16.5" r="1.2" fill="currentColor" />
    <circle cx="24.5" cy="16.5" r="1.2" fill="currentColor" />
  </svg>
);

export default function EmptyState({
  title,
  description,
  action,
  icon,
  tone = 'default',
}: EmptyStateProps) {
  return (
    <div className={`${styles.empty} ${tone === 'error' ? styles.error : ''}`}>
      <div className={styles.icon}>{icon ?? DEFAULT_ICON}</div>
      <strong className={styles.title}>{title}</strong>
      {description && <p className={styles.description}>{description}</p>}
      {action && (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
