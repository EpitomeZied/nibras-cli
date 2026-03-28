"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { apiFetch } from "../../../../lib/session";
import styles from "../../instructor.module.css";

type Project = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  deliveryMode: string;
};

type Submission = {
  id: string;
  userId: string;
  projectKey: string;
  commitSha: string;
  status: string;
  submissionType: string;
  createdAt: string;
};

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const [projects, setProjects] = useState<Project[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [projRes, subRes] = await Promise.all([
          apiFetch(`/v1/tracking/courses/${courseId}/projects`, { auth: true }),
          apiFetch(`/v1/tracking/review-queue?courseId=${courseId}`, { auth: true })
        ]);

        if (projRes.ok) {
          setProjects(await projRes.json() as Project[]);
        }
        if (subRes.ok) {
          const data = await subRes.json() as { submissions: Submission[] };
          setSubmissions(data.submissions || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  function statusClass(status: string) {
    if (status === "published") return styles.statusPublished;
    if (status === "archived") return styles.statusArchived;
    return styles.statusDraft;
  }

  return (
    <div className={styles.page}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href="/instructor">Instructor</Link> / Course
          </p>
          <h1>Course Detail</h1>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href={`/instructor/courses/${courseId}/members`} className={styles.btnSecondary}>
            Members
          </Link>
          <Link href={`/instructor/courses/${courseId}/projects/new`} className={styles.btnPrimary}>
            + New Project
          </Link>
        </div>
      </div>

      {loading && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && (
        <div className={styles.detailGrid}>
          <div>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Projects</h2>
                <span className={styles.muted}>{projects.length} total</span>
              </div>
              {projects.length === 0 ? (
                <p className={styles.muted}>No projects yet.</p>
              ) : (
                <div className={styles.projectList}>
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/instructor/courses/${courseId}/projects/${project.id}`}
                      className={styles.projectRow}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <span className={`${styles.statusBadge} ${statusClass(project.status)}`}>
                        {project.status}
                      </span>
                      <strong>{project.title}</strong>
                      <span className={styles.muted} style={{ marginLeft: "auto" }}>
                        {project.deliveryMode}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Review Queue</h2>
                <Link href={`/instructor/courses/${courseId}/submissions`} className={styles.backLink}>
                  See all
                </Link>
              </div>
              {submissions.length === 0 ? (
                <p className={styles.muted}>No submissions pending review.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className={styles.submissionTable}>
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Status</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.slice(0, 5).map((sub) => (
                        <tr key={sub.id}>
                          <td>{sub.projectKey}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${statusClass(sub.status)}`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className={styles.mono}>
                            {new Date(sub.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
