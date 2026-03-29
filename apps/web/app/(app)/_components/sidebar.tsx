"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNavItems } from "./nav-config";

type ShellSessionUser = {
  username: string;
  email: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  systemRole?: string;
};

function initials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "NB";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || trimmed.slice(0, 2).toUpperCase();
}

const NAV_ICONS: Record<string, React.ReactNode> = {
  Dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9"/>
    </svg>
  ),
  Projects: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5 8h6M5 5.5h6M5 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Instructor: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Admin: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2L9.5 6h4l-3.25 2.36 1.25 3.85L8 10l-3.5 2.21 1.25-3.85L2.5 6h4L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),
};

export default function Sidebar({
  user,
  loading
}: {
  user: ShellSessionUser | null;
  loading: boolean;
}) {
  const pathname = usePathname();
  const displayName = user?.username || user?.githubLogin || "Nibras User";

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="brandBlock">
        <Image
          src="/branding/nibras-icon.svg"
          alt="Nibras icon"
          width={32}
          height={32}
          priority
        />
        <div>
          <strong className="brandTitle">Nibras</strong>
          <p className="brandSubtitle">Developer Platform</p>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="sidebarNav" aria-label="Primary">
        {appNavItems
          .filter((item) => item.label !== "Admin" || user?.systemRole === "admin")
          .map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navLink ${isActive ? "navLinkActive" : ""}`}
              >
                <span className="navIcon" aria-hidden="true">
                  {NAV_ICONS[item.label] ?? "•"}
                </span>
                <strong>{item.label}</strong>
              </Link>
            );
          })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom links */}
      <nav className="sidebarNav" aria-label="Secondary">
        <Link
          href="/dashboard"
          className={`navLink ${pathname === "/dashboard" ? "" : ""}`}
        >
          <span className="navIcon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </span>
          <strong>Settings</strong>
        </Link>
      </nav>

      {/* Profile footer */}
      <div className="sidebarFooter">
        <div className="sidebarProfile">
          <span className="avatarCircle">{loading ? "…" : initials(displayName)}</span>
          <div>
            <strong>{loading ? "Loading session" : displayName}</strong>
            <span>{user?.email || "GitHub-linked account"}</span>
          </div>
        </div>
        <Link className="logoutLink" href="/">Sign out</Link>
      </div>
    </aside>
  );
}
