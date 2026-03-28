"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { apiFetch } from "../../../../../../lib/session";
import styles from "../../../../instructor.module.css";

type RubricItem = { criterion: string; maxScore: number };
type ResourceItem = { label: string; url: string };

type Project = {
  id: string;
  title: string;
  description: string;
  status: string;
  deliveryMode: string;
  rubric: RubricItem[];
  resources: ResourceItem[];
};

type Milestone = {
  id: string;
  title: string;
  description: string;
  order: number;
  dueAt: string | null;
  dueDateLabel: string;
  status: string;
  statusLabel: string;
  isFinal: boolean;
};

export default function ProjectDetailPage({
  params
}: {
  params: Promise<{ courseId: string; projectId: string }>;
}) {
  const { courseId, projectId } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [projRes, msRes] = await Promise.all([
          apiFetch(`/v1/tracking/projects/${projectId}`, { auth: true }),
          apiFetch(`/v1/tracking/projects/${projectId}/milestones`, { auth: true })
        ]);
        if (!projRes.ok) throw new Error("Failed to load project.");
        const projData = await projRes.json() as Project;
        setProject(projData);
        if (msRes.ok) {
          const msData = await msRes.json() as Milestone[];
          setMilestones(msData.sort((a, b) => a.order - b.order));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  async function handleDeleteMilestone(milestoneId: string) {
    if (!confirm("Delete this milestone? This cannot be undone.")) return;
    setDeleting(milestoneId);
    try {
      const res = await apiFetch(`/v1/tracking/milestones/${milestoneId}`, {
        method: "DELETE",
        auth: true
      });
      if (!res.ok) throw new Error("Delete failed.");
      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(null);
    }
  }

  function statusClass(status: string) {
    if (status === "published" || status === "approved" || status === "open") return styles.statusPublished;
    if (status === "archived" || status === "failed") return styles.statusArchived;
    return styles.statusDraft;
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error ?? "Project not found."}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href="/instructor">Instructor</Link> /{" "}
            <Link href={`/instructor/courses/${courseId}`}>Course</Link> / {project.title}
          </p>
          <h1>{project.title}</h1>
          <span className={`${styles.statusBadge} ${statusClass(project.status)}`} style={{ marginTop: 4, display: "inline-block" }}>
            {project.status}
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link
            href={`/instructor/courses/${courseId}/projects/${projectId}/edit`}
            className={styles.btnSecondary}
          >
            Edit Project
          </Link>
          <Link
            href={`/instructor/courses/${courseId}/projects/${projectId}/milestones/new`}
            className={styles.btnPrimary}
          >
            + Add Milestone
          </Link>
        </div>
      </div>

      <div className={styles.detailGrid}>
        {/* Left column: project meta */}
        <div>
          {project.description && (
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Description</h2>
              </div>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{project.description}</p>
            </div>
          )}

          {project.rubric.length > 0 && (
            <div className={styles.panel} style={{ marginTop: 16 }}>
              <div className={styles.panelHeader}>
                <h2>Rubric</h2>
              </div>
              <table className={styles.submissionTable}>
                <thead>
                  <tr>
                    <th>Criterion</th>
                    <th>Max Score</th>
                  </tr>
                </thead>
                <tbody>
                  {project.rubric.map((item, i) => (
                    <tr key={i}>
                      <td>{item.criterion}</td>
                      <td className={styles.mono}>{item.maxScore} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {project.resources.length > 0 && (
            <div className={styles.panel} style={{ marginTop: 16 }}>
              <div className={styles.panelHeader}>
                <h2>Resources</h2>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
                {project.resources.map((res, i) => (
                  <li key={i}>
                    <a href={res.url} target="_blank" rel="noopener noreferrer">{res.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column: milestones */}
        <div>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Milestones</h2>
              <span className={styles.muted}>{milestones.length} total</span>
            </div>
            {milestones.length === 0 ? (
              <p className={styles.muted}>No milestones yet. Add one to define submission checkpoints.</p>
            ) : (
              <table className={styles.submissionTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((ms) => (
                    <tr key={ms.id}>
                      <td className={styles.mono}>{ms.order}</td>
                      <td>
                        <strong>{ms.title}</strong>
                        {ms.isFinal && (
                          <span className={styles.muted} style={{ marginLeft: 6, fontSize: 11 }}>(final)</span>
                        )}
                      </td>
                      <td className={styles.mono} style={{ whiteSpace: "nowrap" }}>
                        {ms.dueDateLabel}
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${statusClass(ms.status)}`}>
                          {ms.statusLabel}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className={styles.btnSecondary}
                            style={{ padding: "3px 8px", fontSize: "12px" }}
                            onClick={() =>
                              router.push(
                                `/instructor/courses/${courseId}/projects/${projectId}/milestones/${ms.id}/edit`
                              )
                            }
                          >
                            Edit
                          </button>
                          <button
                            className={styles.btnSecondary}
                            style={{ padding: "3px 8px", fontSize: "12px", color: "var(--error, #e53e3e)" }}
                            disabled={deleting === ms.id}
                            onClick={() => void handleDeleteMilestone(ms.id)}
                          >
                            {deleting === ms.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
