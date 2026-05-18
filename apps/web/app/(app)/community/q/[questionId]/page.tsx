'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../../_components/widgets/EmptyState';
import VoteButton from '../../../_components/widgets/VoteButton';
import {
  acceptAnswer,
  createAnswer,
  getQuestion,
  listAnswers,
  voteAnswer,
  voteQuestion,
  type CommunityAnswer,
  type CommunityQuestion,
} from '../../../../lib/services/community';
import { friendlyMessage } from '../../../../lib/api-clients/errors';

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function QuestionPage() {
  const params = useParams<{ questionId: string }>();
  const questionId = params?.questionId ?? '';
  const [question, setQuestion] = useState<CommunityQuestion | null>(null);
  const [answers, setAnswers] = useState<CommunityAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    setError(null);
    try {
      const [q, a] = await Promise.all([getQuestion(questionId), listAnswers(questionId)]);
      setQuestion(q);
      setAnswers(a);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  const sortedAnswers = useMemo(() => {
    return [...answers].sort((a, b) => {
      const aAccepted = a.accepted || question?.acceptedAnswerId === a.id;
      const bAccepted = b.accepted || question?.acceptedAnswerId === b.id;
      if (aAccepted !== bAccepted) return aAccepted ? -1 : 1;
      return b.score - a.score;
    });
  }, [answers, question?.acceptedAnswerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAccept(answerId: string) {
    try {
      await acceptAnswer(answerId);
      setAnswers((prev) =>
        prev.map((a) => ({ ...a, accepted: a.id === answerId }))
      );
      setQuestion((q) => (q ? { ...q, acceptedAnswerId: answerId } : q));
    } catch (err) {
      setError(friendlyMessage(err));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !questionId) return;
    setSubmitting(true);
    try {
      const created = await createAnswer(questionId, trimmed);
      setAnswers((prev) => [...prev, created]);
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
        <div style={{ height: 200, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className={styles.page}>
        <header className={styles.breadcrumb}>
          <Link href="/community">← Back to community</Link>
        </header>
        <div className={styles.placeholder}>
          <EmptyState
            title="Could not load question"
            description={error ?? 'This question may have been removed.'}
            tone={error ? 'error' : 'default'}
            action={{ label: 'Retry', onClick: () => void load() }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.breadcrumb}>
        <Link href="/community">← Back to community</Link>
      </header>

      <article className={styles.questionCard}>
        <VoteButton
          score={question.score}
          myVote={question.myVote}
          onVote={async (direction) => {
            const result = await voteQuestion(question.id, direction);
            setQuestion((q) => (q ? { ...q, score: result.score, myVote: result.myVote } : q));
            return result;
          }}
          ariaLabel="Vote on question"
        />
        <div className={styles.questionBody}>
          <h1 className={styles.questionTitle}>{question.title}</h1>
          <div className={styles.tagsRow}>
            {question.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
          <p className={styles.markdown}>{question.body}</p>
        </div>
        <div className={styles.authorCard}>
          <span className={styles.authorName}>{question.author.username}</span>
          <span>{formatTimestamp(question.createdAt)}</span>
          {question.author.reputation !== undefined && <span>{question.author.reputation} rep</span>}
        </div>
      </article>

      <div className={styles.answersHeader}>
        <h2 className={styles.answersTitle}>{answers.length} answers</h2>
        <span className={styles.answersMeta}>
          {question.acceptedAnswerId ? 'Solution accepted' : 'No accepted answer yet'}
        </span>
      </div>

      {answers.length === 0 ? (
        <EmptyState
          title="Be the first to answer"
          description="Share what you know and help a peer move forward."
        />
      ) : (
        sortedAnswers.map((answer) => {
          const accepted =
            answer.accepted || question.acceptedAnswerId === answer.id;
          return (
            <article
              key={answer.id}
              className={`${styles.answerCard} ${accepted ? styles.answerAccepted : ''}`}
            >
              <VoteButton
                score={answer.score}
                myVote={answer.myVote}
                onVote={async (direction) => {
                  const result = await voteAnswer(answer.id, direction);
                  setAnswers((prev) =>
                    prev.map((a) =>
                      a.id === answer.id
                        ? { ...a, score: result.score, myVote: result.myVote }
                        : a
                    )
                  );
                  return result;
                }}
                ariaLabel="Vote on answer"
              />
              <div className={styles.questionBody}>
                {accepted && (
                  <span className={styles.acceptedBadge}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                      <path d="M2 5.5L4.5 8l4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Accepted
                  </span>
                )}
                <p className={styles.markdown}>{answer.body}</p>
                {!accepted && !question.acceptedAnswerId && (
                  <button
                    type="button"
                    className={styles.acceptBtn}
                    onClick={() => void handleAccept(answer.id)}
                  >
                    Mark as accepted
                  </button>
                )}
              </div>
              <div className={styles.authorCard}>
                <span className={styles.authorName}>{answer.author.username}</span>
                <span>{formatTimestamp(answer.createdAt)}</span>
              </div>
            </article>
          );
        })
      )}

      <form className={styles.composer} onSubmit={handleSubmit}>
        <span className={styles.composerLabel}>Your answer</span>
        <textarea
          className={styles.composerInput}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Explain the approach, share code, and link references…"
        />
        <div className={styles.composerActions}>
          <button type="submit" className={styles.submitBtn} disabled={submitting || !draft.trim()}>
            {submitting ? 'Posting…' : 'Post answer'}
          </button>
        </div>
      </form>
    </div>
  );
}
