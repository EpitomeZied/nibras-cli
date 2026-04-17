'use client';

import Link from 'next/link';
import type { StudentProgramPlan } from '@nibras/contracts';
import { apiFetch } from '../../../lib/session';
import { useFetch } from '../../../lib/use-fetch';
import SectionNav from '../../_components/section-nav';
import { plannerSections } from '../../_components/workspace-sections';
import styles from '../../instructor/instructor.module.css';

export default function PlannerTrackPage() {
  const {
    data: plan,
    loading,
    error,
    reload,
  } = useFetch<StudentProgramPlan>('/v1/programs/student/me');

  async function selectTrack(trackId: string) {
    await apiFetch('/v1/programs/student/me/select-track', {
      method: 'POST',
      auth: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trackId }),
    });
    reload();
  }

  return (
    <div className={styles.page}>
      <SectionNav
        eyebrow="Student Planner"
        title="Choose your academic track"
        description="Select the specialization path attached to your program version. Track selection follows the current year gate in your program policy."
        items={plannerSections}
        actions={
          <Link href="/planner" className={styles.btnSecondary}>
            Back to planner
          </Link>
        }
      />

      {loading && <p className={styles.muted}>Loading tracks…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {plan && (
        <>
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Current track</span>
              <strong>{plan.selectedTrack?.title ?? 'Not selected'}</strong>
              <p>{plan.program.code}</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Selection status</span>
              <strong>{plan.canSelectTrack ? 'Open' : 'Locked'}</strong>
              <p>
                {plan.canSelectTrack
                  ? 'You can select or update now.'
                  : `Unlocks in Year ${plan.version.trackSelectionMinYear}.`}
              </p>
            </article>
          </div>

          <div className={styles.courseGrid}>
            {plan.availableTracks.map((track) => {
              const selected = plan.selectedTrack?.id === track.id;
              return (
                <div key={track.id} className={styles.courseCard}>
                  <span className={styles.courseCode}>{track.slug}</span>
                  <h3>{track.title}</h3>
                  <p className={styles.muted}>
                    {track.description || 'Track specialization path.'}
                  </p>
                  <p className={styles.muted}>Opens from Year {track.selectionYearStart}</p>
                  <button
                    type="button"
                    className={selected ? styles.btnSecondary : styles.btnPrimary}
                    disabled={selected || (!plan.canSelectTrack && !selected)}
                    onClick={() => void selectTrack(track.id)}
                  >
                    {selected ? 'Selected' : plan.canSelectTrack ? 'Select track' : 'Track locked'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
