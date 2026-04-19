'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFetch } from '../../lib/use-fetch';
import styles from './submissions.module.css';

type StudentSubmission = {
  id: string;
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

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  needs_review: 'Needs Review',
};

function getStatusClass(status: string): string {
  if (status === 'passed') return styles.statusPassed;
  if (status === 'failed') return styles.statusFailed;
  if (status === 'needs_review') return styles.statusReview;
  if (status === 'queued' || status === 'running') return styles.statusQueued;
  return styles.statusDefault;
}

export default function SubmissionsPage() {
  const { data, loading, error } = useFetch<StudentSubmission[]>('/v1/me/submissions');
  const [statusFilter, setStatusFilter] = useState('all');

  const submissions = Array.isArray(data) ? data : [];
  const filtered =
    statusFilter === 'all' ? submissions : submissions.filter((s) => s.status === statusFilter);
  const passedCount = submissions.filter((submission) => submission.status === 'passed').length;
  const reviewCount = submissions.filter(
    (submission) => submission.status === 'needs_review'
  ).length;
  const pendingCount = submissions.filter(
    (submission) => submission.status === 'queued' || submission.status === 'running'
  ).length;

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Submission History</span>
          <h1 className={styles.pageTitle}>
            Review every submission from one structured timeline.
          </h1>
          <p className={styles.pageSub}>
            Track statuses, open details, and jump back into project work without digging through
            scattered milestone screens.
          </p>
        </div>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="needs_review">Needs Review</option>
        </select>
      </div>

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total</span>
          <strong>{submissions.length}</strong>
          <p>Recorded submissions across your active courses.</p>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Passed</span>
          <strong>{passedCount}</strong>
          <p>Submissions that cleared automated checks or review.</p>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Needs Review</span>
          <strong>{reviewCount}</strong>
          <p>Waiting on manual grading or follow-up review.</p>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>In Flight</span>
          <strong>{pendingCount}</strong>
          <p>Queued or currently running verification.</p>
        </article>
      </div>

      {loading && (
        <div className={styles.panel}>
          <p className={styles.muted}>Loading submissions…</p>
        </div>
      )}

      {error && <div className={styles.errorBar}>{error}</div>}

      {!loading && !error && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.panelTitle}>Submission Ledger</p>
              <p className={styles.panelCopy}>
                Filter by outcome, then open the detailed submission record.
              </p>
            </div>
            <span className={styles.panelCount}>{filtered.length} visible</span>
          </div>
          {filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyEmoji}>📭</span>
              <h2>No submissions found</h2>
              <p>
                {statusFilter !== 'all'
                  ? 'No submissions match this filter. Try switching to "All statuses".'
                  : 'Submit a milestone from the Projects page to see it here.'}
              </p>
              <Link href="/projects" className={styles.linkBtn}>
                Go to Projects →
              </Link>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <strong>{sub.projectKey}</strong>
                      </td>
                      <td className={styles.typeCell}>{sub.submissionType}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(sub.status)}`}>
                          {STATUS_LABELS[sub.status] ?? sub.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className={styles.mono}>
                        {new Date(sub.submittedAt || sub.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <Link href={`/submissions/${sub.id}`} className={styles.viewBtn}>
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
