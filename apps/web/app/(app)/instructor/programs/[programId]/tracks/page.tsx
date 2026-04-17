'use client';

import { use } from 'react';
import { useState } from 'react';
import type { ProgramSummary, ProgramVersionDetail } from '@nibras/contracts';
import { apiFetch } from '../../../../../lib/session';
import { useFetch } from '../../../../../lib/use-fetch';
import SectionNav from '../../../../_components/section-nav';
import { programSections } from '../../../../_components/workspace-sections';
import styles from '../../../instructor.module.css';

export default function ProgramTracksPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = use(params);
  const { data: programs } = useFetch<ProgramSummary[]>('/v1/programs');
  const program = (programs ?? []).find((entry) => entry.id === programId) || null;
  const detailPath = program?.activeVersionId
    ? `/v1/programs/${programId}/versions/${program.activeVersionId}`
    : null;
  const { data: detail, loading, error, reload } = useFetch<ProgramVersionDetail>(detailPath);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');

  async function createTrack() {
    if (!detail) return;
    await apiFetch(`/v1/programs/${programId}/tracks`, {
      method: 'POST',
      auth: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        programVersionId: detail.version.id,
        title,
        slug,
        description: '',
        selectionYearStart: detail.version.trackSelectionMinYear,
      }),
    });
    setTitle('');
    setSlug('');
    reload();
  }

  return (
    <div className={styles.page}>
      <SectionNav
        eyebrow="Program Builder"
        title="Tracks"
        description="Define specialization paths and track-selection timing for students in the planner."
        items={programSections(programId)}
      />

      {loading && <p className={styles.muted}>Loading tracks…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {detail && (
        <>
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Configured tracks</span>
              <strong>{detail.tracks.length}</strong>
              <p>Selection starts Year {detail.version.trackSelectionMinYear}</p>
            </article>
          </div>

          <div className={styles.formSection}>
            <div className={styles.formGroup}>
              <label htmlFor="trackTitle">Track title</label>
              <input
                id="trackTitle"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="trackSlug">Track slug</label>
              <input
                id="trackSlug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <button type="button" className={styles.btnPrimary} onClick={() => void createTrack()}>
              Add track
            </button>
          </div>

          <div className={styles.courseGrid}>
            {detail.tracks.map((track) => (
              <div key={track.id} className={styles.courseCard}>
                <span className={styles.courseCode}>{track.slug}</span>
                <h3>{track.title}</h3>
                <p className={styles.muted}>{track.description || 'Track specialization path.'}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
