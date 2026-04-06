'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/session';
import styles from './page.module.css';

type SessionUser = {
  username: string;
  email: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
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

export default function SettingsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [compact, setCompact] = useState(false);
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [installUrlLoading, setInstallUrlLoading] = useState(false);

  useEffect(() => {
    setCompact(localStorage.getItem('nibras.compact') === 'true');

    void (async () => {
      try {
        const res = await apiFetch('/v1/web/session', { auth: true });
        if (res.ok) {
          const payload = (await res.json()) as { user: SessionUser };
          setUser(payload.user);

          // Fetch install URL regardless — so we always have it ready
          void fetchInstallUrl();
        }
      } finally {
        setLoading(false);
      }
    })();
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
      // GitHub App not configured on server — ignore silently
    } finally {
      setInstallUrlLoading(false);
    }
  }

  function handleCompactChange(val: boolean) {
    setCompact(val);
    localStorage.setItem('nibras.compact', String(val));
    window.dispatchEvent(new Event('nibras:compact-changed'));
  }

  const githubAvatarUrl =
    user?.githubLogin && user.githubLinked
      ? `https://avatars.githubusercontent.com/${user.githubLogin}?s=80`
      : null;

  const identity = user?.username || user?.githubLogin || '—';
  const appInstalled = user?.githubAppInstalled ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageSubtitle}>Manage your account and preferences</p>
      </div>

      <div className={styles.sections}>
        {/* ── Profile ── */}
        <section className={`${styles.section} surfaceCard`}>
          <h2 className={styles.sectionTitle}>Profile</h2>
          <div className={styles.profileRow}>
            {githubAvatarUrl ? (
              <Image
                src={githubAvatarUrl}
                alt={user?.githubLogin ?? 'avatar'}
                width={56}
                height={56}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarFallback}>
                {loading ? '…' : identity.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className={styles.profileInfo}>
              <strong className={styles.profileName}>{loading ? 'Loading…' : identity}</strong>
              <span className={styles.profileEmail}>{user?.email || '—'}</span>
              {user?.githubLogin && (
                <span className={styles.profileGitHub}>@{user.githubLogin}</span>
              )}
            </div>
          </div>
        </section>

        {/* ── Preferences ── */}
        <section className={`${styles.section} surfaceCard`}>
          <h2 className={styles.sectionTitle}>Preferences</h2>

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

        {/* ── Account ── */}
        <section className={`${styles.section} surfaceCard`}>
          <h2 className={styles.sectionTitle}>Account</h2>

          {/* GitHub OAuth connection */}
          <div className={styles.accountRow}>
            <div className={styles.prefInfo}>
              <span className={styles.prefLabel}>GitHub connection</span>
              <p className={styles.prefDesc}>
                {user?.githubLinked ? `Connected as @${user.githubLogin}` : 'Not connected'}
              </p>
            </div>
            <span
              className={styles.badge}
              style={{
                background: user?.githubLinked
                  ? 'rgba(52, 211, 153, 0.12)'
                  : 'rgba(248, 113, 113, 0.12)',
                color: user?.githubLinked ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {user?.githubLinked ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* GitHub App installation */}
          <div className={styles.appInstallRow}>
            <div className={styles.appInstallLeft}>
              <div className={styles.appInstallIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.138 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className={styles.prefInfo}>
                <span className={styles.prefLabel}>GitHub App</span>
                <p className={styles.prefDesc}>
                  {appInstalled === true
                    ? 'Installed — automatic submission tracking is active.'
                    : appInstalled === false
                      ? 'Not installed — install to enable automatic push tracking.'
                      : loading
                        ? 'Checking status…'
                        : 'Status unknown'}
                </p>
              </div>
            </div>

            <div className={styles.appInstallRight}>
              {appInstalled === true ? (
                <span
                  className={styles.badge}
                  style={{ background: 'rgba(52, 211, 153, 0.12)', color: 'var(--success)' }}
                >
                  ✓ Installed
                </span>
              ) : installUrlLoading ? (
                <span className={styles.badge} style={{ color: 'var(--text-muted)' }}>
                  Loading…
                </span>
              ) : installUrl ? (
                <a href={installUrl} className={styles.installAppBtn}>
                  Install GitHub App →
                </a>
              ) : (
                <span
                  className={styles.badge}
                  style={{ background: 'rgba(251, 191, 36, 0.12)', color: 'var(--warning)' }}
                >
                  Not configured
                </span>
              )}
            </div>
          </div>

          {/* Install banner if not installed and URL is available */}
          {appInstalled === false && installUrl && (
            <div className={styles.installCallout}>
              <span className={styles.installCalloutIcon}>🔗</span>
              <div>
                <strong>Connect the GitHub App</strong>
                <p>
                  Install the Nibras GitHub App on your repositories to enable automatic submission
                  tracking when you push commits.
                </p>
              </div>
              <a href={installUrl} className={styles.installCalloutBtn}>
                Install now →
              </a>
            </div>
          )}

          <div className={styles.signOutRow}>
            <Link href="/" className={styles.signOutBtn}>
              Sign out
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
