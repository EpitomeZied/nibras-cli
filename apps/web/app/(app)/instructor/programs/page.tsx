'use client';

import Link from 'next/link';
import type { ProgramSummary } from '@nibras/contracts';
import { useFetch } from '../../../lib/use-fetch';
import styles from '../instructor.module.css';

export default function InstructorProgramsPage() {
  const { data: programs, loading, error } = useFetch<ProgramSummary[]>('/v1/programs');

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Academic Programs</h1>
          <p className={styles.subtitle}>
            Build the university-style planning layer: programs, catalogs, requirements, tracks, and
            petitions.
          </p>
        </div>
        <Link href="/instructor/programs/new" className={styles.btnPrimary}>
          + New Program
        </Link>
      </div>

      {loading && <p className={styles.muted}>Loading programs…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Programs</span>
          <strong>{programs?.length ?? 0}</strong>
          <p>Academic pathways currently defined</p>
        </article>
      </div>

      <div className={styles.courseGrid}>
        {(programs ?? []).map((program) => (
          <Link
            key={program.id}
            href={`/instructor/programs/${program.id}`}
            className={styles.courseCard}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <span className={styles.courseCode}>{program.code}</span>
            <h3>{program.title}</h3>
            <p className={styles.muted}>{program.academicYear}</p>
            <p className={styles.muted}>{program.totalUnitRequirement} units</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
