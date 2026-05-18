'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

/**
 * Sign in to the legacy Nibras community backend (the one at
 * `nibras-backend.up.railway.app`) using email + password. The returned
 * `accessToken` is stored at `localStorage["nibras.webSession"]`, which is
 * the same key our `serviceFetch` reads for Community, Tutor, Achievements,
 * Competitions calls. After login the dashboard features that previously
 * 401'd start working immediately.
 *
 * This bypasses the Azure-hosted Nibras API's GitHub OAuth flow — the
 * Railway backend has its own user table (email + password + OTP) and
 * issues tokens only it trusts. There's no shared-secret path to make
 * Azure-issued tokens work against Railway, so we let the user opt into
 * Railway directly via the dashboard's existing credential mechanism.
 */
const RAILWAY_API_BASE = 'https://nibras-backend.up.railway.app/api';
const SESSION_KEY = 'nibras.webSession';

type LoginResponse = {
  // The backend returns one of these shapes; we try each in order.
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  data?: {
    token?: string;
    accessToken?: string;
    tokens?: { access?: { token?: string } };
    user?: { id?: string; username?: string; email?: string };
  };
  user?: { id?: string; username?: string; email?: string };
  message?: string;
};

function extractToken(payload: LoginResponse): string | null {
  return (
    payload.accessToken ||
    payload.token ||
    payload.data?.accessToken ||
    payload.data?.token ||
    payload.data?.tokens?.access?.token ||
    null
  );
}

export default function ConnectDashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyConnected, setAlreadyConnected] = useState(false);

  useEffect(() => {
    try {
      setAlreadyConnected(Boolean(window.localStorage.getItem(SESSION_KEY)));
    } catch {
      /* ignore */
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`${RAILWAY_API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const payload = (await response.json().catch(() => ({}))) as LoginResponse;
      if (!response.ok) {
        throw new Error(payload.message || `Login failed (HTTP ${response.status}).`);
      }
      const token = extractToken(payload);
      if (!token) {
        throw new Error('Login succeeded but no token was returned. Tell the backend admin.');
      }
      window.localStorage.setItem(SESSION_KEY, token);
      const user = payload.user || payload.data?.user;
      if (user) {
        window.localStorage.setItem('nibras.dashboardUser', JSON.stringify(user));
      }
      // Redirect to community as the immediate proof-of-life.
      router.push('/community');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  }

  function disconnect() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem('nibras.dashboardUser');
    } catch {
      /* ignore */
    }
    setAlreadyConnected(false);
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Connect dashboard backend</h1>
          <p className={styles.subtitle}>
            Sign in with the email and password you use on the legacy Nibras dashboard.
            This unlocks Community, Tutor, Achievements, and Competitions on this site.
          </p>
        </header>

        {alreadyConnected && (
          <div className={styles.notice}>
            You&apos;re already connected. <button type="button" onClick={disconnect}>Disconnect</button> if
            you want to sign in as a different account.
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.label}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.input}
              placeholder="you@example.com"
              disabled={submitting}
            />
          </label>
          <label className={styles.label}>
            <span>Password</span>
            <div className={styles.passwordRow}>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={styles.input}
                disabled={submitting}
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setShowPassword((value) => !value)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className={styles.submit}
            disabled={submitting || !email.trim() || !password}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <footer className={styles.footer}>
          <p>
            No account?{' '}
            <a
              href="https://nibras-backend.up.railway.app/api"
              target="_blank"
              rel="noopener noreferrer"
            >
              Register on the legacy dashboard
            </a>{' '}
            (email OTP verification required), then come back here.
          </p>
          <p>
            <Link href="/">← Back to Nibras sign-in (GitHub OAuth)</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
