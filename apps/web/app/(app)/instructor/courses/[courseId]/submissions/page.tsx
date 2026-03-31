"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { apiFetch } from "../../../../../lib/session";
import styles from "../../../instructor.module.css";

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

export default function CourseSubmissionsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch(`/v1/tracking/review-queue?courseId=${courseId}`, { auth: true });
        if (!res.ok) throw new Error("Failed to load submissions.");
        const data = await res.json() as { submissions: Submission[] };
        setSubmissions(data.submissions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  const filtered = statusFilter === "all"
    ? submissions
    : submissions.filter((sub) => sub.status === statusFilter);

  function statusClass(status: string) {
    if (status === "passed") return styles.statusPublished;
    if (status === "failed") return styles.statusArchived;
    return styles.statusDraft;
  }

  async function handleRetry(submissionId: string) {
    setRetrying(submissionId);
    try {
      const res = await apiFetch(`/v1/admin/submissions/${submissionId}/retry`, {
        auth: true,
        method: "POST"
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setError(body.error || "Failed to re-queue submission.");
        return;
      }
      // Optimistically update the status in the list
      setSubmissions((prev) =>
        prev.map((sub) => sub.id === submissionId ? { ...sub, status: "queued" } : sub)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-queue submission.");
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href="/instructor">Instructor</Link> /{" "}
            <Link href={`/instructor/courses/${courseId}`}>Course</Link> / Submissions
          </p>
          <h1>Submission Review Queue</h1>
        </div>
        <select
          className={styles.btnSecondary}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 12px", cursor: "pointer" }}
        >
          <option value="all">All statuses</option>
          <option value="needs_review">Needs review</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
        </select>
      </div>

      {loading && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && !error && (
        <div className={styles.panel} style={{ overflowX: "auto" }}>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <Link
                        href={`/instructor/courses/${courseId}/submissions/${sub.id}/review`}
                        style={{ fontWeight: 600 }}
                      >
                        {sub.projectKey}
                      </Link>
                    </td>
                    <td className={styles.mono}>{sub.branch}</td>
                    <td className={styles.mono}>{sub.commitSha.slice(0, 7)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${statusClass(sub.status)}`}>
                        {sub.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className={styles.muted}>{sub.submissionType}</td>
                    <td className={styles.mono}>
                      {new Date(sub.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        disabled={retrying === sub.id}
                        onClick={() => void handleRetry(sub.id)}
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                      >
                        {retrying === sub.id ? "Re-queuing…" : "Re-run"}
                      </button>
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
