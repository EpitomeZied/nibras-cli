"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NibrasLogo from "../../_components/nibras-logo";
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

function navGlyph(label: string): string {
  if (label === "Dashboard") return "◫";
  if (label === "Projects") return "▣";
  if (label === "Instructor") return "⊞";
  if (label === "Admin") return "⬡";
  return "•";
}

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
      <div className="brandBlock">
        <div>
          <NibrasLogo variant="theme" width={138} priority />
          <p className="brandSubtitle">Hosted course operations</p>
        </div>
      </div>

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
                <span className="navIcon" aria-hidden="true">{navGlyph(item.label)}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            );
          })}
      </nav>

      <div className="sidebarStatusCard">
        <span className="sectionEyebrow">Hosted Status</span>
        <ul className="statusList">
          <li>
            <span>GitHub linked</span>
            <strong>{user?.githubLinked ? "Yes" : loading ? "Checking" : "No"}</strong>
          </li>
          <li>
            <span>App installed</span>
            <strong>{user?.githubAppInstalled ? "Yes" : loading ? "Checking" : "No"}</strong>
          </li>
        </ul>
      </div>

      <div className="sidebarFooter">
        <div className="sidebarProfile">
          <span className="avatarCircle">{loading ? "…" : initials(displayName)}</span>
          <div>
            <strong>{loading ? "Loading session" : displayName}</strong>
            <span>{user?.email || "GitHub-linked account"}</span>
          </div>
        </div>
        <Link className="logoutLink" href="/">Return to sign-in</Link>
      </div>
    </aside>
  );
}
