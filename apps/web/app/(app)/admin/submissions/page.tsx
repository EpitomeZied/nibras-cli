"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/session";
import styles from "../../instructor/instructor.module.css";

type Submission = {
  id: string;
  projectKey: string;
  commitSha: string;
  branch: string;
  status: string;
  summary: string;
  submissionType: string;
  createdAt: string;
  updatedAt: string;
};

const OVERRIDE_STATUSES = ["passed", "failed", "needs_review"] as const;

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [overriding, setOverriding] = useState<string | null>(null);
  const [overrideValues, setOverrideValues] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadSubmissions();
  }, []);

  async function loadSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/v1/admin/submissions", { auth: true });
      if (!res.ok) throw new Error("Failed to load submissions.");
      const data = await res.json() as { submissions: Submission[] };
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOverride(submissionId: string) {
    const newStatus = overrideValues[submissionId];
    if (!newStatus) return;
    setOverriding(submissionId);
    try {
      const res = await apiFetch(`/v1/admin/submissions/${submissionId}/status`, {
        method: "PATCH",
        auth: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error || "Override failed.");
      }
      setSubmissions((prev) =>
        prev.map((sub) => sub.id === submissionId ? { ...sub, status: newStatus } : sub)
      );
      setOverrideValues((prev) => { const next = { ...prev }; delete next[submissionId]; return next; });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Override failed.");
    } finally {
      setOverriding(null);
    }
  }

  const filtered = statusFilter === "all"
    ? submissions
    : submissions.filter((sub) => sub.status === statusFilter);

  function statusClass(status: string) {
    if (status === "passed") return styles.statusPublished;
    if (status === "failed") return styles.statusArchived;
    return styles.statusDraft;
  }

  return (
    <div className={styles.page}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href="/admin">Admin</Link> / Submissions
          </p>
          <h1>All Submissions</h1>
        </div>
        <select
          className={styles.btnSecondary}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 12px", cursor: "pointer" }}
        >
          <option value="all">All statuses</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="needs_review">Needs review</option>
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
                  <th>Commit</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Override</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => (
                  <tr key={sub.id}>
                    <td><strong>{sub.projectKey}</strong></td>
                    <td className={styles.mono}>{sub.commitSha.slice(0, 7)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${statusClass(sub.status)}`}>
                        {sub.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className={styles.mono}>
                      {new Date(sub.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric"
                      })}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <select
                          value={overrideValues[sub.id] || ""}
                          onChange={(e) => setOverrideValues((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                          style={{ padding: "4px 8px", fontSize: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
                        >
                          <option value="">Select…</option>
                          {OVERRIDE_STATUSES.map((s) => (
                            <option key={s} value={s}>{s.replace("_", " ")}</option>
                          ))}
                        </select>
                        <button
                          className={styles.btnPrimary}
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          disabled={!overrideValues[sub.id] || overriding === sub.id}
                          onClick={() => void handleOverride(sub.id)}
                        >
                          {overriding === sub.id ? "…" : "Save"}
                        </button>
                      </div>
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
