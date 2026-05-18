'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../../_components/widgets/EmptyState';
import VoteButton from '../../../_components/widgets/VoteButton';
import {
  createPost,
  getThread,
  listPosts,
  setThreadClosed,
  setThreadPinned,
  votePost,
  type CommunityPost,
  type CommunityThread,
} from '../../../../lib/services/community';
import { useSession } from '../../../_components/session-context';
import { friendlyMessage } from '../../../../lib/api-clients/errors';

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params?.threadId ?? '';
  const { user } = useSession();
  const [thread, setThread] = useState<CommunityThread | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInstructorOrTa =
    user?.systemRole === 'admin' ||
    (user?.memberships ?? []).some((m) =>
      ['instructor', 'ta'].includes(m.role.toLowerCase())
    );

  const load = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    setError(null);
    try {
      const [t, p] = await Promise.all([getThread(threadId), listPosts(threadId)]);
      setThread(t);
      setPosts(p);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePinToggle() {
    if (!thread) return;
    const previous = thread.pinned;
    setThread({ ...thread, pinned: !previous });
    try {
      const updated = await setThreadPinned(thread.id, !previous);
      setThread(updated);
    } catch (err) {
      setThread((current) => (current ? { ...current, pinned: previous } : current));
      setError(friendlyMessage(err));
    }
  }

  async function handleCloseToggle() {
    if (!thread) return;
    const previous = thread.closed;
    setThread({ ...thread, closed: !previous });
    try {
      const updated = await setThreadClosed(thread.id, !previous);
      setThread(updated);
    } catch (err) {
      setThread((current) => (current ? { ...current, closed: previous } : current));
      setError(friendlyMessage(err));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !thread) return;
    setSubmitting(true);
    try {
      const created = await createPost(thread.id, trimmed);
      setPosts((prev) => [...prev, created]);
      setDraft('');
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ height: 240, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className={styles.page}>
        <header className={styles.breadcrumb}>
          <Link href="/community/discussions">← Back to discussions</Link>
        </header>
        <EmptyState
          title="Could not load thread"
          description={error ?? 'This thread may have been removed.'}
          tone={error ? 'error' : 'default'}
          action={{ label: 'Retry', onClick: () => void load() }}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.breadcrumb}>
        <Link href="/community/discussions">← Back to discussions</Link>
      </header>

      <article className={styles.threadHeader}>
        <div className={styles.threadTitleRow}>
          <h1 className={styles.threadTitle}>{thread.title}</h1>
          {thread.pinned && <span className={`${styles.statusTag} ${styles.tagPinned}`}>Pinned</span>}
          {thread.closed && <span className={`${styles.statusTag} ${styles.tagClosed}`}>Closed</span>}
        </div>
        <div className={styles.metaRow}>
          <span>{thread.author.username}</span>
          <span>·</span>
          <span>{formatTimestamp(thread.createdAt)}</span>
          {thread.tags.map((tag) => (
            <span key={tag} className={styles.tagPill}>
              {tag}
            </span>
          ))}
        </div>
        {thread.body && <p className={styles.threadBody}>{thread.body}</p>}
        {isInstructorOrTa && (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.actionBtn} ${thread.pinned ? styles.actionBtnActive : ''}`}
              onClick={() => void handlePinToggle()}
            >
              {thread.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${thread.closed ? styles.actionBtnActive : ''}`}
              onClick={() => void handleCloseToggle()}
            >
              {thread.closed ? 'Reopen' : 'Close'}
            </button>
          </div>
        )}
      </article>

      <div className={styles.postsList}>
        {posts.length === 0 ? (
          <EmptyState title="No replies yet" description="Be the first to chime in." />
        ) : (
          posts.map((post) => (
            <article key={post.id} className={styles.post}>
              <VoteButton
                size="sm"
                score={post.score}
                myVote={post.myVote}
                onVote={async (direction) => {
                  const result = await votePost(post.id, direction);
                  setPosts((prev) =>
                    prev.map((p) =>
                      p.id === post.id
                        ? { ...p, score: result.score, myVote: result.myVote }
                        : p
                    )
                  );
                  return result;
                }}
                ariaLabel="Vote on post"
              />
              <div className={styles.postBody}>
                <p>{post.body}</p>
              </div>
              <div className={styles.postAuthor}>
                <strong>{post.author.username}</strong>
                <span>{formatTimestamp(post.createdAt)}</span>
              </div>
            </article>
          ))
        )}
      </div>

      {thread.closed ? (
        <div className={styles.closedNotice}>This thread is closed. No new replies can be added.</div>
      ) : (
        <form className={styles.composer} onSubmit={handleSubmit}>
          <span className={styles.composerLabel}>Reply</span>
          <textarea
            className={styles.composerInput}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Share an update, a question, or a useful resource…"
          />
          <div className={styles.composerActions}>
            <button type="submit" className={styles.submitBtn} disabled={submitting || !draft.trim()}>
              {submitting ? 'Posting…' : 'Post reply'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
