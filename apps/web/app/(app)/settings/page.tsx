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

  useEffect(() => {
    setCompact(localStorage.getItem('nibras.compact') === 'true');

    void (async () => {
      try {
        const res = await apiFetch('/v1/web/session', { auth: true });
        if (res.ok) {
          const payload = (await res.json()) as { user: SessionUser };
          setUser(payload.user);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

          {user?.githubAppInstalled === false && (
            <div className={styles.accountRow} style={{ marginTop: 12 }}>
              <div className={styles.prefInfo}>
                <span className={styles.prefLabel}>GitHub App</span>
                <p className={styles.prefDesc}>Install the GitHub App to enable repo access</p>
              </div>
              <span
                className={styles.badge}
                style={{ background: 'rgba(251, 191, 36, 0.12)', color: 'var(--warning)' }}
              >
                Not installed
              </span>
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
