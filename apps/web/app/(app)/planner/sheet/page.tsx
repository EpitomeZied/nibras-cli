'use client';

import { useState } from 'react';
import type { ProgramSheetView } from '@nibras/contracts';
import { apiFetch } from '../../../lib/session';
import { useFetch } from '../../../lib/use-fetch';
import SectionNav from '../../_components/section-nav';
import { plannerSections } from '../../_components/workspace-sections';
import styles from '../../instructor/instructor.module.css';

export default function PlannerSheetPage() {
  const {
    data: sheet,
    loading,
    error,
    reload,
  } = useFetch<ProgramSheetView>('/v1/programs/student/me/sheet');
  const [generating, setGenerating] = useState(false);

  async function generateSheet() {
    setGenerating(true);
    try {
      await apiFetch('/v1/programs/student/me/generate-sheet', {
        method: 'POST',
        auth: true,
      });
      reload();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={styles.page}>
      <SectionNav
        eyebrow="Student Planner"
        title="Printable program sheet"
        description="Generate a snapshot of your requirement matches, petitions, approvals, and current track for advisor or department review."
        items={plannerSections}
        actions={
          <>
            <button type="button" className={styles.btnSecondary} onClick={() => window.print()}>
              Print
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void generateSheet()}
            >
              {generating ? 'Generating…' : 'Generate snapshot'}
            </button>
          </>
        }
      />

      {loading && <p className={styles.muted}>Loading sheet…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {sheet && (
        <>
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Program</span>
              <strong>{sheet.program.code}</strong>
              <p>{sheet.version.versionLabel}</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Track</span>
              <strong>{sheet.selectedTrack?.title ?? 'Not selected'}</strong>
              <p>{sheet.status.replace(/_/g, ' ')}</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Snapshot</span>
              <strong>{sheet.generatedAt ? 'Generated' : 'Draft'}</strong>
              <p>
                {sheet.generatedAt
                  ? new Date(sheet.generatedAt).toLocaleString()
                  : 'Generate a stored view when ready.'}
              </p>
            </article>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>
                {sheet.program.title} · {sheet.version.versionLabel}
              </h2>
              <span className={styles.muted}>
                {sheet.generatedAt
                  ? `Generated ${new Date(sheet.generatedAt).toLocaleString()}`
                  : 'Draft view'}
              </span>
            </div>

            <div className={styles.projectList}>
              <div className={styles.projectRow}>
                <strong>Student</strong>
                <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                  {sheet.student.username} · {sheet.student.email}
                </span>
              </div>
              <div className={styles.projectRow}>
                <strong>Track</strong>
                <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                  {sheet.selectedTrack?.title ?? 'Not selected'}
                </span>
              </div>
              <div className={styles.projectRow}>
                <strong>Status</strong>
                <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                  {sheet.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              {sheet.sections.map((section) => (
                <div
                  key={section.requirementGroupId}
                  className={styles.panel}
                  style={{ marginBottom: 16 }}
                >
                  <div className={styles.panelHeader}>
                    <h3>{section.title}</h3>
                    <span className={styles.muted}>{section.status.replace(/_/g, ' ')}</span>
                  </div>
                  <p className={styles.muted}>
                    Minimum {section.minCourses} courses · {section.minUnits} units
                  </p>
                  {section.notes ? <p className={styles.muted}>{section.notes}</p> : null}
                  {section.matchedCourses.length === 0 ? (
                    <p className={styles.muted}>No planned courses matched yet.</p>
                  ) : (
                    <div className={styles.projectList}>
                      {section.matchedCourses.map((course) => (
                        <div key={course.plannedCourseId} className={styles.projectRow}>
                          <strong>
                            {course.subjectCode} {course.catalogNumber}
                          </strong>
                          <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                            {course.title} · Year {course.plannedYear} {course.plannedTerm}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.detailGrid}>
              <div>
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <h2>Petitions</h2>
                  </div>
                  {sheet.petitions.length === 0 ? (
                    <p className={styles.muted}>No petitions on file.</p>
                  ) : (
                    <div className={styles.projectList}>
                      {sheet.petitions.map((petition) => (
                        <div key={petition.id} className={styles.projectRow}>
                          <strong>{petition.type.replace(/_/g, ' ')}</strong>
                          <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                            {petition.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <h2>Approvals</h2>
                  </div>
                  <div className={styles.projectList}>
                    {sheet.approvals.map((approval) => (
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

            <div className={styles.panel} style={{ marginTop: 20 }}>
              <div className={styles.panelHeader}>
                <h2>Policies</h2>
              </div>
              <p className={styles.muted}>{sheet.policyText}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
