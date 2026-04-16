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

  return (
    <main className={styles.page}>
      {/* ── Page header ────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>My Submissions</h1>
          <p className={styles.pageSub}>View, edit, and resubmit all your milestone submissions.</p>
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

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <div className={styles.panel}>
          <p className={styles.muted}>Loading submissions…</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && <div className={styles.errorBar}>{error}</div>}

      {/* ── Submissions table ────────────────────────────────────────── */}
      {!loading && !error && (
        <div className={styles.panel}>
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
