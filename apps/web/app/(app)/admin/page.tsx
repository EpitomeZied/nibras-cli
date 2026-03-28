"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/session";
import styles from "../instructor/instructor.module.css";

type Submission = { id: string; status: string };
type StatusCount = Record<string, number>;

export default function AdminPage() {
  const [counts, setCounts] = useState<StatusCount>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/v1/admin/submissions", { auth: true });
        if (!res.ok) throw new Error("Failed to load submissions.");
        const data = await res.json() as { submissions: Submission[] };
        const tally: StatusCount = {};
        for (const sub of data.submissions) {
          tally[sub.status] = (tally[sub.status] || 0) + 1;
        }
        setCounts(tally);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statuses = ["queued", "running", "passed", "failed", "needs_review"];
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Admin</h1>
          <p className={styles.subtitle}>System-wide oversight of submissions and projects.</p>
        </div>
      </div>

      {loading && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && !error && (
        <>
          <div className={styles.courseGrid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            <div className={styles.courseCard} style={{ pointerEvents: "none" }}>
              <span className={styles.courseCode}>Total</span>
              <strong style={{ fontSize: "2rem" }}>{total}</strong>
              <span className={styles.muted}>submissions</span>
            </div>
            {statuses.map((status) => (
              <div key={status} className={styles.courseCard} style={{ pointerEvents: "none" }}>
                <span className={styles.courseCode}>{status.replace("_", " ")}</span>
                <strong style={{ fontSize: "2rem" }}>{counts[status] || 0}</strong>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <Link href="/admin/submissions" className={styles.btnPrimary}>
              Manage Submissions
            </Link>
            <Link href="/admin/projects" className={styles.btnSecondary}>
              Manage Projects
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
