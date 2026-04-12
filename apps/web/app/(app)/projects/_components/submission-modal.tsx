'use client';

import { useMemo, useState } from 'react';
import type {
  CreateTrackingSubmissionRequest,
  GitHubRepositoryValidateResponse,
  TrackingMilestone,
  TrackingSubmissionType,
} from '@nibras/contracts';
import { apiFetch } from '../../../lib/session';
import {
  canSubmitSubmission,
  getSubmissionSubmitLabel,
  isValidAbsoluteHttpUrl,
  shouldClearVerifiedRepo,
} from './submission-modal.logic.js';
import styles from './submission-modal.module.css';

type RepoValidationState = 'idle' | 'checking' | 'valid' | 'invalid' | 'unavailable';

type GitHubStatus = {
  available: boolean;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  githubLogin: string;
  installUrl: string;
  statusMessage: string;
};

type Props = {
  milestone: TrackingMilestone;
  githubStatus: GitHubStatus;
  submitting: boolean;
  submitError: string;
  onClose: () => void;
  onSubmit: (payload: CreateTrackingSubmissionRequest) => Promise<void>;
};

export default function SubmissionModal({
  milestone,
  githubStatus,
  submitting,
  submitError,
  onClose,
  onSubmit,
}: Props) {
  const [submissionType, setSubmissionType] = useState<TrackingSubmissionType>('github');
  const [submissionValue, setSubmissionValue] = useState('');
  const [notes, setNotes] = useState('');
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
    if (!githubStatus.available) {
      return githubStatus.statusMessage || 'GitHub status is temporarily unavailable.';
    }
    if (!githubStatus.githubLinked) {
      return 'Connect your GitHub account before verifying a repository.';
    }
    if (repoValidationState === 'checking') {
      return 'Checking the repository on GitHub...';
    }
    if (repoValidationState === 'valid') {
      return 'Repository verified. This is the repo that will be submitted.';
    }
    if (repoValidationState === 'invalid' || repoValidationState === 'unavailable') {
      return repoValidationMessage;
    }
    return 'Use the repository that contains the work for this milestone.';
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
      body: 'GitHub App is installed. After you submit, pushes to the verified repo will be tracked automatically.',
    };
  }, [githubStatus]);

  function setSubmissionKind(nextType: TrackingSubmissionType) {
    setSubmissionType(nextType);
    setSubmissionValue('');
    setNotes('');
    setAttemptedSubmit(false);
    setRepoValidationState('idle');
    setRepoValidationMessage('');
    setVerifiedRepository(null);
  }

  function handleSubmissionValueChange(nextValue: string) {
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

  async function handleSubmit() {
    setAttemptedSubmit(true);
    if (submitDisabled) {
      return;
    }

    const payload: CreateTrackingSubmissionRequest =
      submissionType === 'github' && verifiedRepository
        ? {
            submissionType,
            submissionValue: verifiedRepository.repoUrl,
            notes,
            repoUrl: verifiedRepository.repoUrl,
            branch: verifiedRepository.defaultBranch,
            commitSha: '',
          }
        : submissionType === 'link'
          ? {
              submissionType,
              submissionValue: submissionValue.trim(),
              notes,
              repoUrl: '',
              branch: 'main',
              commitSha: '',
            }
          : {
              submissionType,
              submissionValue: submissionValue.trim(),
              notes,
              repoUrl: '',
              branch: 'main',
              commitSha: '',
            };

    await onSubmit(payload);
  }

  const showLinkError = submissionType === 'link' && attemptedSubmit && !linkIsValid;
  const showTextError = submissionType === 'text' && attemptedSubmit && !textIsValid;

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="submit-title">
        <div className={styles.modalHeader}>
          <div>
            <h2 id="submit-title" className={styles.modalTitle}>
              Submit Milestone
            </h2>
            <p className={styles.modalSub}>{milestone.title}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.typeTabs}>
          {(['github', 'link', 'text'] as TrackingSubmissionType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`${styles.typeTab} ${submissionType === type ? styles.typeTabActive : ''}`}
              onClick={() => setSubmissionKind(type)}
            >
              {type === 'github' ? 'GitHub Repo' : type === 'link' ? 'Link' : 'Write-up'}
            </button>
          ))}
        </div>

        {submissionType === 'github' ? (
          <div className={styles.sectionStack}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Repository verification</h3>
                <p>Use the repository that contains the work for this milestone.</p>
              </div>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>GitHub Repository</span>
                <div className={styles.inputRow}>
                  <input
                    className={styles.input}
                    type="url"
                    value={submissionValue}
                    onChange={(e) => handleSubmissionValueChange(e.target.value)}
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
                    className={styles.secondaryBtn}
                    disabled={
                      repoValidationState === 'checking' ||
                      !githubStatus.available ||
                      !githubStatus.githubLinked
                    }
                    onClick={() => void verifyRepository()}
                  >
                    {repoValidationState === 'checking' ? 'Verifying...' : 'Verify Repo'}
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
                      <dd className={styles.breakWord}>{verifiedRepository.repoUrl}</dd>
                    </div>
                    <div>
                      <dt>Visibility</dt>
                      <dd>{verifiedRepository.visibility}</dd>
                    </div>
                    <div>
                      <dt>Default branch</dt>
                      <dd>{verifiedRepository.defaultBranch}</dd>
                    </div>
                    <div>
                      <dt>Permission</dt>
                      <dd>{verifiedRepository.permission}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Tracking requirements</h3>
                <p>GitHub submissions are only enabled when automatic tracking is ready.</p>
              </div>

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
            </section>
          </div>
        ) : (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3>{submissionType === 'link' ? 'Submission link' : 'Submission notes'}</h3>
              <p>
                {submissionType === 'link'
                  ? 'Use a hosted demo, docs, Figma file, Drive doc, or deployed app URL.'
                  : 'Summarize what you built, what to review, and any caveats the reviewer should know.'}
              </p>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                {submissionType === 'link' ? 'Submission Link' : 'Submission Notes'}
              </span>
              {submissionType === 'link' ? (
                <input
                  className={styles.input}
                  type="url"
                  value={submissionValue}
                  onChange={(e) => handleSubmissionValueChange(e.target.value)}
                  placeholder="https://example.com/submission"
                />
              ) : (
                <textarea
                  className={styles.textarea}
                  rows={7}
                  value={submissionValue}
                  onChange={(e) => handleSubmissionValueChange(e.target.value)}
                  placeholder="Explain what you built, where to look first, and any important decisions..."
                />
              )}
            </label>

            {showLinkError && (
              <p className={styles.inlineError}>
                Enter a valid absolute URL starting with http:// or https://.
              </p>
            )}
            {showTextError && (
              <p className={styles.inlineError}>Add a short write-up before submitting.</p>
            )}
          </section>
        )}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Notes to Reviewer <em className={styles.optional}>(optional)</em>
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

        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            disabled={submitDisabled}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Submitting...' : getSubmissionSubmitLabel(submissionType)}
          </button>
        </div>
      </div>
    </div>
  );
}
