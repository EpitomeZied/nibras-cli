'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Petition, StudentProgramPlan } from '@nibras/contracts';
import { apiFetch } from '../../../lib/session';
import { useFetch } from '../../../lib/use-fetch';
import SectionNav from '../../_components/section-nav';
import { plannerSections } from '../../_components/workspace-sections';
import styles from '../../instructor/instructor.module.css';

export default function PlannerPetitionsPage() {
  const {
    data: plan,
    loading: loadingPlan,
    error: planError,
  } = useFetch<StudentProgramPlan>('/v1/programs/student/me');
  const {
    data: petitions,
    loading: loadingPetitions,
    error: petitionsError,
    reload,
  } = useFetch<Petition[]>('/v1/programs/student/me/petitions');
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<'transfer_credit' | 'substitution' | 'waiver'>(
    'transfer_credit'
  );
  const [justification, setJustification] = useState('');
  const [targetRequirementGroupId, setTargetRequirementGroupId] = useState('');
  const [originalCatalogCourseId, setOriginalCatalogCourseId] = useState('');
  const [substituteCatalogCourseId, setSubstituteCatalogCourseId] = useState('');

  async function submitPetition() {
    setSubmitting(true);
    try {
      await apiFetch('/v1/programs/student/me/petitions', {
        method: 'POST',
        auth: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type,
          justification,
          targetRequirementGroupId: targetRequirementGroupId || null,
          originalCatalogCourseId: originalCatalogCourseId || null,
          substituteCatalogCourseId: substituteCatalogCourseId || null,
        }),
      });
      setJustification('');
      setOriginalCatalogCourseId('');
      setSubstituteCatalogCourseId('');
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <SectionNav
        eyebrow="Student Planner"
        title="Petitions and exceptions"
        description="Request transfer credit, substitutions, or waivers and track each review state alongside your program record."
        items={plannerSections}
        actions={
          <Link href="/planner" className={styles.btnSecondary}>
            Back to planner
          </Link>
        }
      />

      {(loadingPlan || loadingPetitions) && <p className={styles.muted}>Loading petitions…</p>}
      {planError && <p className={styles.errorText}>{planError}</p>}
      {petitionsError && <p className={styles.errorText}>{petitionsError}</p>}

      {plan && (
        <>
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Submitted</span>
              <strong>{petitions?.length ?? 0}</strong>
              <p>Total requests on file</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Pending</span>
              <strong>
                {
                  (petitions ?? []).filter((petition) => petition.status.startsWith('pending'))
                    .length
                }
              </strong>
              <p>Awaiting advisor or department review</p>
            </article>
          </div>

          <div className={styles.detailGrid}>
            <div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h2>Submit a petition</h2>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="petitionType">Type</label>
                  <select
                    id="petitionType"
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as 'transfer_credit' | 'substitution' | 'waiver')
                    }
                  >
                    <option value="transfer_credit">Transfer / AP credit</option>
                    <option value="substitution">Course substitution</option>
                    <option value="waiver">Requirement waiver</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="targetRequirementGroupId">Requirement group</label>
                  <select
                    id="targetRequirementGroupId"
                    value={targetRequirementGroupId}
                    onChange={(event) => setTargetRequirementGroupId(event.target.value)}
                  >
                    <option value="">Optional target</option>
                    {plan.requirementGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="originalCatalogCourseId">Original / satisfied course</label>
                  <select
                    id="originalCatalogCourseId"
                    value={originalCatalogCourseId}
                    onChange={(event) => setOriginalCatalogCourseId(event.target.value)}
                  >
                    <option value="">Optional course</option>
                    {plan.catalogCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.subjectCode} {course.catalogNumber} · {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="substituteCatalogCourseId">Substitute course</label>
                  <select
                    id="substituteCatalogCourseId"
                    value={substituteCatalogCourseId}
                    onChange={(event) => setSubstituteCatalogCourseId(event.target.value)}
                  >
                    <option value="">Optional substitute</option>
                    {plan.catalogCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.subjectCode} {course.catalogNumber} · {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="justification">Justification</label>
                  <textarea
                    id="justification"
                    value={justification}
                    onChange={(event) => setJustification(event.target.value)}
                    placeholder="Explain why this exception is needed."
                    rows={5}
                  />
                </div>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => void submitPetition()}
                  disabled={submitting || !justification.trim()}
                >
                  {submitting ? 'Submitting…' : 'Submit petition'}
                </button>
              </div>
            </div>

            <div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h2>Submitted petitions</h2>
                </div>
                {(petitions ?? []).length === 0 ? (
                  <p className={styles.muted}>No petitions submitted yet.</p>
                ) : (
                  <div className={styles.projectList}>
                    {(petitions ?? []).map((petition) => (
                      <div key={petition.id} className={styles.projectRow}>
                        <div>
                          <strong>{petition.type.replace(/_/g, ' ')}</strong>
                          <p className={styles.muted}>{petition.justification}</p>
                        </div>
                        <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                          {petition.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
