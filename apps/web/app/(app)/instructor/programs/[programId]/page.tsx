'use client';

import Link from 'next/link';
import { use } from 'react';
import type { ProgramSummary, ProgramVersionDetail } from '@nibras/contracts';
import { useFetch } from '../../../../lib/use-fetch';
import SectionNav from '../../../_components/section-nav';
import { programSections } from '../../../_components/workspace-sections';
import styles from '../../instructor.module.css';

export default function ProgramDetailPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = use(params);
  const {
    data: programs,
    loading: loadingPrograms,
    error: programsError,
  } = useFetch<ProgramSummary[]>('/v1/programs');
  const program = (programs ?? []).find((entry) => entry.id === programId) || null;
  const detailPath = program?.activeVersionId
    ? `/v1/programs/${programId}/versions/${program.activeVersionId}`
    : null;
  const {
    data: detail,
    loading: loadingDetail,
    error: detailError,
  } = useFetch<ProgramVersionDetail>(detailPath);

  return (
    <div className={styles.page}>
      <SectionNav
        eyebrow="Program Builder"
        title={program?.title ?? 'Program Detail'}
        description="Manage the current program version, course catalog, tracks, and requirement structure for academic planning workflows."
        items={programSections(programId)}
        actions={
          <>
            <Link
              href={`/instructor/programs/${programId}/requirements`}
              className={styles.btnSecondary}
            >
              Requirements
            </Link>
            <Link
              href={`/instructor/programs/${programId}/petitions`}
              className={styles.btnPrimary}
            >
              Petitions
            </Link>
          </>
        }
      />

      {(loadingPrograms || loadingDetail) && <p className={styles.muted}>Loading program…</p>}
      {programsError && <p className={styles.errorText}>{programsError}</p>}
      {detailError && <p className={styles.errorText}>{detailError}</p>}

      {program && detail && (
        <>
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Program</span>
              <strong>{program.code}</strong>
              <p>{program.academicYear}</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Version</span>
              <strong>{detail.version.versionLabel}</strong>
              <p>Track selection starts Year {detail.version.trackSelectionMinYear}</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Catalog</span>
              <strong>{detail.catalogCourses.length}</strong>
              <p>Courses in the active version</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Requirement Groups</span>
              <strong>{detail.requirementGroups.length}</strong>
              <p>{detail.tracks.length} tracks configured</p>
            </article>
          </div>

          <div className={styles.detailGrid}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Program Overview</h2>
              </div>
              <div className={styles.projectList}>
                <div className={styles.projectRow}>
                  <strong>Code</strong>
                  <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                    {program.code}
                  </span>
                </div>
                <div className={styles.projectRow}>
                  <strong>Academic year</strong>
                  <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                    {program.academicYear}
                  </span>
                </div>
                <div className={styles.projectRow}>
                  <strong>Active version</strong>
                  <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                    {detail.version.versionLabel}
                  </span>
                </div>
                <div className={styles.projectRow}>
                  <strong>Total units</strong>
                  <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                    {program.totalUnitRequirement}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Current Version Summary</h2>
              </div>
              <div className={styles.projectList}>
                <div className={styles.projectRow}>
                  <strong>Tracks</strong>
                  <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                    {detail.tracks.length}
                  </span>
                </div>
                <div className={styles.projectRow}>
                  <strong>Catalog courses</strong>
                  <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                    {detail.catalogCourses.length}
                  </span>
                </div>
                <div className={styles.projectRow}>
                  <strong>Requirement groups</strong>
                  <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                    {detail.requirementGroups.length}
                  </span>
                </div>
                <div className={styles.projectRow}>
                  <strong>Track selection year</strong>
                  <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                    Year {detail.version.trackSelectionMinYear}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
