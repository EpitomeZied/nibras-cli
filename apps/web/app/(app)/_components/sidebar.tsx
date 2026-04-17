'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import NibrasLogo from '@/app/_components/nibras-logo';
import { getInitials } from '../../lib/utils';
import { prefs } from '../../lib/prefs';
import {
  getVisibleNavGroups,
  isNavItemActive,
  type AppNavItem,
  type ShellSessionUser,
} from './nav-config';

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
      <path d="M2.5 3.5h11v9h-11z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path
        d="M5 6h6M5 8.5h6M5 11h3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  Planner: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 2.5h10v11H3a1.5 1.5 0 01-1.5-1.5v-8A1.5 1.5 0 013 2.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M5 5.5h6M5 8h6M5 10.5h4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  Submissions: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 2.5h6l2 2V13a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 3 13V4a1.5 1.5 0 0 1 1-1.42Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M10 2.5V5h2.5M5.5 8h5M5.5 10.5h5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Courses: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5 8 2l5.5 2.5L8 7 2.5 4.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 6.7V10c0 .9 1.6 1.9 3.5 1.9s3.5-1 3.5-1.9V6.7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  Templates: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="8.5" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M5 6h3M5 8.5h3M5 11h2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M10.5 5H12a1.5 1.5 0 0 1 1.5 1.5V11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  'Team Projects': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="5" cy="6" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11" cy="5.5" r="1.7" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M2.5 12c.3-2 2-3.2 4-3.2s3.7 1.2 4 3.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M9.7 11.8c.18-1.48 1.3-2.35 2.8-2.35 1.03 0 1.94.39 2.5 1.14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  Programs: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M5.2 5.5h5.6M5.2 8h5.6M5.2 10.5h3.6"
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

function SidebarLink({
  item,
  collapsed,
  pathname,
  hash,
  onRequestClose,
}: {
  item: AppNavItem;
  collapsed: boolean;
  pathname: string;
  hash: string;
  onRequestClose?: () => void;
}) {
  const isActive = isNavItemActive(item, pathname, hash);

  return (
    <Link
      href={item.href}
      className={`navLink ${isActive ? 'navLinkActive navLinkAccentBorder' : ''}`}
      title={collapsed ? item.label : item.description}
      style={collapsed ? { justifyContent: 'center', padding: '9px 0' } : undefined}
      onClick={onRequestClose}
    >
      <span className="navIcon" aria-hidden="true">
        {NAV_ICONS[item.label] ?? '•'}
      </span>
      {!collapsed && <strong>{item.label}</strong>}
    </Link>
  );
}

export default function Sidebar({
  user,
  loading,
  mobile = false,
  onRequestClose,
}: {
  user: ShellSessionUser | null;
  loading: boolean;
  mobile?: boolean;
  onRequestClose?: () => void;
}) {
  const pathname = usePathname();
  const displayName = user?.username || user?.githubLogin || 'Nibras User';
  const [collapsed, setCollapsed] = useState(false);
  const [hash, setHash] = useState('');
  const groups = getVisibleNavGroups(user);

  useEffect(() => {
    if (mobile) return;
    if (prefs.getSidebarCollapsed()) setCollapsed(true);
  }, [mobile]);

  useEffect(() => {
    function updateHash() {
      setHash(window.location.hash);
    }

    updateHash();
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    prefs.setSidebarCollapsed(next);
  }

  return (
    <aside
      className={`sidebar ${mobile ? 'sidebarMobileOpen' : ''}`}
      style={{
        width: mobile ? 276 : collapsed ? 78 : 280,
        transition: 'width 0.2s ease',
        overflow: collapsed ? 'visible' : undefined,
      }}
    >
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
          <>
            <NibrasLogo variant="theme" width={120} priority />
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(74,222,128,0.92)',
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
          </>
        )}
      </div>

      {groups.map((group) => (
        <div key={group.id} style={{ display: 'grid', gap: 8 }}>
          {!collapsed && (
            <span
              className="sectionEyebrow"
              style={{ paddingLeft: 10, marginBottom: -2, fontSize: 10 }}
            >
              {group.label}
            </span>
          )}

          <nav className="sidebarNav" aria-label={group.label}>
            {group.items.map((item) => (
              <SidebarLink
                key={item.id}
                item={item}
                collapsed={collapsed}
                pathname={pathname}
                hash={hash}
                onRequestClose={onRequestClose}
              />
            ))}
          </nav>
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {!mobile && (
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
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--surface-strong)';
            event.currentTarget.style.color = 'var(--text-muted)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent';
            event.currentTarget.style.color = 'var(--text-soft)';
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon collapsed={collapsed} />
          {!collapsed && <span>Collapse</span>}
        </button>
      )}

      {!collapsed && (
        <div className="sidebarFooter">
          <div className="sidebarProfile">
            <span className="avatarCircle">{loading ? '…' : getInitials(displayName)}</span>
            <div>
              <strong>{loading ? 'Loading session' : displayName}</strong>
              <span>{user?.email || 'GitHub-linked account'}</span>
            </div>
          </div>
          <Link className="logoutLink" href="/" onClick={onRequestClose}>
            Sign out
          </Link>
        </div>
      )}

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
