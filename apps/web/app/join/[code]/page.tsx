'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { apiFetch, discoverApiBaseUrl } from '../../lib/session';
import { useFormSubmit } from '../../lib/use-form-submit';
import styles from './page.module.css';

type InvitePreview = {
  code: string;
  courseTitle: string;
  courseCode: string;
  termLabel: string;
  role: string;
  expiresAt: string | null;
};

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [dotsPhase, setDotsPhase] = useState(0);

  const {
    submitting: joining,
    error: joinError,
    submit: joinSubmit,
  } = useFormSubmit({
    url: `/v1/tracking/invites/${code}/join`,
    onSuccess: () => router.push('/projects'),
  });

  // Animate loading dots while invite is fetching
  useEffect(() => {
    if (!loadingInvite) return;
    const id = setInterval(() => setDotsPhase((p) => (p + 1) % 4), 400);
    return () => clearInterval(id);
  }, [loadingInvite]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch(`/v1/tracking/invites/${code}`);
        if (res.status === 404 || res.status === 410) {
          const body = (await res.json()) as { error?: string };
          setInviteError(body.error || 'Invalid or expired invite.');
          return;
        }
        if (!res.ok) throw new Error('Failed to load invite.');
        setInvite((await res.json()) as InvitePreview);
      } catch {
        setInviteError('Unable to load this invite. Check your connection and try again.');
      } finally {
        setLoadingInvite(false);
      }
    })();

    void (async () => {
      try {
        const res = await apiFetch('/v1/web/session', { auth: true });
        setIsAuthenticated(res.ok);
      } catch {
        setIsAuthenticated(false);
      }
    })();
  }, [code]);

  async function handleSignIn() {
    try {
      const apiBaseUrl = await discoverApiBaseUrl();
      const returnTo = `${window.location.href}`;
      window.location.href = `${apiBaseUrl}/v1/github/oauth/start?return_to=${encodeURIComponent(returnTo)}`;
    } catch {
      setSignInError('Could not initiate sign-in. Please try again.');
    }
  }

  async function handleJoin() {
    await joinSubmit({});
  }

  const dots = ['', '.', '..', '...'][dotsPhase];

  const expiryLabel = invite?.expiresAt
    ? new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  function formatRole(role: string) {
    if (role === 'ta') return 'TA';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  return (
    <main className={styles.page}>
      <div className={styles.window}>
        {/* Title bar */}
        <div className={styles.titleBar}>
          <span className={styles.dot} style={{ background: '#ff5f57' }} />
          <span className={styles.dot} style={{ background: '#febc2e' }} />
          <span className={styles.dot} style={{ background: '#28c840' }} />
          <span className={styles.title}>nibras — zsh</span>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Command line */}
          <div className={styles.blank} />
          <div className={styles.line}>
            <span className={styles.prompt}>❯</span>
            <span className={styles.cmd}>nibras join {code}</span>
          </div>
          <div className={styles.blank} />

          {/* ── Loading state ── */}
          {loadingInvite && (
            <>
              <div className={styles.output}>Resolving invite{dots}</div>
              <div className={styles.blank} />
              <span className={styles.cursor} />
            </>
          )}

          {/* ── Error state ── */}
          {!loadingInvite && inviteError && (
            <>
              <div className={styles.error}>✗ {inviteError}</div>
              <div className={styles.blank} />
              <div className={styles.line}>
                <span className={styles.prompt}>❯</span>
                <span className={styles.cursor} style={{ marginLeft: 0 }} />
              </div>
            </>
          )}

          {/* ── Invite loaded ── */}
          {!loadingInvite && !inviteError && invite && (
            <>
              {/* Course info rows */}
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Course</span>
                <span className={styles.infoValue}>{invite.courseTitle}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Code</span>
                <span className={styles.infoValue}>
                  {invite.courseCode} · {invite.termLabel}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Role</span>
                <span className={styles.infoValueGreen}>{formatRole(invite.role)}</span>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Expires</span>
                <span className={styles.infoValue}>{expiryLabel}</span>
              </div>
              <div className={styles.blank} />

              {/* Auth prompt for unauthenticated users */}
              {!isAuthenticated && (
                <>
                  <div className={styles.output}>Authentication required.</div>
                  <div className={styles.muted}>Sign in with GitHub to continue.</div>
                  <div className={styles.blank} />
                </>
              )}

              {/* Second prompt + cursor */}
              <div className={styles.line}>
                <span className={styles.prompt}>❯</span>
                <span className={styles.cursor} style={{ marginLeft: 0 }} />
              </div>

              {/* Action button */}
              <div className={styles.actionRow}>
                {isAuthenticated ? (
                  <button
                    className={styles.btn}
                    onClick={() => void handleJoin()}
                    disabled={joining}
                  >
                    {joining ? 'Joining…' : `Join as ${formatRole(invite.role)}`}
                    {!joining && <span style={{ opacity: 0.4 }}>↵</span>}
                  </button>
                ) : (
                  <button
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={() => void handleSignIn()}
                  >
                    Sign in with GitHub
                    <span style={{ opacity: 0.4 }}>↵</span>
                  </button>
                )}

                {(joinError || signInError) && (
                  <span className={styles.actionError}>{joinError ?? signInError}</span>
                )}
                <span className={styles.enterHint}>press Enter to confirm</span>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
