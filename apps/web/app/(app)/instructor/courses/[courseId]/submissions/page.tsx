'use client';

import { useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { useFetch } from '../../../../../lib/use-fetch';
import { apiFetch } from '../../../../../lib/session';
import styles from '../../../instructor.module.css';

type Submission = {
  id: string;
  userId: string;
  projectKey: string;
  commitSha: string;
  branch: string;
  status: string;
  submissionType: string;
  summary: string;
  createdAt: string;
};

export default function CourseSubmissionsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const res = await apiFetch(`/v1/tracking/courses/${courseId}/export.csv`, { auth: true });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `course-${courseId}-grades.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('CSV export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }
  const { data, loading, error } = useFetch<{ submissions: Submission[] }>(
    `/v1/tracking/review-queue?courseId=${courseId}`
  );
  const submissions = data?.submissions ?? [];

  const filtered =
    statusFilter === 'all' ? submissions : submissions.filter((sub) => sub.status === statusFilter);

  function statusClass(status: string) {
    if (status === 'passed') return styles.statusPublished;
    if (status === 'failed') return styles.statusArchived;
    return styles.statusDraft;
  }

  return (
    <div className={styles.page}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href="/instructor">Instructor</Link> /{' '}
            <Link href={`/instructor/courses/${courseId}`}>Course</Link> / Submissions
          </p>
          <h1>Submission Review Queue</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className={styles.btnSecondary}
            style={{ padding: '8px 16px', cursor: exporting ? 'wait' : 'pointer' }}
          >
            {exporting ? 'Exporting…' : '↓ Export CSV'}
          </button>
          <select
            className={styles.btnSecondary}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', cursor: 'pointer' }}
          >
            <option value="all">All statuses</option>
            <option value="needs_review">Needs review</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
          </select>
        </div>
      </div>

      {loading && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && !error && (
        <div className={styles.panel} style={{ overflowX: 'auto' }}>
          {filtered.length === 0 ? (
            <p className={styles.muted}>No submissions match this filter.</p>
          ) : (
            <table className={styles.submissionTable}>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Branch</th>
                  <th>Commit</th>
                  <th>Status</th>
                  <th>Type</th>
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
                    <td className={styles.mono}>{sub.branch}</td>
                    <td className={styles.mono}>{sub.commitSha.slice(0, 7)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${statusClass(sub.status)}`}>
                        {sub.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={styles.muted}>{sub.submissionType}</td>
                    <td className={styles.mono}>
                      {new Date(sub.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <Link
                        href={`/instructor/courses/${courseId}/submissions/${sub.id}/review`}
                        className={styles.btnPrimary}
                        style={{ padding: '6px 14px', fontSize: 13, whiteSpace: 'nowrap' }}
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
