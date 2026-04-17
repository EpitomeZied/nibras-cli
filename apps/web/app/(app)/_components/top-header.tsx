'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import NibrasLogo from '@/app/_components/nibras-logo';
import { getInitials } from '../../lib/utils';
import NotificationsPanel from './notifications-panel';
import { getActiveNavItem, pageTitles, type ShellSessionUser } from './nav-config';
import styles from './top-header.module.css';

function IconProfile() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function resolvePageMeta(pathname: string) {
  const entries = Object.entries(pageTitles).sort(
    (left, right) => right[0].length - left[0].length
  );
  return (
    entries.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? {
      title: 'Nibras',
      subtitle: 'Run modern academic workflows from one platform.',
    }
  );
}

function UserDropdown({ user, loading }: { user: ShellSessionUser | null; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const identity = user?.username || user?.githubLogin || 'Nibras';
  const githubAvatarUrl =
    user?.githubLogin && user.githubLinked
      ? `https://avatars.githubusercontent.com/${user.githubLogin}?s=64`
      : null;

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  return (
    <div ref={wrapRef} className={styles.userWrap}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User menu"
      >
        <span className={styles.avatar}>
          {githubAvatarUrl ? (
            <Image
              src={githubAvatarUrl}
              alt={user?.githubLogin ?? 'avatar'}
              width={32}
              height={32}
            />
          ) : (
            <span>{loading ? '…' : getInitials(identity)}</span>
          )}
        </span>
        <span className={styles.identity}>
          <strong>{loading ? 'Loading session' : identity}</strong>
          <span>{user?.email || 'GitHub-linked account'}</span>
        </span>
        <svg
          className={styles.chevron}
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div role="menu" className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <strong>{loading ? 'Loading session' : identity}</strong>
            <span>{user?.email || '—'}</span>
          </div>
          <Link
            href="/settings"
            role="menuitem"
            className={styles.dropdownLink}
            onClick={() => setOpen(false)}
          >
            <IconProfile />
            Profile
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            className={styles.dropdownLink}
            onClick={() => setOpen(false)}
          >
            <IconSettings />
            Settings
          </Link>
          <div className={styles.dropdownDivider}>
            <Link
              href="/"
              role="menuitem"
              className={`${styles.dropdownLink} ${styles.dangerLink}`}
              onClick={() => setOpen(false)}
            >
              <IconSignOut />
              Sign out
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TopHeader({
  user,
  loading,
  onMenuToggle,
  mobileNavOpen,
}: {
  user: ShellSessionUser | null;
  loading: boolean;
  onMenuToggle: () => void;
  mobileNavOpen: boolean;
}) {
  const pathname = usePathname();
  const [hash, setHash] = useState('');
  const pageMeta = resolvePageMeta(pathname);

  useEffect(() => {
    function updateHash() {
      setHash(window.location.hash);
    }

    updateHash();
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, []);

  const activeItem = useMemo(() => getActiveNavItem(pathname, user, hash), [pathname, user, hash]);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.lead}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={onMenuToggle}
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavOpen}
          >
            <span />
          </button>

          <div className={styles.mobileBrand}>
            <NibrasLogo variant="inverse" width={92} priority />
          </div>

          <div className={styles.titleBlock}>
            <div className={styles.titleRow}>
              {activeItem && <span className={styles.workspacePill}>{activeItem.label}</span>}
              <h1 className={styles.title}>{pageMeta.title}</h1>
            </div>
            <p className={styles.subtitle}>{pageMeta.subtitle}</p>
          </div>
        </div>

        <div className={styles.aside}>
          <NotificationsPanel />
          <UserDropdown user={user} loading={loading} />
        </div>
      </div>
    </header>
  );
}
