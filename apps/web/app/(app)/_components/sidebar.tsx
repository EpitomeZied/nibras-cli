'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import NibrasLogo from '@/app/_components/nibras-logo';
import { getInitials } from '../../lib/utils';
import { prefs, PREF_EVENTS } from '../../lib/prefs';
import { appNavItems, canAccessNavItem, isNavItemActive } from './nav-config';

type ShellSessionUser = {
  username: string;
  email: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  systemRole?: string;
  memberships?: Array<{ courseId: string; role: string; level: number }>;
};

const NAV_ICONS: Record<string, React.ReactNode> = {
  Dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9" />
    </svg>
  ),
  Projects: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M5 8h6M5 5.5h6M5 10.5h4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  Catalog: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1" y="7" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1" y="13" width="8" height="2" rx="1" fill="currentColor" opacity=".6" />
    </svg>
  ),
  Instructor: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  Admin: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2L9.5 6h4l-3.25 2.36 1.25 3.85L8 10l-3.5 2.21 1.25-3.85L2.5 6h4L8 2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Achievements: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 3h8v2a4 4 0 11-8 0V3z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 9v3M5 13h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M3 4H1.5v1.5A2.5 2.5 0 004 8M13 4h1.5v1.5A2.5 2.5 0 0112 8"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  ),
  Tutor: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5L5 11M11 5l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="2.4" fill="currentColor" opacity=".85" />
    </svg>
  ),
  Community: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 4a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2H6l-3 3v-3H4a2 2 0 01-2-2V4z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Competitions: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 2v11M4 2h7l-1.5 3L11 8H4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="4" cy="14" r="1.2" fill="currentColor" />
    </svg>
  ),
  Analytics: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 14V3M2 14h12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <rect x="4" y="8" width="2.5" height="4.5" rx="0.6" fill="currentColor" opacity=".8" />
      <rect x="8" y="5" width="2.5" height="7.5" rx="0.6" fill="currentColor" opacity=".85" />
      <rect x="12" y="10" width="2.5" height="2.5" rx="0.6" fill="currentColor" opacity=".6" />
    </svg>
  ),
  Settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
};

const CollapseIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    aria-hidden="true"
    style={{ transition: 'transform 0.2s ease', transform: collapsed ? 'rotate(180deg)' : 'none' }}
  >
    <path
      d="M9 3L5 7l4 4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Sidebar({
  user,
  loading,
}: {
  user: ShellSessionUser | null;
  loading: boolean;
}) {
  const pathname = usePathname();
  const displayName = user?.username || user?.githubLogin || 'Nibras User';

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    function syncCollapsed() {
      setCollapsed(prefs.getSidebarCollapsed());
    }

    syncCollapsed();
    window.addEventListener(PREF_EVENTS.sidebarCollapsedChanged, syncCollapsed);
    return () => window.removeEventListener(PREF_EVENTS.sidebarCollapsedChanged, syncCollapsed);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    prefs.setSidebarCollapsed(next);
  }

  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? 72 : 248,
        minWidth: collapsed ? 72 : 248,
        transition: 'width 0.2s ease',
        overflow: collapsed ? 'visible' : undefined,
      }}
    >
      {/* Brand */}
      <div className="brandBlock" style={{ justifyContent: collapsed ? 'center' : undefined }}>
        {collapsed ? (
          <Image
            src="/branding/nibras-icon.svg"
            alt="Nibras icon"
            width={32}
            height={32}
            priority
          />
        ) : (
          <NibrasLogo variant="theme" width={120} priority />
        )}
      </div>

      {/* Section label: MAIN */}
      {!collapsed && (
        <span
          className="sectionEyebrow"
          style={{ paddingLeft: 10, marginBottom: -4, fontSize: 10 }}
        >
          Main
        </span>
      )}

      {/* Primary nav */}
      <nav className="sidebarNav" aria-label="Primary">
        {appNavItems
          .filter((item) => canAccessNavItem(item, user))
          .map((item) => {
            const isActive = isNavItemActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navLink ${isActive ? 'navLinkActive navLinkAccentBorder' : ''}`}
                title={collapsed ? item.label : undefined}
                style={collapsed ? { justifyContent: 'center', padding: '9px 0' } : undefined}
              >
                <span className="navIcon" aria-hidden="true">
                  {NAV_ICONS[item.label] ?? '•'}
                </span>
                {!collapsed && <strong>{item.label}</strong>}
              </Link>
            );
          })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Section label: SYSTEM */}
      {!collapsed && (
        <span
          className="sectionEyebrow"
          style={{ paddingLeft: 10, marginBottom: -4, fontSize: 10 }}
        >
          System
        </span>
      )}

      {/* Bottom links */}
      <nav className="sidebarNav" aria-label="Secondary">
        <Link
          href="/settings"
          className={`navLink ${pathname === '/settings' ? 'navLinkActive navLinkAccentBorder' : ''}`}
          title={collapsed ? 'Settings' : undefined}
          style={collapsed ? { justifyContent: 'center', padding: '9px 0' } : undefined}
        >
          <span className="navIcon" aria-hidden="true">
            {NAV_ICONS['Settings']}
          </span>
          {!collapsed && <strong>Settings</strong>}
        </Link>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-soft)',
          cursor: 'pointer',
          fontSize: 12,
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-strong)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-soft)';
        }}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <CollapseIcon collapsed={collapsed} />
        {!collapsed && <span>Collapse</span>}
      </button>

      {/* Profile footer */}
      {!collapsed && (
        <div className="sidebarFooter">
          <div className="sidebarProfile">
            <span className="avatarCircle">{loading ? '…' : getInitials(displayName)}</span>
            <div>
              <strong>{loading ? 'Loading session' : displayName}</strong>
              <span>{user?.email || 'GitHub-linked account'}</span>
            </div>
          </div>
          <Link className="logoutLink" href="/">
            Sign out
          </Link>
        </div>
      )}

      {/* Collapsed: just avatar */}
      {collapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <span className="avatarCircle" title={displayName}>
            {loading ? '…' : getInitials(displayName)}
          </span>
        </div>
      )}
    </aside>
  );
}
