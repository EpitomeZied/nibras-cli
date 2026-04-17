'use client';

import { use } from 'react';
import { useState } from 'react';
import type { ProgramSummary, ProgramVersionDetail } from '@nibras/contracts';
import { apiFetch } from '../../../../../lib/session';
import { useFetch } from '../../../../../lib/use-fetch';
import SectionNav from '../../../../_components/section-nav';
import { programSections } from '../../../../_components/workspace-sections';
import styles from '../../../instructor.module.css';

export default function ProgramRequirementsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { data: programs } = useFetch<ProgramSummary[]>('/v1/programs');
  const program = (programs ?? []).find((entry) => entry.id === programId) || null;
  const detailPath = program?.activeVersionId
    ? `/v1/programs/${programId}/versions/${program.activeVersionId}`
    : null;
  const { data: detail, loading, error, reload } = useFetch<ProgramVersionDetail>(detailPath);
  const [subjectCode, setSubjectCode] = useState('');
  const [catalogNumber, setCatalogNumber] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [defaultUnits, setDefaultUnits] = useState(3);
  const department = 'Computer Science';
  const [groupTitle, setGroupTitle] = useState('');
  const [category, setCategory] = useState<
    'foundation' | 'core' | 'depth' | 'elective' | 'capstone' | 'policy'
  >('foundation');
  const [ruleType, setRuleType] = useState<
    'required' | 'choose_n' | 'elective_pool' | 'track_gate'
  >('required');
  const [courseIds, setCourseIds] = useState('');

  async function createCatalogCourse() {
    await apiFetch(`/v1/programs/${programId}/catalog-courses`, {
      method: 'POST',
      auth: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subjectCode,
        catalogNumber,
        title: courseTitle,
        defaultUnits,
        department,
      }),
    });
    setSubjectCode('');
    setCatalogNumber('');
    setCourseTitle('');
    reload();
  }

  async function createRequirementGroup() {
    if (!detail) return;
    await apiFetch(`/v1/programs/${programId}/requirement-groups`, {
      method: 'POST',
      auth: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        programVersionId: detail.version.id,
        trackId: null,
        title: groupTitle,
        category,
        minUnits: 0,
        minCourses: 0,
        notes: '',
        sortOrder: detail.requirementGroups.length + 1,
        noDoubleCount: true,
        rules: [
          {
            ruleType,
            pickCount: ruleType === 'required' ? null : 1,
            note: '',
            sortOrder: 1,
            courses: courseIds
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
              .map((catalogCourseId) => ({ catalogCourseId })),
          },
        ],
      }),
    });
    setGroupTitle('');
    setCourseIds('');
    reload();
  }

  return (
    <div className={styles.page}>
      <SectionNav
        eyebrow="Program Builder"
        title="Requirements Builder"
        description="Add catalog courses, define requirement groups, and shape the rule system that drives the program sheet and planner audit."
        items={programSections(programId)}
      />

      {loading && <p className={styles.muted}>Loading requirements…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {detail && (
        <>
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Catalog Courses</span>
              <strong>{detail.catalogCourses.length}</strong>
              <p>Reusable courses in this program</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Requirement Groups</span>
              <strong>{detail.requirementGroups.length}</strong>
              <p>Rules used in planner audits</p>
            </article>
          </div>

          <div className={styles.detailGrid}>
            <div>
              <div className={styles.formSection}>
                <h2>Add Catalog Course</h2>
                <div className={styles.formGroup}>
                  <label htmlFor="subjectCode">Subject</label>
                  <input
                    id="subjectCode"
                    value={subjectCode}
                    onChange={(event) => setSubjectCode(event.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="catalogNumber">Number</label>
                  <input
                    id="catalogNumber"
                    value={catalogNumber}
                    onChange={(event) => setCatalogNumber(event.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="courseTitle">Title</label>
                  <input
                    id="courseTitle"
                    value={courseTitle}
                    onChange={(event) => setCourseTitle(event.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="defaultUnits">Units</label>
                  <input
                    id="defaultUnits"
                    type="number"
                    min="1"
                    value={defaultUnits}
                    onChange={(event) => setDefaultUnits(Number(event.target.value))}
                  />
                </div>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => void createCatalogCourse()}
                >
                  Add course
                </button>
              </div>

              <div className={styles.formSection} style={{ marginTop: 20 }}>
                <h2>Add Requirement Group</h2>
                <div className={styles.formGroup}>
                  <label htmlFor="groupTitle">Group title</label>
                  <input
                    id="groupTitle"
                    value={groupTitle}
                    onChange={(event) => setGroupTitle(event.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="category">Category</label>
                  <select
                    id="category"
                    value={category}
                    onChange={(event) =>
                      setCategory(
                        event.target.value as
                          | 'foundation'
                          | 'core'
                          | 'depth'
                          | 'elective'
                          | 'capstone'
                          | 'policy'
                      )
                    }
                  >
                    {['foundation', 'core', 'depth', 'elective', 'capstone', 'policy'].map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="ruleType">Rule type</label>
                  <select
                    id="ruleType"
                    value={ruleType}
                    onChange={(event) =>
                      setRuleType(
                        event.target.value as
                          | 'required'
                          | 'choose_n'
                          | 'elective_pool'
                          | 'track_gate'
                      )
                    }
                  >
                    {['required', 'choose_n', 'elective_pool', 'track_gate'].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="courseIds">Catalog course IDs</label>
                  <textarea
                    id="courseIds"
                    rows={4}
                    value={courseIds}
                    onChange={(event) => setCourseIds(event.target.value)}
                    placeholder="Paste comma-separated catalog course IDs from the list on the right."
                  />
                </div>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => void createRequirementGroup()}
                >
                  Add requirement group
                </button>
              </div>
            </div>

            <div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h2>Catalog Courses</h2>
                </div>
                <div className={styles.projectList}>
                  {detail.catalogCourses.map((course) => (
                    <div key={course.id} className={styles.projectRow}>
                      <div>
                        <strong>
                          {course.subjectCode} {course.catalogNumber}
                        </strong>
                        <p className={styles.muted}>{course.title}</p>
                      </div>
                      <code className={styles.mono}>{course.id}</code>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.panel} style={{ marginTop: 20 }}>
                <div className={styles.panelHeader}>
                  <h2>Requirement Groups</h2>
                </div>
                <div className={styles.projectList}>
                  {detail.requirementGroups.map((group) => (
                    <div key={group.id} className={styles.projectRow}>
                      <div>
                        <strong>{group.title}</strong>
                        <p className={styles.muted}>{group.category}</p>
                      </div>
                      <span className={styles.muted}>{group.rules.length} rules</span>
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
