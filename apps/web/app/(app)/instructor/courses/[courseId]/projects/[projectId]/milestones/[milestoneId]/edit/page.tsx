"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { apiFetch } from "../../../../../../../../../lib/session";
import styles from "../../../../../../../instructor.module.css";

type Milestone = {
  id: string;
  title: string;
  description: string;
  order: number;
  dueAt: string | null;
  isFinal: boolean;
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditMilestonePage({
  params
}: {
  params: Promise<{ courseId: string; projectId: string; milestoneId: string }>;
}) {
  const { courseId, projectId, milestoneId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(1);
  const [dueAt, setDueAt] = useState("");
  const [isFinal, setIsFinal] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch(`/v1/tracking/milestones/${milestoneId}`, { auth: true });
        if (!res.ok) throw new Error("Failed to load milestone.");
        const data = await res.json() as Milestone;
        setTitle(data.title);
        setDescription(data.description || "");
        setOrder(data.order);
        setDueAt(toDatetimeLocal(data.dueAt));
        setIsFinal(data.isFinal);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [milestoneId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      order,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      isFinal
    };

    try {
      const res = await apiFetch(`/v1/tracking/milestones/${milestoneId}`, {
        method: "PATCH",
        auth: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error || `Request failed (${res.status}).`);
      }
      router.push(`/instructor/courses/${courseId}/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.formPage}>
        <p className={styles.muted}>Loading milestone…</p>
      </div>
    );
  }

  return (
    <div className={styles.formPage}>
      <div>
        <p className={styles.breadcrumb}>
          <Link href="/instructor">Instructor</Link> /{" "}
          <Link href={`/instructor/courses/${courseId}`}>Course</Link> /{" "}
          <Link href={`/instructor/courses/${courseId}/projects/${projectId}`}>Project</Link> / Edit Milestone
        </p>
        <h1>Edit Milestone</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className={styles.formSection}>
        <div className={styles.formGroup}>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="order">Order</label>
          <input
            id="order"
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
            style={{ width: 100 }}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="dueAt">Due Date</label>
          <input
            id="dueAt"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isFinal}
              onChange={(e) => setIsFinal(e.target.checked)}
            />
            Final milestone (marks project completion)
          </label>
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={submitting}>
            {submitting ? "Saving…" : "Save Changes"}
          </button>
          <Link
            href={`/instructor/courses/${courseId}/projects/${projectId}`}
            className={styles.backLink}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
