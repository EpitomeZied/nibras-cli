'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../_components/widgets/EmptyState';
import {
  getLinkedAccounts,
  linkAccount,
  listContests,
  setContestBookmark,
  setContestReminder,
  type Contest,
  type LinkedAccount,
} from '../../lib/services/competitions';
import { friendlyMessage } from '../../lib/api-clients/errors';

function formatRange(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const sameDay = s.toDateString() === e.toDateString();
    const dateFmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const timeFmt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
    if (sameDay) {
      return `${s.toLocaleDateString(undefined, dateFmt)} · ${s.toLocaleTimeString(undefined, timeFmt)} – ${e.toLocaleTimeString(undefined, timeFmt)}`;
    }
    return `${s.toLocaleDateString(undefined, dateFmt)} → ${e.toLocaleDateString(undefined, dateFmt)}`;
  } catch {
    return start;
  }
}

export default function CompetitionsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState(false);
  const [linkHost, setLinkHost] = useState<'codeforces' | 'leetcode' | 'atcoder'>('codeforces');
  const [linkHandle, setLinkHandle] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, a] = await Promise.allSettled([listContests({ upcoming: true }), getLinkedAccounts()]);
      setContests(c.status === 'fulfilled' ? c.value : []);
      setAccounts(a.status === 'fulfilled' ? a.value : []);
      if (c.status === 'rejected') setError(friendlyMessage(c.reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleReminder(contest: Contest) {
    const next = !contest.reminderSet;
    setContests((prev) =>
      prev.map((c) => (c.id === contest.id ? { ...c, reminderSet: next } : c))
    );
    try {
      const result = await setContestReminder(contest.id, next);
      setContests((prev) =>
        prev.map((c) => (c.id === contest.id ? { ...c, reminderSet: result.reminderSet } : c))
      );
    } catch {
      setContests((prev) =>
        prev.map((c) => (c.id === contest.id ? { ...c, reminderSet: !next } : c))
      );
    }
  }

  async function toggleBookmark(contest: Contest) {
    const next = !contest.bookmarked;
    setContests((prev) =>
      prev.map((c) => (c.id === contest.id ? { ...c, bookmarked: next } : c))
    );
    try {
      const result = await setContestBookmark(contest.id, next);
      setContests((prev) =>
        prev.map((c) => (c.id === contest.id ? { ...c, bookmarked: result.bookmarked } : c))
      );
    } catch {
      setContests((prev) =>
        prev.map((c) => (c.id === contest.id ? { ...c, bookmarked: !next } : c))
      );
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Competitions</h1>
          <p className={styles.subtitle}>
            Upcoming contests, linked accounts, and quick access to your competitive history.
          </p>
        </div>
        <button type="button" className={styles.linkBtn} onClick={() => setLinkModal(true)}>
          Link account
        </button>
      </header>

      {accounts.length > 0 && (
        <div className={styles.linkedAccountsRow}>
          {accounts.map((acc) => (
            <span key={`${acc.host}-${acc.handle}`} className={styles.linkedChip}>
              {acc.host}: <span className={styles.linkedChipHandle}>{acc.handle}</span>
              {!acc.verified && <span style={{ fontSize: 10, color: 'var(--warning, #f59e0b)' }}>unverified</span>}
            </span>
          ))}
        </div>
      )}

      {linkModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Link account">
          <form
            className={styles.modal}
            onSubmit={async (event) => {
              event.preventDefault();
              if (!linkHandle.trim()) return;
              setLinkSubmitting(true);
              setLinkError(null);
              try {
                const created = await linkAccount({ host: linkHost, handle: linkHandle.trim() });
                setAccounts((prev) => [...prev.filter((a) => a.host !== created.host), created]);
                setLinkHandle('');
                setLinkModal(false);
              } catch (err) {
                setLinkError(friendlyMessage(err));
              } finally {
                setLinkSubmitting(false);
              }
            }}
          >
            <h2 className={styles.modalTitle}>Link a competitive account</h2>
            <p className={styles.modalHint}>
              We&apos;ll fetch contest history, problems, and ratings for the linked account.
              Verification may take a moment.
            </p>
            <div className={styles.formRow}>
              <label className={styles.formLabel} htmlFor="link-host">
                Platform
              </label>
              <select
                id="link-host"
                className={styles.formSelect}
                value={linkHost}
                onChange={(event) => setLinkHost(event.target.value as typeof linkHost)}
              >
                <option value="codeforces">Codeforces</option>
                <option value="leetcode">LeetCode</option>
                <option value="atcoder">AtCoder</option>
              </select>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel} htmlFor="link-handle">
                Handle
              </label>
              <input
                id="link-handle"
                className={styles.formInput}
                value={linkHandle}
                onChange={(event) => setLinkHandle(event.target.value)}
                placeholder="e.g. tourist"
                autoFocus
              />
            </div>
            {linkError && (
              <p style={{ color: 'var(--danger, #ef4444)', fontSize: 12, margin: 0 }}>{linkError}</p>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setLinkModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={linkSubmitting || !linkHandle.trim()}
              >
                {linkSubmitting ? 'Linking…' : 'Link'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ height: 280, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error || contests.length === 0 ? (
        <EmptyState
          title={error ? 'Could not load contests' : 'No upcoming contests'}
          description={error ?? 'Linked accounts will surface upcoming rounds here.'}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      ) : (
        <div className={styles.list}>
          {contests.map((contest) => (
            <article key={contest.id} className={styles.contestRow}>
              <div>
                <div className={styles.contestHead}>
                  <span className={styles.hostTag}>{contest.host}</span>
                  <h2 className={styles.contestTitle}>{contest.name}</h2>
                </div>
                <p className={styles.contestMeta}>
                  {formatRange(contest.startsAt, contest.endsAt)} · {contest.durationMinutes} min
                </p>
              </div>
              <div className={styles.contestActions}>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${contest.reminderSet ? styles.iconBtnActive : ''}`}
                  onClick={() => void toggleReminder(contest)}
                  aria-pressed={contest.reminderSet}
                >
                  {contest.reminderSet ? 'Reminder on' : 'Remind me'}
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${contest.bookmarked ? styles.iconBtnActive : ''}`}
                  onClick={() => void toggleBookmark(contest)}
                  aria-pressed={contest.bookmarked}
                >
                  {contest.bookmarked ? 'Saved' : 'Save'}
                </button>
                {contest.url && (
                  <a className={styles.iconBtn} href={contest.url} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
