'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/session';
import styles from './page.module.css';

type LogLine = { text: string; type: 'cmd' | 'info' | 'success' | 'error' | 'muted' };

export default function AuthCompletePage() {
  const [lines, setLines] = useState<LogLine[]>([
    { text: 'nibras auth --provider github', type: 'cmd' },
    { text: 'Verifying session…', type: 'info' },
  ]);
  const [done, setDone] = useState(false);

  function addLine(line: LogLine) {
    setLines((prev) => [...prev, line]);
  }

  useEffect(() => {
    void (async () => {
      try {
        // Read the session token from the ?st= redirect param — provided by the
        // API for browsers that block cross-domain cookies (Chrome 3P restrictions).
        const st = new URLSearchParams(window.location.search).get('st');

        const response = await apiFetch('/v1/web/session', {
          auth: true,
          // Pass token explicitly as accessToken so apiFetchWith sends it as
          // Authorization: Bearer — bypasses cross-domain cookie restrictions.
          ...(st ? { accessToken: st } : {}),
        });
        if (!response.ok) {
          throw new Error('Web session was not established.');
        }

        // Persist the web session token in localStorage so subsequent apiFetch
        // calls can include it as a bearer token without relying on cookies.
        if (st) {
          window.localStorage.setItem('nibras.webSession', st);
        }

        addLine({ text: '✓ Session established', type: 'success' });
        addLine({ text: 'Redirecting to dashboard…', type: 'muted' });
        setDone(true);
        window.setTimeout(() => {
          window.location.href = '/dashboard';
        }, 900);
      } catch (err) {
        addLine({
          text: `✗ ${err instanceof Error ? err.message : String(err)}`,
          type: 'error',
        });
      }
    })();
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.window}>
        <div className={styles.titleBar}>
          <span className={styles.dot} style={{ background: '#ff5f57' }} />
          <span className={styles.dot} style={{ background: '#febc2e' }} />
          <span className={styles.dot} style={{ background: '#28c840' }} />
          <span className={styles.title}>nibras — terminal</span>
        </div>
        <div className={styles.body}>
          {lines.map((line, i) => (
            <div key={i} className={`${styles.line} ${styles[line.type]}`}>
              {line.type === 'cmd' && <span className={styles.prompt}>~ </span>}
              {line.text}
            </div>
          ))}
          {!done && <span className={styles.cursor} />}
        </div>
      </div>
    </main>
  );
}
