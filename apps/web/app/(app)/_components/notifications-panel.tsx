'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/session';

type ShellSessionUser = {
  username: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
};

type Notification = {
  id: string;
  type: 'deadline' | 'overdue' | 'review' | 'github';
  title: string;
  body: string;
  color: string;
};

type Milestone = {
  id: string;
  title: string;
  dueAt: string | null;
  status: string;
};

type DashboardPayload = {
  milestonesByProject?: Record<string, Milestone[]>;
};

function deriveNotifications(
  dashboard: DashboardPayload,
  user: ShellSessionUser | null
): Notification[] {
  const notifications: Notification[] = [];
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (user && !user.githubAppInstalled) {
    notifications.push({
      id: 'github-install',
      type: 'github',
      title: 'GitHub App not installed',
      body: 'Install the GitHub App to enable repo provisioning and submissions.',
      color: '#f59e0b',
    });
  }

  const allMilestones = Object.values(dashboard.milestonesByProject ?? {}).flat();

  for (const m of allMilestones) {
    if (m.status === 'needs_review') {
      notifications.push({
        id: `review-${m.id}`,
        type: 'review',
        title: 'Needs review',
        body: m.title,
        color: '#3b82f6',
      });
    } else if (m.dueAt) {
      const due = new Date(m.dueAt).getTime();
      if (due < now && m.status !== 'passed' && m.status !== 'approved') {
        notifications.push({
          id: `overdue-${m.id}`,
          type: 'overdue',
          title: 'Overdue',
          body: `${m.title} was due ${new Date(m.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          color: '#f87171',
        });
      } else if (
        due - now <= sevenDays &&
        due > now &&
        m.status !== 'passed' &&
        m.status !== 'approved'
      ) {
        notifications.push({
          id: `deadline-${m.id}`,
          type: 'deadline',
          title: 'Upcoming deadline',
          body: `${m.title} due ${new Date(m.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          color: '#fbbf24',
        });
      }
    }
  }

  return notifications;
}

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

export default function NotificationsPanel({ user }: { user: ShellSessionUser | null }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fetch notifications on first open
  useEffect(() => {
    if (!open || loaded) return;

    void (async () => {
      try {
        const res = await apiFetch('/v1/tracking/dashboard/student', { auth: true });
        if (!res.ok) return;
        const payload = (await res.json()) as DashboardPayload;
        setNotifications(deriveNotifications(payload, user));
      } catch {
        // silently fail
      } finally {
        setLoaded(true);
      }
    })();
  }, [open, loaded, user]);

  const count = notifications.length;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        className="iconButton"
        aria-label="Notifications"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative' }}
      >
        <BellIcon />
        {count > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--danger)',
              border: '2px solid var(--sidebar-bg)',
              display: 'block',
            }}
          />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <strong style={{ fontSize: 13, color: 'var(--text)' }}>Notifications</strong>
            {count > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'var(--danger)',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '2px 7px',
                }}
              >
                {count}
              </span>
            )}
          </div>

          {/* Items */}
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {!loaded ? (
              <div
                style={{
                  padding: '20px 16px',
                  color: 'var(--text-soft)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                Loading…
              </div>
            ) : count === 0 ? (
              <div
                style={{
                  padding: '28px 16px',
                  color: 'var(--text-soft)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                All caught up 🎉
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '11px 16px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: n.color,
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: n.color,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 2,
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.body}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
