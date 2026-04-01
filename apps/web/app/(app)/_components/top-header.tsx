'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import ThemeToggle from './theme-toggle';

type ShellSessionUser = {
  username: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
};

function getInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'NB';
  return (
    trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || trimmed.slice(0, 2).toUpperCase()
  );
}

const BREADCRUMBS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/instructor': 'Instructor',
  '/instructor/onboarding': 'CLI Setup Guide',
  '/admin': 'Admin',
};

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M9 1.5a5.5 5.5 0 00-5.5 5.5v3L2 12h14l-1.5-2V7A5.5 5.5 0 009 1.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7 12v.5a2 2 0 004 0V12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function TopHeader({
  user,
  loading,
}: {
  user: ShellSessionUser | null;
  loading: boolean;
}) {
  const pathname = usePathname();
  const identity = user?.username || user?.githubLogin || 'Nibras';

  // Match the most specific breadcrumb path
  const breadcrumb =
    Object.entries(BREADCRUMBS)
      .filter(([path]) => pathname === path || pathname?.startsWith(path + '/'))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'Dashboard';

  const githubAvatarUrl =
    user?.githubLogin && user.githubLinked
      ? `https://avatars.githubusercontent.com/${user.githubLogin}?s=40`
      : null;

  return (
    <header className="topHeader">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>Nibras</span>
        <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>/</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          {breadcrumb}
        </span>
      </div>

      {/* Center: Search */}
      <div className="headerSearch" style={{ flex: '0 1 360px' }}>
        <SearchIcon />
        <input type="search" placeholder="Search projects, courses…" aria-label="Search" />
      </div>

      {/* Right: actions */}
      <div className="headerActions">
        <ThemeToggle />

        {/* Notification bell */}
        <button
          className="iconButton notifBadge"
          aria-label="Notifications"
          title="Notifications"
          style={{ position: 'relative' }}
        >
          <BellIcon />
        </button>

        {/* Profile chip */}
        <div className="profileChip" aria-live="polite">
          {githubAvatarUrl ? (
            <Image
              src={githubAvatarUrl}
              alt={`${user?.githubLogin ?? ''} avatar`}
              width={36}
              height={36}
              className="profileCircle"
              style={{ borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <span className="profileCircle">{loading ? '…' : getInitials(identity)}</span>
          )}
          <div>
            <strong>{loading ? 'Loading' : identity}</strong>
            <span>{user?.githubLinked ? 'GitHub connected' : 'Web session'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
