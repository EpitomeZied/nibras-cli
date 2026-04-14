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
      ? `https://avatars.githubusercontent.com/${user.githubLogin}?s=64`
      : null;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(10,10,10,0.88)',
      }}
    >
      {/* ── Centered inner wrapper ── */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 40px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
                border: '1px solid rgba(34,197,94,0.22)',
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
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#fafafa' : 'rgba(161,161,170,0.7)',
                    textDecoration: 'none',
                    background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                    transition: 'background 0.15s, color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: User avatar button */}
        <button
          aria-label={`User menu for ${identity}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            borderRadius: 8,
            padding: '4px 8px 4px 4px',
            cursor: 'pointer',
            transition: 'background 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {githubAvatarUrl ? (
            <Image
              src={githubAvatarUrl}
              alt={user?.githubLogin ?? 'avatar'}
              width={28}
              height={28}
              style={{
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
          ) : (
            <span
              style={{
                width: 28,
                height: 28,
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
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'rgba(250,250,250,0.8)',
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? '…' : identity}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            style={{ color: 'rgba(161,161,170,0.45)', flexShrink: 0 }}
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
      </div>
    </header>
  );
}
