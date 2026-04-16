'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { GitHubRepositoryValidateResponse, TrackingSubmissionType } from '@nibras/contracts';
import { apiFetch } from '../../../lib/session';
import {
  canSubmitSubmission,
  isValidAbsoluteHttpUrl,
  shouldClearVerifiedRepo,
} from '../../projects/_components/submission-modal.logic.js';
import styles from '../submissions.module.css';

/* ── Types ─────────────────────────────────────────────────────────────────── */

type Submission = {
  id: string;
  projectId: string;
  projectKey: string;
  milestoneId: string | null;
  commitSha: string;
  repoUrl: string;
  branch: string;
  status: string;
  summary: string;
  submissionType: string;
  submissionValue: string | null;
  notes: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  localTestExitCode: number | null;
};

type RubricItem = { criterion: string; maxScore: number; earned?: number };

type Review = {
  status: string;
  score: number | null;
  feedback: string;
  rubric: RubricItem[];
  reviewedAt: string | null;
};

type GitHubStatus = {
  available: boolean;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  githubLogin: string;
  installUrl: string;
  statusMessage: string;
};

type RepoValidationState = 'idle' | 'checking' | 'valid' | 'invalid' | 'unavailable';

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  needs_review: 'Needs Review',
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
  graded: 'Graded',
};

function getStatusClass(status: string): string {
  if (status === 'passed') return styles.statusPassed;
  if (status === 'failed') return styles.statusFailed;
  if (status === 'needs_review') return styles.statusReview;
  if (status === 'queued' || status === 'running') return styles.statusQueued;
  return styles.statusDefault;
}

function getReviewClass(status: string): string {
  if (status === 'approved') return styles.reviewApproved;
  if (status === 'graded') return styles.reviewGraded;
  if (status === 'changes_requested') return styles.reviewChanges;
  return styles.reviewPending;
}

async function loadGitHubStatus(): Promise<GitHubStatus> {
  const fallback = (msg: string): GitHubStatus => ({
    available: false,
    githubLinked: false,
    githubAppInstalled: false,
    githubLogin: '',
    installUrl: '',
    statusMessage: msg,
  });

  try {
    const res = await apiFetch('/v1/web/session', { auth: true });
    if (!res.ok) return fallback('GitHub status is temporarily unavailable.');

    const payload = (await res.json()) as {
      user?: { githubLinked?: boolean; githubAppInstalled?: boolean; githubLogin?: string | null };
    };
    const user = payload.user ?? {};
    const githubLinked = Boolean(user.githubLinked);
    const githubAppInstalled = Boolean(user.githubAppInstalled);
    const githubLogin = user.githubLogin ?? '';

    if (!githubLinked || githubAppInstalled) {
      return {
        available: true,
        githubLinked,
        githubAppInstalled,
        githubLogin,
        installUrl: '',
        statusMessage: '',
      };
    }

    try {
      const installRes = await apiFetch('/v1/github/install-url', { auth: true });
      if (!installRes.ok) {
        return {
          available: true,
          githubLinked,
          githubAppInstalled,
          githubLogin,
          installUrl: '',
          statusMessage: 'GitHub App install link unavailable.',
        };
      }
      const installPayload = (await installRes.json()) as { installUrl?: string };
      return {
        available: true,
        githubLinked,
        githubAppInstalled,
        githubLogin,
        installUrl: installPayload.installUrl ?? '',
        statusMessage: '',
      };
    } catch {
      return {
        available: true,
        githubLinked,
        githubAppInstalled,
        githubLogin,
        installUrl: '',
        statusMessage: 'GitHub App install link unavailable.',
      };
    }
  } catch {
    return fallback('GitHub status is temporarily unavailable.');
  }
}

/* ── Edit Form ─────────────────────────────────────────────────────────────── */

function EditForm({
  submission,
  githubStatus,
  onSuccess,
}: {
  submission: Submission;
  githubStatus: GitHubStatus;
  onSuccess: () => void;
}) {
  const [submissionType, setSubmissionType] = useState<TrackingSubmissionType>(
    (submission.submissionType as TrackingSubmissionType) ?? 'github'
  );
  const [submissionValue, setSubmissionValue] = useState(
    submission.submissionType === 'github'
      ? submission.repoUrl || submission.submissionValue || ''
      : submission.submissionValue || ''
  );
  const [notes, setNotes] = useState(submission.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [repoValidationState, setRepoValidationState] = useState<RepoValidationState>('idle');
  const [repoValidationMessage, setRepoValidationMessage] = useState('');
  const [verifiedRepository, setVerifiedRepository] =
    useState<GitHubRepositoryValidateResponse | null>(null);

  const linkIsValid = isValidAbsoluteHttpUrl(submissionValue);
  const textIsValid = submissionValue.trim().length > 0;

  const submitDisabled = !canSubmitSubmission({
    submissionType,
    submissionValue,
    isSubmitting: submitting,
    isVerifyingRepo: repoValidationState === 'checking',
    githubLinked: githubStatus.githubLinked,
    githubAppInstalled: githubStatus.githubAppInstalled,
    repoValidationState,
  });

  const repoStatusTone =
    repoValidationState === 'valid'
      ? styles.cardSuccess
      : repoValidationState === 'unavailable'
        ? styles.cardWarning
        : repoValidationState === 'invalid'
          ? styles.cardDanger
          : styles.cardNeutral;

  const repoStatusText = useMemo(() => {
    if (!githubStatus.available)
      return githubStatus.statusMessage || 'GitHub status is temporarily unavailable.';
    if (!githubStatus.githubLinked)
      return 'Connect your GitHub account before verifying a repository.';
    if (repoValidationState === 'checking') return 'Checking the repository on GitHub…';
    if (repoValidationState === 'valid')
      return 'Repository verified. This is the repo that will be submitted.';
    if (repoValidationState === 'invalid' || repoValidationState === 'unavailable')
      return repoValidationMessage;
    return 'Verify the repository before saving changes.';
  }, [githubStatus, repoValidationMessage, repoValidationState]);

  const trackingCard = useMemo(() => {
    if (!githubStatus.available) {
      return {
        tone: styles.cardWarning,
        title: 'GitHub status unavailable',
        body:
          githubStatus.statusMessage ||
          'GitHub submissions are blocked until your account status can be checked.',
      };
    }
    if (!githubStatus.githubLinked) {
      return {
        tone: styles.cardWarning,
        title: 'Connect GitHub first',
        body: 'GitHub repository submission requires a connected GitHub account.',
      };
    }
    if (!githubStatus.githubAppInstalled) {
      return {
        tone: styles.cardWarning,
        title: 'Install the GitHub App',
        body: 'Install the GitHub App before submitting a GitHub repo so pushes can be tracked automatically.',
      };
    }
    return {
      tone: styles.cardSuccess,
      title: 'Automatic tracking is ready',
      body: 'GitHub App is installed. After you save, pushes to the verified repo will be tracked automatically.',
    };
  }, [githubStatus]);

  function changeType(nextType: TrackingSubmissionType) {
    setSubmissionType(nextType);
    setSubmissionValue('');
    setNotes('');
    setAttemptedSubmit(false);
    setRepoValidationState('idle');
    setRepoValidationMessage('');
    setVerifiedRepository(null);
  }

  function handleValueChange(nextValue: string) {
    if (verifiedRepository && shouldClearVerifiedRepo(verifiedRepository.repoUrl, nextValue)) {
      setVerifiedRepository(null);
      setRepoValidationState('idle');
      setRepoValidationMessage('');
    } else if (repoValidationState === 'invalid' || repoValidationState === 'unavailable') {
      setRepoValidationState('idle');
      setRepoValidationMessage('');
    }
    setSubmissionValue(nextValue);
  }

  async function verifyRepository() {
    if (!githubStatus.available) {
      setRepoValidationState('unavailable');
      setRepoValidationMessage(
        githubStatus.statusMessage || 'GitHub status is temporarily unavailable.'
      );
      return;
    }
    if (!githubStatus.githubLinked) {
      setRepoValidationState('invalid');
      setRepoValidationMessage('Connect your GitHub account before verifying a repository.');
      return;
    }
    if (!submissionValue.trim()) {
      setRepoValidationState('invalid');
      setRepoValidationMessage('Enter a GitHub repository URL to verify it.');
      return;
    }
    setRepoValidationState('checking');
    setRepoValidationMessage('');
    setVerifiedRepository(null);
    try {
      const response = await apiFetch('/v1/github/repositories/validate', {
        method: 'POST',
        auth: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repoUrl: submissionValue.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as
        | GitHubRepositoryValidateResponse
        | { error?: string };
      if (!response.ok) {
        setRepoValidationState(response.status >= 500 ? 'unavailable' : 'invalid');
        setRepoValidationMessage(
          'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Repository verification failed.'
        );
        return;
      }
      const repo = payload as GitHubRepositoryValidateResponse;
      setVerifiedRepository(repo);
      setSubmissionValue(repo.repoUrl);
      setRepoValidationState('valid');
      setRepoValidationMessage('');
    } catch (error) {
      setRepoValidationState('unavailable');
      setRepoValidationMessage(
        error instanceof Error ? error.message : 'Repository verification failed.'
      );
    }
  }

  async function handleSave() {
    setAttemptedSubmit(true);
    if (submitDisabled) return;

    let body: Record<string, string>;
    if (submissionType === 'github' && verifiedRepository) {
      body = {
        submissionType,
        submissionValue: verifiedRepository.repoUrl,
        notes,
        repoUrl: verifiedRepository.repoUrl,
        branch: verifiedRepository.defaultBranch,
        commitSha: '',
      };
    } else {
      body = {
        submissionType,
        submissionValue: submissionValue.trim(),
        notes,
        repoUrl: '',
        branch: 'main',
        commitSha: '',
      };
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await apiFetch(`/v1/tracking/submissions/${submission.id}`, {
        method: 'PATCH',
        auth: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `Save failed (${response.status}).`);
      }
      onSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const showLinkError = submissionType === 'link' && attemptedSubmit && !linkIsValid;
  const showTextError = submissionType === 'text' && attemptedSubmit && !textIsValid;

  return (
    <div className={styles.editPanel}>
      <div>
        <h2 className={styles.editPanelTitle}>Edit &amp; Resubmit</h2>
        <p className={styles.editPanelSub}>Update your submission and send it back for review.</p>
      </div>

      {/* Type tabs */}
      <div className={styles.typeTabs}>
        {(['github', 'link', 'text'] as TrackingSubmissionType[]).map((type) => (
          <button
            key={type}
            type="button"
            className={`${styles.typeTab} ${submissionType === type ? styles.typeTabActive : ''}`}
            onClick={() => changeType(type)}
          >
            {type === 'github' ? 'GitHub Repo' : type === 'link' ? 'Link' : 'Write-up'}
          </button>
        ))}
      </div>

      {/* GitHub fields */}
      {submissionType === 'github' && (
        <>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>GitHub Repository</span>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                type="url"
                value={submissionValue}
                onChange={(e) => handleValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void verifyRepository();
                  }
                }}
                placeholder="https://github.com/owner/repo"
              />
              <button
                type="button"
                className={styles.verifyBtn}
                disabled={
                  repoValidationState === 'checking' ||
                  !githubStatus.available ||
                  !githubStatus.githubLinked
                }
                onClick={() => void verifyRepository()}
              >
                {repoValidationState === 'checking' ? 'Verifying…' : 'Verify Repo'}
              </button>
            </div>
          </label>

          <div className={`${styles.card} ${repoStatusTone}`}>
            <strong>
              {repoValidationState === 'valid' ? 'Repository verified' : 'Repository status'}
            </strong>
            <p>{repoStatusText}</p>
          </div>

          {verifiedRepository && repoValidationState === 'valid' && (
            <div className={`${styles.card} ${styles.cardSuccess}`}>
              <strong>Verified repo summary</strong>
              <dl className={styles.summaryGrid}>
                <div>
                  <dt>Repository</dt>
                  <dd>{verifiedRepository.fullName}</dd>
                </div>
                <div>
                  <dt>URL</dt>
                  <dd>{verifiedRepository.repoUrl}</dd>
                </div>
                <div>
                  <dt>Visibility</dt>
                  <dd>{verifiedRepository.visibility}</dd>
                </div>
                <div>
                  <dt>Default branch</dt>
                  <dd>{verifiedRepository.defaultBranch}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className={`${styles.card} ${trackingCard.tone}`}>
            <strong>{trackingCard.title}</strong>
            <p>{trackingCard.body}</p>
            {githubStatus.githubLinked && !githubStatus.githubAppInstalled && (
              <a
                href={githubStatus.installUrl || '/settings'}
                className={styles.inlineAction}
                target={githubStatus.installUrl ? '_blank' : undefined}
                rel={githubStatus.installUrl ? 'noreferrer' : undefined}
              >
                {githubStatus.installUrl ? 'Install GitHub App' : 'Open Settings'}
              </a>
            )}
            {!githubStatus.githubLinked && (
              <a href="/settings" className={styles.inlineAction}>
                Open Settings
              </a>
            )}
          </div>
        </>
      )}

      {/* Link / text fields */}
      {submissionType !== 'github' && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {submissionType === 'link' ? 'Submission Link' : 'Submission Notes'}
          </span>
          {submissionType === 'link' ? (
            <input
              className={styles.input}
              type="url"
              value={submissionValue}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder="https://example.com/submission"
            />
          ) : (
            <textarea
              className={styles.textarea}
              rows={7}
              value={submissionValue}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder="Explain what you built, where to look first, and any important decisions…"
            />
          )}
          {showLinkError && (
            <p className={styles.inlineError}>
              Enter a valid absolute URL starting with http:// or https://.
            </p>
          )}
          {showTextError && (
            <p className={styles.inlineError}>Add a short write-up before saving.</p>
          )}
        </label>
      )}

      {/* Notes */}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          Notes to Reviewer <span className={styles.optional}>(optional)</span>
        </span>
        <textarea
          className={styles.textarea}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the reviewer should know?"
        />
      </label>

      {submitError && <p className={styles.submitError}>{submitError}</p>}

      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.submitBtn}
          disabled={submitDisabled || submitting}
          onClick={() => void handleSave()}
        >
          {submitting ? 'Saving…' : '↑ Save & Resubmit'}
        </button>
      </div>
    </div>
  );
}

/* ── Main page component ───────────────────────────────────────────────────── */

export default function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = use(params);

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [githubStatus, setGitHubStatus] = useState<GitHubStatus>({
    available: false,
    githubLinked: false,
    githubAppInstalled: false,
    githubLogin: '',
    installUrl: '',
    statusMessage: 'Loading…',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 4000);
  }

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const subRes = await apiFetch(`/v1/tracking/submissions/${submissionId}`, { auth: true });
      if (!subRes.ok) {
        const body = (await subRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed to load submission (${subRes.status}).`);
      }
      const subData = (await subRes.json()) as Submission;
      setSubmission(subData);

      const [reviewResult, ghResult] = await Promise.allSettled([
        apiFetch(`/v1/tracking/submissions/${submissionId}/review`, { auth: true }),
        loadGitHubStatus(),
      ]);

      if (reviewResult.status === 'fulfilled' && reviewResult.value.ok) {
        const rd = (await reviewResult.value.json()) as Review;
        setReview(rd);
      }

      if (ghResult.status === 'fulfilled') {
        setGitHubStatus(ghResult.value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  /* Whether the student can still edit this submission */
  const canEdit = !review || (review.status !== 'approved' && review.status !== 'graded');

  /* ── Loading state ─────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.panel}>
          <p className={styles.muted}>Loading submission…</p>
        </div>
      </main>
    );
  }

  /* ── Error state ───────────────────────────────────────────────────────── */
  if (error || !submission) {
    return (
      <main className={styles.page}>
        <p className={styles.breadcrumb}>
          <Link href="/submissions">Submissions</Link>
          <span>/</span>
          Detail
        </p>
        <div className={styles.errorBar}>{error || 'Submission not found.'}</div>
      </main>
    );
  }

  const submittedDate = new Date(submission.submittedAt || submission.createdAt).toLocaleDateString(
    'en-US',
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }
  );

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* ── Breadcrumb + heading ─────────────────────────────────────── */}
      <div>
        <p className={styles.breadcrumb}>
          <Link href="/submissions">Submissions</Link>
          <span>/</span>
          {submission.projectKey}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className={styles.detailTitle}>{submission.projectKey}</h1>
          <span className={`${styles.statusBadge} ${getStatusClass(submission.status)}`}>
            {STATUS_LABELS[submission.status] ?? submission.status.replace(/_/g, ' ')}
          </span>
          {review && (
            <span className={`${styles.statusBadge} ${getReviewClass(review.status)}`}>
              {REVIEW_STATUS_LABELS[review.status] ?? review.status.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────── */}
      <div className={styles.detailGrid}>
        {/* LEFT: submission details + review ───────────────────────── */}
        <div className={styles.detailCol}>
          {/* Submission details panel */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Submission Details</h2>
              <span className={styles.muted} style={{ fontSize: 12 }}>
                {submittedDate}
              </span>
            </div>
            <table className={styles.detailTable}>
              <tbody>
                <tr>
                  <td>Project</td>
                  <td>
                    <strong>{submission.projectKey}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Type</td>
                  <td style={{ textTransform: 'capitalize' }}>{submission.submissionType}</td>
                </tr>
                {submission.submissionType === 'github' && (
                  <>
                    <tr>
                      <td>Repository</td>
                      <td>
                        {submission.repoUrl ? (
                          <a
                            href={submission.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--primary, #3b82f6)', wordBreak: 'break-all' }}
                          >
                            {submission.repoUrl}
                          </a>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>Branch</td>
                      <td className={styles.mono}>{submission.branch || '—'}</td>
                    </tr>
                    <tr>
                      <td>Commit</td>
                      <td className={styles.mono}>
                        {submission.commitSha ? submission.commitSha.slice(0, 7) : '—'}
                      </td>
                    </tr>
                  </>
                )}
                {submission.submissionType === 'link' && submission.submissionValue && (
                  <tr>
                    <td>Link</td>
                    <td>
                      <a
                        href={submission.submissionValue}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--primary, #3b82f6)', wordBreak: 'break-all' }}
                      >
                        {submission.submissionValue}
                      </a>
                    </td>
                  </tr>
                )}
                <tr>
                  <td>Status</td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusClass(submission.status)}`}>
                      {STATUS_LABELS[submission.status] ?? submission.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Submitted</td>
                  <td className={styles.mono}>{submittedDate}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Write-up / text submission value */}
          {submission.submissionType === 'text' && submission.submissionValue && (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>Your Write-up</h2>
              </div>
              <pre className={styles.codeBlock}>{submission.submissionValue}</pre>
            </div>
          )}

          {/* Notes to reviewer */}
          {submission.notes && (
            <div
              className={styles.panel}
              style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.03)' }}
            >
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>💬 Your Notes</h2>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.75,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text)',
                }}
              >
                {submission.notes}
              </p>
            </div>
          )}

          {/* Test output */}
          {submission.summary && (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>Test Output</h2>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background:
                      submission.localTestExitCode === 0
                        ? 'rgba(34,197,94,0.1)'
                        : 'rgba(239,68,68,0.1)',
                    color: submission.localTestExitCode === 0 ? 'var(--success)' : 'var(--danger)',
                    border: `1px solid ${submission.localTestExitCode === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  exit {submission.localTestExitCode ?? '?'}
                </span>
              </div>
              <pre className={styles.codeBlock}>{submission.summary}</pre>
            </div>
          )}

          {/* Instructor review */}
          {review && (
            <div
              className={styles.panel}
              style={{
                borderColor:
                  review.status === 'approved'
                    ? 'rgba(34,197,94,0.3)'
                    : review.status === 'changes_requested'
                      ? 'rgba(239,68,68,0.3)'
                      : undefined,
              }}
            >
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>Instructor Review</h2>
                <span className={`${styles.statusBadge} ${getReviewClass(review.status)}`}>
                  {REVIEW_STATUS_LABELS[review.status] ?? review.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Score */}
              {review.score !== null && (
                <div style={{ marginBottom: 16 }}>
                  <span className={styles.reviewScore}>
                    <span className={styles.reviewScoreValue}>{review.score}</span>
                    {review.rubric.length > 0 && (
                      <span className={styles.reviewScoreMax}>
                        / {review.rubric.reduce((s, r) => s + r.maxScore, 0)} pts
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Feedback */}
              {review.feedback && (
                <div style={{ marginBottom: review.rubric.length > 0 ? 16 : 0 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      margin: '0 0 8px',
                    }}
                  >
                    Feedback
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.75,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text)',
                    }}
                  >
                    {review.feedback}
                  </p>
                </div>
              )}

              {/* Rubric */}
              {review.rubric.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      margin: '0 0 8px',
                    }}
                  >
                    Rubric
                  </p>
                  <div className={styles.rubricList}>
                    {review.rubric.map((item) => (
                      <div key={item.criterion} className={styles.rubricRow}>
                        <span className={styles.rubricCriterion}>{item.criterion}</span>
                        <span className={styles.rubricScore}>
                          {item.earned ?? '—'} / {item.maxScore}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviewed date */}
              {review.reviewedAt && (
                <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Reviewed on{' '}
                  {new Date(review.reviewedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: edit form or approved notice ─────────────────────── */}
        <div className={styles.detailCol}>
          {canEdit ? (
            <EditForm
              submission={submission}
              githubStatus={githubStatus}
              onSuccess={() => {
                showToast('Submission updated and resubmitted.');
                void loadData();
              }}
            />
          ) : (
            <div className={styles.approvedNotice}>
              <span style={{ fontSize: '1.5rem' }}>✓</span>
              <div>
                <strong>Submission approved</strong>
                <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85, fontWeight: 400 }}>
                  This submission has been {review?.status === 'graded' ? 'graded' : 'approved'} by
                  your instructor. No further edits are needed.
                </p>
              </div>
            </div>
          )}

          {/* Quick link back */}
          <div style={{ paddingTop: 4 }}>
            <Link href="/submissions" className={styles.backLink}>
              ← Back to all submissions
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
