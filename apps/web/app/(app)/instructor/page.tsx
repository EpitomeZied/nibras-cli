"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/session";
import styles from "./instructor.module.css";

type Course = {
  id: string;
  slug: string;
  title: string;
  termLabel: string;
  courseCode: string;
  isActive: boolean;
};

export default function InstructorPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/v1/tracking/courses", { auth: true });
        if (!res.ok) throw new Error("Failed to load courses.");
        const data = await res.json() as Course[];
        setCourses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Instructor</h1>
          <p className={styles.subtitle}>Manage your courses and review student submissions.</p>
        </div>
        <Link href="/instructor/courses/new" className={styles.btnPrimary}>
          + New Course
        </Link>
      </div>

      {loading && <p className={styles.muted}>Loading courses…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && !error && courses.length === 0 && (
        <div className={styles.emptyState}>
          <p>No courses yet.</p>
          <Link href="/instructor/courses/new" className={styles.btnPrimary}>
            Create your first course
          </Link>
        </div>
      )}

      {courses.length > 0 && (
        <div className={styles.courseGrid}>
          {courses.map((course) => (
            <Link key={course.id} href={`/instructor/courses/${course.id}`} className={styles.courseCard}>
              <span className={styles.courseCode}>{course.courseCode}</span>
              <strong>{course.title}</strong>
              <span className={styles.muted}>{course.termLabel}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
