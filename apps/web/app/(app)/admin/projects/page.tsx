"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/session";
import styles from "../../instructor/instructor.module.css";

type Project = {
  id: string;
  title: string;
  status: string;
  deliveryMode: string;
  courseId: string;
};

type CourseGroup = {
  course: { id: string; title: string; courseCode: string; termLabel: string };
  projects: Project[];
};

export default function AdminProjectsPage() {
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/v1/admin/projects", { auth: true });
        if (!res.ok) throw new Error("Failed to load projects.");
        const data = await res.json() as { courses: CourseGroup[] };
        setGroups(data.courses || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleArchive(projectId: string) {
    if (!confirm("Archive this project? Students will no longer be able to submit.")) return;
    setArchiving(projectId);
    try {
      const res = await apiFetch(`/v1/admin/projects/${projectId}/archive`, {
        method: "POST",
        auth: true
      });
      if (!res.ok) throw new Error("Archive failed.");
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          projects: group.projects.map((p) =>
            p.id === projectId ? { ...p, status: "archived" } : p
          )
        }))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Archive failed.");
    } finally {
      setArchiving(null);
    }
  }

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
            <Link href="/admin">Admin</Link> / Projects
          </p>
          <h1>All Projects</h1>
        </div>
      </div>

      {loading && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && !error && groups.length === 0 && (
        <p className={styles.muted}>No courses or projects found.</p>
      )}

      {groups.map(({ course, projects }) => (
        <div key={course.id} className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>
              <span className={styles.courseCode}>{course.courseCode}</span>{" "}
              {course.title}
              <span className={styles.muted} style={{ marginLeft: 8, fontWeight: 400, fontSize: 13 }}>
                {course.termLabel}
              </span>
            </h2>
            <span className={styles.muted}>{projects.length} project{projects.length !== 1 ? "s" : ""}</span>
          </div>

          {projects.length === 0 ? (
            <p className={styles.muted}>No projects in this course.</p>
          ) : (
            <table className={styles.submissionTable}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td><strong>{project.title}</strong></td>
                    <td className={styles.muted}>{project.deliveryMode}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${statusClass(project.status)}`}>
                        {project.status}
                      </span>
                    </td>
                    <td>
                      {project.status !== "archived" && (
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          disabled={archiving === project.id}
                          onClick={() => void handleArchive(project.id)}
                        >
                          {archiving === project.id ? "Archiving…" : "Archive"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
