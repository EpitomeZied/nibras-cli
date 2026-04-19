'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/session';
import { prefs } from '../../lib/prefs';
import { SessionProvider } from './session-context';
import TopHeader from './top-header';
import styles from './app-shell.module.css';

type ShellSessionPayload = {
  user: {
    username: string;
    email: string;
    githubLogin: string;
    githubLinked: boolean;
    githubAppInstalled: boolean;
    systemRole?: string;
    yearLevel?: number;
  };
  memberships?: Array<{ courseId: string; role: string; level: number }>;
};

type ShellUser = ShellSessionPayload['user'] & {
  memberships?: ShellSessionPayload['memberships'];
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ShellUser | null>(null);
  const [loading, setLoading] = useState(true);
  const shellRef = useRef<HTMLDivElement>(null);

  // Apply compact mode from localStorage and listen for changes
  useEffect(() => {
    function applyCompact() {
      const compact = prefs.getCompact();
      shellRef.current?.setAttribute('data-compact', String(compact));
    }

    applyCompact();

    function onCompactChanged() {
      applyCompact();
    }

    window.addEventListener('nibras:compact-changed', onCompactChanged);
    return () => window.removeEventListener('nibras:compact-changed', onCompactChanged);
  }, []);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const response = await apiFetch('/v1/web/session', { auth: true });
        if (!response.ok) {
          if (alive) {
            window.location.href = '/?auth=required';
          }
          return;
        }
        const payload = (await response.json()) as ShellSessionPayload;
        if (alive) {
          setSession({ ...payload.user, memberships: payload.memberships ?? [] });
        }
      } catch {
        if (alive) {
          window.location.href = '/?auth=required';
        }
        return;
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <SessionProvider value={{ user: session, loading }}>
      <div ref={shellRef} className={styles.appShell}>
        <div className={styles.mainArea}>
          <TopHeader user={session} loading={loading} />
          <div className={styles.pageBody}>
            <div className={styles.pageInner}>{children}</div>
          </div>
        </div>
      </div>
    </SessionProvider>
  );
}
