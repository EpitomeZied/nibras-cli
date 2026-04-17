'use client';

import Link from 'next/link';
import { use } from 'react';
import type { Petition } from '@nibras/contracts';
import { apiFetch } from '../../../../../../lib/session';
import { useFetch } from '../../../../../../lib/use-fetch';
import styles from '../../../../instructor.module.css';

export default function ProgramStudentPage({
  params,
}: {
  params: Promise<{ programId: string; studentProgramId: string }>;
}) {
  const { programId, studentProgramId } = use(params);
  const {
    data: petitions,
    loading,
    error,
    reload,
  } = useFetch<Petition[]>(`/v1/programs/${programId}/petitions`);
  const studentPetitions = (petitions ?? []).filter(
    (entry) => entry.studentProgramId === studentProgramId
  );

  async function submitApproval(stage: 'advisor' | 'department', status: 'approved' | 'rejected') {
    await apiFetch(`/v1/programs/${programId}/approvals/${studentProgramId}/${stage}`, {
      method: 'POST',
      auth: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, notes: null }),
    });
    reload();
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href={`/instructor/programs/${programId}/petitions`}>Petitions</Link> / Student
          </p>
          <h1>Student Program Record</h1>
        </div>
      </div>

      {loading && <p className={styles.muted}>Loading student record…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.detailGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Approvals</h2>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void submitApproval('advisor', 'approved')}
            >
              Advisor approve
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void submitApproval('advisor', 'rejected')}
            >
              Advisor reject
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void submitApproval('department', 'approved')}
            >
              Department approve
            </button>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Petitions on record</h2>
          </div>
          {studentPetitions.length === 0 ? (
            <p className={styles.muted}>No petitions tied to this student program yet.</p>
          ) : (
            <div className={styles.projectList}>
              {studentPetitions.map((petition) => (
                <div key={petition.id} className={styles.projectRow}>
                  <div>
                    <strong>{petition.type.replace(/_/g, ' ')}</strong>
                    <p className={styles.muted}>{petition.justification}</p>
                  </div>
                  <span className={styles.muted}>{petition.status.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
