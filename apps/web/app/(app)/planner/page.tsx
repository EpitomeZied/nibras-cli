'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ProgramSummary, StudentProgramPlan } from '@nibras/contracts';
import { apiFetch } from '../../lib/session';
import { useFetch } from '../../lib/use-fetch';
import SectionNav from '../_components/section-nav';
import { plannerSections } from '../_components/workspace-sections';
import styles from '../instructor/instructor.module.css';

type DraftPlannedCourse = {
  catalogCourseId: string;
  plannedYear: number;
  plannedTerm: 'fall' | 'spring';
  sourceType: 'standard' | 'transfer' | 'petition' | 'manual';
  note: string | null;
};

export default function PlannerPage() {
  const {
    data: programs,
    loading: loadingPrograms,
    error: programsError,
  } = useFetch<ProgramSummary[]>('/v1/programs');
  const {
    data: plan,
    loading: loadingPlan,
    error: planError,
    reload,
  } = useFetch<StudentProgramPlan>('/v1/programs/student/me');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftCourses, setDraftCourses] = useState<DraftPlannedCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedTerm, setSelectedTerm] = useState<'fall' | 'spring'>('fall');

  useEffect(() => {
    if (!plan) return;
    setDraftCourses(
      plan.plannedCourses.map((course) => ({
        catalogCourseId: course.catalogCourseId,
        plannedYear: course.plannedYear,
        plannedTerm: course.plannedTerm,
        sourceType: course.sourceType,
        note: course.note,
      }))
    );
  }, [plan]);

  async function enroll(programId: string) {
    setEnrollingId(programId);
    try {
      await apiFetch(`/v1/programs/${programId}/enroll`, {
        method: 'POST',
        auth: true,
      });
      reload();
    } finally {
      setEnrollingId(null);
    }
  }

  async function savePlan() {
    setSaveError(null);
    setSaving(true);
    try {
      const response = await apiFetch('/v1/programs/student/me/plan', {
        method: 'PATCH',
        auth: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plannedCourses: draftCourses }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }
      reload();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  }

  function addCourse() {
    if (!selectedCourseId) return;
    setDraftCourses((current) => {
      if (current.some((entry) => entry.catalogCourseId === selectedCourseId)) return current;
      return [
        ...current,
        {
          catalogCourseId: selectedCourseId,
          plannedYear: selectedYear,
          plannedTerm: selectedTerm,
          sourceType: 'standard',
          note: null,
        },
      ];
    });
    setSelectedCourseId('');
  }

  function removeCourse(catalogCourseId: string) {
    setDraftCourses((current) =>
      current.filter((entry) => entry.catalogCourseId !== catalogCourseId)
    );
  }

  const notEnrolled =
    !loadingPlan &&
    !plan &&
    (planError.includes('Student program not found') || planError.includes('Request failed (404)'));

  return (
    <div className={styles.page}>
      <SectionNav
        eyebrow="Student Planner"
        title="University-style program planning"
        description="Organize your degree path, choose a track when eligible, file petitions, and keep a printable record of requirement progress."
        items={plannerSections}
        actions={
          <>
            <Link href="/planner/track" className={styles.btnSecondary}>
              Choose Track
            </Link>
            <Link href="/planner/sheet" className={styles.btnPrimary}>
              Printable Sheet
            </Link>
          </>
        }
      />

      {(loadingPrograms || loadingPlan) && <p className={styles.muted}>Loading planner…</p>}
      {programsError && <p className={styles.errorText}>{programsError}</p>}
      {saveError && <p className={styles.errorText}>{saveError}</p>}

      {notEnrolled && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Enroll in a program</h2>
            <span className={styles.muted}>{programs?.length ?? 0} available</span>
          </div>
          <div className={styles.courseGrid}>
            {(programs ?? []).map((program) => (
              <div key={program.id} className={styles.courseCard}>
                <span className={styles.courseCode}>{program.code}</span>
                <h3>{program.title}</h3>
                <p className={styles.muted}>{program.academicYear}</p>
                <p className={styles.muted}>{program.totalUnitRequirement} total units</p>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => void enroll(program.id)}
                  disabled={enrollingId === program.id}
                >
                  {enrollingId === program.id ? 'Enrolling…' : 'Enroll'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan && (
        <>
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Program</span>
              <strong>{plan.program.code}</strong>
              <p>{plan.program.title}</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Track</span>
              <strong>{plan.selectedTrack?.title ?? 'Not selected'}</strong>
              <p>
                {plan.canSelectTrack
                  ? 'Selection open now'
                  : `Opens in Year ${plan.version.trackSelectionMinYear}`}
              </p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Approvals</span>
              <strong>{plan.approvals.length}</strong>
              <p>
                {plan.approvals.filter((approval) => approval.status === 'approved').length}{' '}
                approved
              </p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Requirement Audit</span>
              <strong>
                {plan.decisions.filter((decision) => decision.status === 'satisfied').length}
              </strong>
              <p>{plan.decisions.length} requirement groups tracked</p>
            </article>
          </div>

          <div className={styles.detailGrid}>
            <div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h2>Current Plan</h2>
                  <span className={styles.statusBadge}>{plan.status.replace(/_/g, ' ')}</span>
                </div>
                <div className={styles.projectList}>
                  <div className={styles.projectRow}>
                    <strong>Program</strong>
                    <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                      {plan.program.title}
                    </span>
                  </div>
                  <div className={styles.projectRow}>
                    <strong>Version</strong>
                    <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                      {plan.version.versionLabel}
                    </span>
                  </div>
                  <div className={styles.projectRow}>
                    <strong>Track</strong>
                    <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                      {plan.selectedTrack?.title ?? 'Not selected'}
                    </span>
                  </div>
                  <div className={styles.projectRow}>
                    <strong>Status</strong>
                    <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                      {plan.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className={styles.projectRow}>
                    <strong>Track gate</strong>
                    <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                      {plan.canSelectTrack
                        ? 'Open'
                        : `Locked until Year ${plan.version.trackSelectionMinYear}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.panel} style={{ marginTop: 20 }}>
                <div className={styles.panelHeader}>
                  <h2>Plan Courses</h2>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => void savePlan()}
                    disabled={saving || plan.isLocked}
                  >
                    {saving ? 'Saving…' : 'Save plan'}
                  </button>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="catalogCourseId">Add catalog course</label>
                  <select
                    id="catalogCourseId"
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                  >
                    <option value="">Select a course</option>
                    {plan.catalogCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.subjectCode} {course.catalogNumber} · {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 18 }}>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label htmlFor="plannedYear">Year</label>
                    <select
                      id="plannedYear"
                      value={selectedYear}
                      onChange={(event) => setSelectedYear(Number(event.target.value))}
                    >
                      {[1, 2, 3, 4].map((year) => (
                        <option key={year} value={year}>
                          Year {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label htmlFor="plannedTerm">Term</label>
                    <select
                      id="plannedTerm"
                      value={selectedTerm}
                      onChange={(event) => setSelectedTerm(event.target.value as 'fall' | 'spring')}
                    >
                      <option value="fall">Fall</option>
                      <option value="spring">Spring</option>
                    </select>
                  </div>
                  <button type="button" className={styles.btnSecondary} onClick={addCourse}>
                    Add course
                  </button>
                </div>

                {draftCourses.length === 0 ? (
                  <p className={styles.muted}>No planned courses yet.</p>
                ) : (
                  <div className={styles.projectList}>
                    {draftCourses.map((plannedCourse) => {
                      const course = plan.catalogCourses.find(
                        (entry) => entry.id === plannedCourse.catalogCourseId
                      );
                      if (!course) return null;
                      return (
                        <div key={plannedCourse.catalogCourseId} className={styles.projectRow}>
                          <strong>
                            {course.subjectCode} {course.catalogNumber}
                          </strong>
                          <span className={styles.muted}>
                            {course.title} · Year {plannedCourse.plannedYear}{' '}
                            {plannedCourse.plannedTerm}
                          </span>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            style={{ marginLeft: 'auto' }}
                            onClick={() => removeCourse(plannedCourse.catalogCourseId)}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h2>Requirement Audit</h2>
                  <span className={styles.muted}>{plan.decisions.length} groups</span>
                </div>
                <div className={styles.projectList}>
                  {plan.decisions.map((decision) => {
                    const group = plan.requirementGroups.find(
                      (entry) => entry.id === decision.requirementGroupId
                    );
                    return (
                      <div key={decision.id} className={`${styles.projectRow} ${styles.auditRow}`}>
                        <div>
                          <strong>{group?.title ?? decision.requirementGroupId}</strong>
                          <p className={styles.muted}>{group?.category ?? 'requirement group'}</p>
                        </div>
                        <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                          {decision.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.panel} style={{ marginTop: 20 }}>
                <div className={styles.panelHeader}>
                  <h2>Approvals</h2>
                </div>
                <div className={styles.projectList}>
                  {plan.approvals.map((approval) => (
                    <div key={approval.id} className={styles.projectRow}>
                      <strong>{approval.stage}</strong>
                      <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                        {approval.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
