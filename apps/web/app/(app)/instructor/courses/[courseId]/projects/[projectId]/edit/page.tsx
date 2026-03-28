"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { apiFetch } from "../../../../../../../lib/session";
import styles from "../../../../../instructor.module.css";

type RubricRow = { criterion: string; maxScore: number };
type ResourceRow = { label: string; url: string };

type Project = {
  id: string;
  title: string;
  description: string;
  status: string;
  deliveryMode: string;
  rubric: RubricRow[];
  resources: ResourceRow[];
};

export default function EditProjectPage({
  params
}: {
  params: Promise<{ courseId: string; projectId: string }>;
}) {
  const { courseId, projectId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("individual");
  const [status, setStatus] = useState("draft");
  const [rubric, setRubric] = useState<RubricRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch(`/v1/tracking/projects/${projectId}`, { auth: true });
        if (!res.ok) throw new Error("Failed to load project.");
        const data = await res.json() as Project;
        setTitle(data.title);
        setDescription(data.description || "");
        setDeliveryMode(data.deliveryMode);
        setStatus(data.status);
        setRubric(data.rubric.length > 0 ? data.rubric : []);
        setResources(data.resources || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  function addRubricRow() {
    setRubric((prev) => [...prev, { criterion: "", maxScore: 10 }]);
  }

  function removeRubricRow(index: number) {
    setRubric((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRubricRow(index: number, field: keyof RubricRow, value: string | number) {
    setRubric((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  function addResourceRow() {
    setResources((prev) => [...prev, { label: "", url: "" }]);
  }

  function removeResourceRow(index: number) {
    setResources((prev) => prev.filter((_, i) => i !== index));
  }

  function updateResourceRow(index: number, field: keyof ResourceRow, value: string) {
    setResources((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      deliveryMode,
      status,
      rubric: rubric.filter((row) => row.criterion.trim()).map((row) => ({
        criterion: row.criterion.trim(),
        maxScore: Number(row.maxScore)
      })),
      resources: resources.filter((row) => row.label.trim() && row.url.trim()).map((row) => ({
        label: row.label.trim(),
        url: row.url.trim()
      }))
    };

    try {
      const res = await apiFetch(`/v1/tracking/projects/${projectId}`, {
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
        <p className={styles.muted}>Loading project…</p>
      </div>
    );
  }

  return (
    <div className={styles.formPage}>
      <div>
        <p className={styles.breadcrumb}>
          <Link href="/instructor">Instructor</Link> /{" "}
          <Link href={`/instructor/courses/${courseId}`}>Course</Link> /{" "}
          <Link href={`/instructor/courses/${courseId}/projects/${projectId}`}>Project</Link> / Edit
        </p>
        <h1>Edit Project</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className={styles.formSection}>
        <div className={styles.formGroup}>
          <label htmlFor="title">Project Title</label>
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
          <label htmlFor="deliveryMode">Delivery Mode</label>
          <select
            id="deliveryMode"
            value={deliveryMode}
            onChange={(e) => setDeliveryMode(e.target.value)}
          >
            <option value="individual">Individual</option>
            <option value="team">Team</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Rubric */}
        <div className={styles.dynamicSection}>
          <div className={styles.dynamicSectionHeader}>
            <span className={styles.dynamicSectionLabel}>Grading Rubric</span>
            <button type="button" className={styles.btnAddRow} onClick={addRubricRow}>
              + Add criterion
            </button>
          </div>
          {rubric.length === 0 && (
            <p className={styles.muted} style={{ fontSize: "13px" }}>No rubric criteria.</p>
          )}
          {rubric.map((row, index) => (
            <div key={index} className={styles.dynamicRow}>
              <input
                type="text"
                placeholder="Criterion description"
                value={row.criterion}
                onChange={(e) => updateRubricRow(index, "criterion", e.target.value)}
                className={styles.dynamicRowMain}
              />
              <input
                type="number"
                min={0}
                max={1000}
                value={row.maxScore}
                onChange={(e) => updateRubricRow(index, "maxScore", parseFloat(e.target.value) || 0)}
                className={styles.dynamicRowScore}
                title="Max score"
              />
              <span className={styles.dynamicRowUnit}>pts</span>
              <button
                type="button"
                className={styles.btnRemoveRow}
                onClick={() => removeRubricRow(index)}
                aria-label="Remove criterion"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Resources */}
        <div className={styles.dynamicSection}>
          <div className={styles.dynamicSectionHeader}>
            <span className={styles.dynamicSectionLabel}>Resources</span>
            <button type="button" className={styles.btnAddRow} onClick={addResourceRow}>
              + Add resource
            </button>
          </div>
          {resources.map((row, index) => (
            <div key={index} className={styles.dynamicRow}>
              <input
                type="text"
                placeholder="Label"
                value={row.label}
                onChange={(e) => updateResourceRow(index, "label", e.target.value)}
                className={styles.dynamicRowLabel}
              />
              <input
                type="url"
                placeholder="https://…"
                value={row.url}
                onChange={(e) => updateResourceRow(index, "url", e.target.value)}
                className={styles.dynamicRowMain}
              />
              <button
                type="button"
                className={styles.btnRemoveRow}
                onClick={() => removeResourceRow(index)}
                aria-label="Remove resource"
              >
                ×
              </button>
            </div>
          ))}
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
