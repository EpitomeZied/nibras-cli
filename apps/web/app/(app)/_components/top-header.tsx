'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { getInitials } from '../../lib/utils';
import NotificationsPanel from './notifications-panel';
import { SearchTrigger } from './search';

type ShellSessionUser = {
  username: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
};

const BREADCRUMBS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/instructor': 'Instructor',
  '/instructor/onboarding': 'CLI Setup Guide',
  '/admin': 'Admin',
  '/settings': 'Settings',
};

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
        <Image
          src="/branding/nibras-icon.svg"
          alt="Nibras"
          width={18}
          height={18}
          priority
          style={{ display: 'block' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>/</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          {breadcrumb}
        </span>
      </div>

      {/* Center: Search */}
      <div className="headerSearch" style={{ flex: '0 1 360px' }}>
        <SearchTrigger />
      </div>

      {/* Right: actions */}
      <div className="headerActions">
        {/* Notification bell with panel */}
        <NotificationsPanel user={user} />

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
