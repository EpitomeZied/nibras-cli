'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/session';
import { prefs } from '../../lib/prefs';
import { useSession } from '../_components/session-context';
import { getLevelLabel, MAX_LEVEL } from '../../lib/levels';
import styles from './page.module.css';

type Tab = 'profile' | 'github' | 'preferences' | 'danger' | 'admin';

type Course = {
  id: string;
  title: string;
  courseCode: string;
};

type Member = {
  id: string;
  userId: string;
  username: string;
  githubLogin: string | null;
  role: string;
  level: number | null;
};

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

/* ── Icons ───────────────────────────────────────────────────────────────── */

function IconUser() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconGitHub() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.138 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l7 4v5c0 5-3.5 9.74-7 11-3.5-1.26-7-6-7-11V6l7-4z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  );
}

function IconGoogle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/* ── Nav item list ───────────────────────────────────────────────────────── */

type NavItem = { id: Tab; label: string; icon: React.ReactNode; danger?: boolean };

const BASE_NAV_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: <IconUser /> },
  { id: 'github', label: 'GitHub App', icon: <IconGitHub /> },
  { id: 'preferences', label: 'Preferences', icon: <IconSliders /> },
  { id: 'danger', label: 'Danger Zone', icon: <IconShield />, danger: true },
];

/* ── Admin Year Tab ──────────────────────────────────────────────────────── */

function AdminYearTab() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [pendingLevels, setPendingLevels] = useState<Record<string, number>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      void fetchMembers(selectedCourseId);
    } else {
      setMembers([]);
    }
  }, [selectedCourseId]);

  async function fetchCourses() {
    try {
      const res = await apiFetch('/v1/tracking/courses', { auth: true });
      if (res.ok) {
        setCourses((await res.json()) as Course[]);
      }
    } catch {
      // ignore
    }
  }

  async function fetchMembers(courseId: string) {
    setMembersLoading(true);
    setMembers([]);
    setPendingLevels({});
    setRowStatus({});
    try {
      const res = await apiFetch(`/v1/tracking/courses/${courseId}/members`, { auth: true });
      if (res.ok) {
        setMembers((await res.json()) as Member[]);
      }
    } catch {
      // ignore
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleUpdate(userId: string) {
    const level = pendingLevels[userId];
    if (level === undefined) return;
    setUpdatingId(userId);
    try {
      const res = await apiFetch(
        `/v1/tracking/courses/${selectedCourseId}/members/${userId}/level`,
        {
          method: 'PATCH',
          auth: true,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ level }),
        }
      );
      setRowStatus((prev) => ({ ...prev, [userId]: res.ok ? 'ok' : 'err' }));
      if (res.ok) {
        setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, level } : m)));
      }
    } catch {
      setRowStatus((prev) => ({ ...prev, [userId]: 'err' }));
    } finally {
      setUpdatingId(null);
    }
  }

  const students = members.filter((m) => m.role === 'student');

  return (
    <section className={styles.contentSection}>
      <h2 className={styles.sectionHeading}>Student Year Management</h2>
      <p className={styles.sectionSub}>
        Set academic year level for any student across any course. Students cannot change their own
        year.
      </p>

      <select
        className={styles.yearSelect}
        value={selectedCourseId}
        onChange={(e) => setSelectedCourseId(e.target.value)}
      >
        <option value="">— Select a course —</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            [{c.courseCode}] {c.title}
          </option>
        ))}
      </select>

      {membersLoading && (
        <p className={styles.sectionSub} style={{ marginTop: 16 }}>
          Loading members…
        </p>
      )}

      {!membersLoading && students.length > 0 && (
        <table className={styles.adminTable}>
          <thead>
            <tr>
              <th>Student</th>
              <th>Current Year</th>
              <th>Set Year</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((m) => {
              const currentLevel = m.level ?? 1;
              const pendingLevel = pendingLevels[m.userId] ?? currentLevel;
              const isDirty = pendingLevel !== currentLevel;
              return (
                <tr key={m.userId}>
                  <td>{m.githubLogin ?? m.username}</td>
                  <td>
                    <span className={styles.levelBadge}>{getLevelLabel(currentLevel)}</span>
                  </td>
                  <td>
                    <select
                      className={styles.yearSelect}
                      value={pendingLevel}
                      onChange={(e) =>
                        setPendingLevels((prev) => ({
                          ...prev,
                          [m.userId]: Number(e.target.value),
                        }))
                      }
                    >
                      {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {getLevelLabel(lvl)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className={styles.adminUpdateBtn}
                      onClick={() => void handleUpdate(m.userId)}
                      disabled={updatingId === m.userId || !isDirty}
                    >
                      {updatingId === m.userId ? 'Saving…' : 'Set Year'}
                    </button>
                    {rowStatus[m.userId] === 'ok' && <span className={styles.adminOk}>✓</span>}
                    {rowStatus[m.userId] === 'err' && <span className={styles.adminErr}>✗</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {selectedCourseId && !membersLoading && students.length === 0 && (
        <p className={styles.sectionSub} style={{ marginTop: 16 }}>
          No students enrolled in this course.
        </p>
      )}
    </section>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const { user, loading: sessionLoading } = useSession();

  const isAdmin = user?.systemRole === 'admin';

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [compact, setCompact] = useState(false);
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [installUrlLoading, setInstallUrlLoading] = useState(false);
  const [manualInstallId, setManualInstallId] = useState('');
  const [manualInstallStatus, setManualInstallStatus] = useState('');
  const [manualInstallSubmitting, setManualInstallSubmitting] = useState(false);

  useEffect(() => {
    setCompact(prefs.getCompact());
    void fetchInstallUrl();
  }, []);

  async function fetchInstallUrl() {
    setInstallUrlLoading(true);
    try {
      const res = await apiFetch('/v1/github/install-url', { auth: true });
      if (res.ok) {
        const data = (await res.json()) as { installUrl?: string };
        setInstallUrl(data.installUrl ?? null);
      }
    } catch {
      // GitHub App not configured — ignore
    } finally {
      setInstallUrlLoading(false);
    }
  }

  async function handleManualInstall(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = manualInstallId.trim();
    if (!id) return;
    setManualInstallSubmitting(true);
    setManualInstallStatus('');
    try {
      const res = await apiFetch('/v1/github/setup/complete', {
        method: 'POST',
        auth: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ installationId: id }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        setManualInstallStatus(err.message ?? `Error ${res.status}`);
        return;
      }
      const payload = (await res.json()) as { installationId: string };
      setManualInstallStatus(`✓ Installation ${payload.installationId} linked successfully.`);
      setManualInstallId('');
    } catch (err) {
      setManualInstallStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setManualInstallSubmitting(false);
    }
  }

  function handleCompactChange(val: boolean) {
    setCompact(val);
    prefs.setCompact(val);
    window.dispatchEvent(new Event('nibras:compact-changed'));
  }

  const identity = user?.username || user?.githubLogin || '—';
  const githubAvatarUrl =
    user?.githubLogin && user.githubLinked
      ? `https://avatars.githubusercontent.com/${user.githubLogin}?s=80`
      : null;
  const appInstalled = user?.githubAppInstalled ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.settingsTitle}>Settings</h1>
        <p className={styles.settingsSubtitle}>Manage your account and preferences.</p>
      </div>

      <div className={styles.settingsWrap}>
        {/* ── Left nav ── */}
        <nav className={styles.settingsNav} aria-label="Settings sections">
          {[
            ...BASE_NAV_ITEMS,
            ...(isAdmin
              ? [{ id: 'admin' as Tab, label: 'Admin', icon: <IconAdmin /> } as NavItem]
              : []),
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={[
                  styles.settingsNavItem,
                  isActive ? styles.settingsNavItemActive : '',
                  item.danger ? styles.settingsNavItemDanger : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* ── Right content ── */}
        <div className={styles.settingsContent}>
          {/* ── Profile tab ── */}
          {activeTab === 'profile' && (
            <>
              {/* Avatar + identity */}
              <section className={styles.contentSection}>
                <h2 className={styles.sectionHeading}>Profile</h2>
                <p className={styles.sectionSub}>Your public identity on Nibras.</p>

                <div className={styles.avatarRow}>
                  {githubAvatarUrl ? (
                    <Image
                      src={githubAvatarUrl}
                      alt={user?.githubLogin ?? 'avatar'}
                      width={72}
                      height={72}
                      className={styles.avatarImg}
                    />
                  ) : (
                    <div className={styles.avatarFallback}>
                      {sessionLoading ? '…' : identity.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.avatarInfo}>
                    <span className={styles.avatarName}>
                      {sessionLoading ? 'Loading…' : identity}
                    </span>
                    <span className={styles.avatarEmail}>{user?.email || '—'}</span>
                  </div>
                </div>

                <div className={styles.formFields}>
                  <div className={styles.formField}>
                    <label htmlFor="display-name" className={styles.formLabel}>
                      Display name
                    </label>
                    <input
                      id="display-name"
                      className={styles.formInput}
                      type="text"
                      defaultValue={sessionLoading ? '' : identity}
                      disabled
                    />
                  </div>
                  <div className={styles.formField}>
                    <label htmlFor="email" className={styles.formLabel}>
                      Email address
                    </label>
                    <input
                      id="email"
                      className={styles.formInput}
                      type="email"
                      value={user?.email || ''}
                      readOnly
                      disabled
                    />
                  </div>
                </div>
              </section>

              {/* Connected accounts */}
              <section className={styles.contentSection}>
                <h2 className={styles.sectionHeading}>Connected accounts</h2>
                <p className={styles.sectionSub}>
                  Manage the external accounts linked to your Nibras profile.
                </p>

                <div className={styles.connectedList}>
                  {/* GitHub */}
                  <div className={styles.connectedRow}>
                    <span className={styles.connectedIcon}>
                      <IconGitHub />
                    </span>
                    <span className={styles.connectedName}>GitHub</span>
                    {user?.githubLinked ? (
                      <span className={styles.connectedBadgeGreen}>Connected</span>
                    ) : (
                      <span className={styles.connectedBadgeGray}>Not connected</span>
                    )}
                    <button className={styles.connectedBtn} disabled>
                      Manage
                    </button>
                  </div>

                  {/* Google — coming soon */}
                  <div className={styles.connectedRow}>
                    <span className={styles.connectedIcon}>
                      <IconGoogle />
                    </span>
                    <span className={styles.connectedName}>Google</span>
                    <span className={styles.connectedBadgeGray}>Coming soon</span>
                    <button className={styles.connectedBtn} disabled>
                      Connect
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── GitHub tab ── */}
          {activeTab === 'github' && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionHeading}>GitHub App</h2>
              <p className={styles.sectionSub}>
                Install the Nibras GitHub App to enable automatic submission tracking when you push
                commits.
              </p>

              {/* App status card */}
              <div className={styles.githubAppCard}>
                <div className={styles.githubAppIcon}>
                  <IconGitHub />
                </div>
                <div className={styles.githubAppInfo}>
                  <span className={styles.githubAppLabel}>Nibras GitHub App</span>
                  <p className={styles.githubAppDesc}>
                    {appInstalled === true
                      ? 'Installed — automatic push tracking is active.'
                      : appInstalled === false
                        ? 'Not installed — install to enable automatic push tracking.'
                        : sessionLoading
                          ? 'Checking status…'
                          : 'Status unknown'}
                  </p>
                </div>

                {appInstalled === true ? (
                  <span
                    className={styles.badge}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#4ade80',
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 999,
                      padding: '3px 12px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✓ Installed
                  </span>
                ) : installUrlLoading ? (
                  <span
                    style={{ fontSize: 12, color: 'rgba(161,161,170,0.5)', whiteSpace: 'nowrap' }}
                  >
                    Loading…
                  </span>
                ) : installUrl ? (
                  <a href={installUrl} className={styles.installBtn}>
                    Install →
                  </a>
                ) : (
                  <span
                    style={{ fontSize: 12, color: 'rgba(161,161,170,0.5)', whiteSpace: 'nowrap' }}
                  >
                    Not configured
                  </span>
                )}
              </div>

              {/* Manual install form */}
              {appInstalled === false && (
                <div className={styles.manualInstall}>
                  <p className={styles.manualInstallLabel}>
                    Already installed? Enter your installation ID:
                  </p>
                  <form className={styles.manualInstallForm} onSubmit={handleManualInstall}>
                    <input
                      className={styles.manualInstallInput}
                      type="text"
                      placeholder="e.g. 119576492"
                      value={manualInstallId}
                      onChange={(e) => setManualInstallId(e.target.value)}
                      disabled={manualInstallSubmitting}
                    />
                    <button
                      className={styles.manualInstallBtn}
                      type="submit"
                      disabled={manualInstallSubmitting || !manualInstallId.trim()}
                    >
                      {manualInstallSubmitting ? 'Linking…' : 'Link'}
                    </button>
                  </form>
                  {manualInstallStatus && (
                    <p
                      className={styles.manualInstallStatus}
                      style={{
                        color: manualInstallStatus.startsWith('✓') ? '#4ade80' : '#f87171',
                      }}
                    >
                      {manualInstallStatus}
                    </p>
                  )}
                  <p className={styles.manualInstallHint}>
                    Find your ID at{' '}
                    <a
                      href="https://github.com/settings/installations"
                      target="_blank"
                      rel="noreferrer"
                      className={styles.manualInstallLink}
                    >
                      github.com/settings/installations
                    </a>{' '}
                    — it&apos;s the number in the URL when you click your installation.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ── Preferences tab ── */}
          {activeTab === 'preferences' && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionHeading}>Preferences</h2>
              <p className={styles.sectionSub}>Customise how Nibras looks and feels for you.</p>

              <div className={styles.prefRow}>
                <div className={styles.prefInfo}>
                  <label htmlFor="compact-toggle" className={styles.prefLabel}>
                    Compact mode
                  </label>
                  <p className={styles.prefDesc}>Reduce spacing for a denser layout</p>
                </div>
                <Toggle id="compact-toggle" checked={compact} onChange={handleCompactChange} />
              </div>
            </section>
          )}

          {/* ── Admin tab ── */}
          {activeTab === 'admin' && isAdmin && <AdminYearTab />}

          {/* ── Danger Zone tab ── */}
          {activeTab === 'danger' && (
            <section className={styles.contentSection}>
              <h2 className={styles.dangerHeading}>Danger Zone</h2>
              <p className={styles.dangerDesc}>
                These actions are irreversible. Please proceed with caution.
              </p>

              <Link href="/" className={styles.signOutBtn}>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out of Nibras
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
