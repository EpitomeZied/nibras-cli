"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "./theme-toggle";

type ShellSessionUser = {
  username: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
};

function getInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "NB";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || trimmed.slice(0, 2).toUpperCase();
}

const BREADCRUMBS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projects",
  "/instructor": "Instructor",
  "/admin": "Admin",
};

export default function TopHeader({
  user,
  loading
}: {
  user: ShellSessionUser | null;
  loading: boolean;
}) {
  const pathname = usePathname();
  const identity = user?.username || user?.githubLogin || "Nibras";
  const breadcrumb = BREADCRUMBS[pathname] ?? "Dashboard";

  return (
    <header className="topHeader">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-soft)" }}>Nibras</span>
        <span style={{ fontSize: 12, color: "var(--text-soft)" }}>/</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{breadcrumb}</span>
      </div>

      <div className="headerActions">
        <ThemeToggle />
        <div className="profileChip" aria-live="polite">
          <span className="profileCircle">{loading ? "…" : getInitials(identity)}</span>
          <div>
            <strong>{loading ? "Loading" : identity}</strong>
            <span>{user?.githubLinked ? "GitHub connected" : "Web session"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
