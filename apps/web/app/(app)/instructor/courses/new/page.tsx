"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../../lib/session";
import styles from "../../instructor.module.css";

export default function NewCoursePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      slug: (form.get("slug") as string).trim().toLowerCase(),
      title: (form.get("title") as string).trim(),
      termLabel: (form.get("termLabel") as string).trim(),
      courseCode: (form.get("courseCode") as string).trim()
    };

    try {
      const res = await apiFetch("/v1/tracking/courses", {
        method: "POST",
        auth: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error || `Request failed (${res.status}).`);
      }
      const course = await res.json() as { id: string };
      router.push(`/instructor/courses/${course.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.formPage}>
      <div>
        <p className={styles.breadcrumb}>
          <Link href="/instructor">Instructor</Link> / New Course
        </p>
        <h1>Create Course</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className={styles.formSection}>
        <div className={styles.formGroup}>
          <label htmlFor="title">Course Title</label>
          <input id="title" name="title" type="text" required placeholder="e.g. Computer Security" />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="courseCode">Course Code</label>
          <input id="courseCode" name="courseCode" type="text" required placeholder="e.g. CS161" />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="slug">Slug</label>
          <input id="slug" name="slug" type="text" required placeholder="e.g. cs161" pattern="[a-z0-9-]+" />
          <span className={styles.fieldHint}>Lowercase letters, numbers, and hyphens only.</span>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="termLabel">Term</label>
          <input id="termLabel" name="termLabel" type="text" required placeholder="e.g. Spring 2026" />
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={submitting}>
            {submitting ? "Creating…" : "Create Course"}
          </button>
          <Link href="/instructor" className={styles.backLink}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
