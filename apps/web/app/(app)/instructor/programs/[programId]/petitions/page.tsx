'use client';

import Link from 'next/link';
import { use } from 'react';
import type { Petition } from '@nibras/contracts';
import { apiFetch } from '../../../../../lib/session';
import { useFetch } from '../../../../../lib/use-fetch';
import SectionNav from '../../../../_components/section-nav';
import { programSections } from '../../../../_components/workspace-sections';
import styles from '../../../instructor.module.css';

export default function ProgramPetitionsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const {
    data: petitions,
    loading,
    error,
    reload,
  } = useFetch<Petition[]>(`/v1/programs/${programId}/petitions`);

  async function reviewPetition(petitionId: string, status: 'approved' | 'rejected') {
    await apiFetch(`/v1/programs/${programId}/petitions/${petitionId}`, {
      method: 'PATCH',
      auth: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, reviewerNotes: null }),
    });
    reload();
  }

  return (
    <div className={styles.page}>
      <SectionNav
        eyebrow="Program Builder"
        title="Program Petitions"
        description="Review student exceptions tied to requirement groups and move each petition through advisor or department approval."
        items={programSections(programId)}
      />

      {loading && <p className={styles.muted}>Loading petitions…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Pending</span>
          <strong>
            {(petitions ?? []).filter((petition) => petition.status.startsWith('pending')).length}
          </strong>
          <p>Awaiting review</p>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Approved</span>
          <strong>
            {(petitions ?? []).filter((petition) => petition.status === 'approved').length}
          </strong>
          <p>Accepted exceptions</p>
        </article>
      </div>

      <div className={styles.projectList}>
        {(petitions ?? []).map((petition) => (
          <div key={petition.id} className={`${styles.projectRow} ${styles.petitionRow}`}>
            <div>
              <strong>{petition.type.replace(/_/g, ' ')}</strong>
              <p className={styles.muted}>{petition.justification}</p>
              <Link
                href={`/instructor/programs/${programId}/students/${petition.studentProgramId}`}
                className={styles.backLink}
              >
                Open student record
              </Link>
            </div>
            <span className={styles.muted}>{petition.status.replace(/_/g, ' ')}</span>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void reviewPetition(petition.id, 'approved')}
            >
              Approve
            </button>
            <button
              type="button"
              className={styles.btnDanger}
              onClick={() => void reviewPetition(petition.id, 'rejected')}
            >
              Reject
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
