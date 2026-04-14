'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getInitials } from '../../lib/utils';
import NibrasLogo from '@/app/_components/nibras-logo';

type ShellSessionUser = {
  username: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  systemRole?: string;
};

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Courses', href: '/instructor' },
  { label: 'Projects', href: '/projects' },
  { label: 'Settings', href: '/settings' },
];

export default function TopHeader({
  user,
  loading,
}: {
  user: ShellSessionUser | null;
  loading: boolean;
}) {
  const pathname = usePathname();
  const identity = user?.username || user?.githubLogin || 'Nibras';

  const githubAvatarUrl =
    user?.githubLogin && user.githubLinked
      ? `https://avatars.githubusercontent.com/${user.githubLogin}?s=40`
      : null;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        height: 52,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(10,10,10,0.85)',
        gap: 24,
      }}
    >
      {/* Left: Logo + Beta + Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NibrasLogo variant="inverse" width={90} priority />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(74,222,128,0.9)',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 999,
              padding: '2px 8px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Beta
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {NAV_LINKS.filter(
            (l) => l.label !== 'Courses' || user?.systemRole === 'admin' || true
          ).map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#fafafa' : 'rgba(161,161,170,0.75)',
                  textDecoration: 'none',
                  background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: user avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Early builder badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(161,161,170,0.7)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 999,
            padding: '4px 10px',
            letterSpacing: '0.02em',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17.93V18a1 1 0 0 0-2 0v1.93A8 8 0 0 1 4.07 13H6a1 1 0 0 0 0-2H4.07A8 8 0 0 1 11 4.07V6a1 1 0 0 0 2 0V4.07A8 8 0 0 1 19.93 11H18a1 1 0 0 0 0 2h1.93A8 8 0 0 1 13 19.93z" />
          </svg>
          Early Builder
        </span>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {githubAvatarUrl ? (
            <Image
              src={githubAvatarUrl}
              alt={user?.githubLogin ?? 'avatar'}
              width={30}
              height={30}
              style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#fafafa',
                flexShrink: 0,
              }}
            >
              {loading ? '…' : getInitials(identity)}
            </span>
          )}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            style={{ color: 'rgba(161,161,170,0.5)' }}
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </header>
  );
}
