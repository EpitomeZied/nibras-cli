'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type {
  ProgramSummary,
  StudentProgramPlan,
  TrackRecommendationResponse,
} from '@nibras/contracts';
import { apiFetch } from '../../lib/session';
import { useFetch } from '../../lib/use-fetch';
import SectionNav from '../_components/section-nav';
import { plannerSections } from '../_components/workspace-sections';
import styles from '../instructor/instructor.module.css';
import CoursePalette from './_components/CoursePalette';
import PlannerGrid from './_components/PlannerGrid';
import RecommendationBanner from './_components/RecommendationBanner';
import plannerStyles from './_components/planner.module.css';

type DraftPlannedCourse = {
  catalogCourseId: string;
  plannedYear: number;
  plannedTerm: 'fall' | 'spring';
  sourceType: 'standard' | 'transfer' | 'petition' | 'manual';
  note: string | null;
};

type DragData = {
  catalogCourseId: string;
  sourceYear: number | null;
  sourceTerm: 'fall' | 'spring' | null;
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

  const { data: recData, reload: reloadRec } = useFetch<TrackRecommendationResponse>(
    '/v1/programs/student/me/recommend-track'
  );

  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftCourses, setDraftCourses] = useState<DraftPlannedCourse[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  // Re-fetch recommendations whenever draftCourses changes and has year 1 content
  useEffect(() => {
    const hasYear1 = draftCourses.some((c) => c.plannedYear === 1);
    if (hasYear1) reloadRec();
  }, [draftCourses, reloadRec]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

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

  function removeCourse(catalogCourseId: string) {
    setDraftCourses((current) =>
      current.filter((entry) => entry.catalogCourseId !== catalogCourseId)
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as DragData;
    const overId = over.id as string;

    // Dropped on the palette → remove from grid
    if (overId === 'palette') {
      removeCourse(dragData.catalogCourseId);
      return;
    }

    // Dropped on a grid cell → parse "cell-{year}-{term}"
    if (overId.startsWith('cell-')) {
      const parts = overId.split('-'); // ['cell', '1', 'fall']
      const newYear = parseInt(parts[1], 10);
      const newTerm = parts[2] as 'fall' | 'spring';

      if (dragData.sourceYear === null) {
        // From palette → add to grid
        setDraftCourses((current) => {
          if (current.some((e) => e.catalogCourseId === dragData.catalogCourseId)) return current;
          return [
            ...current,
            {
              catalogCourseId: dragData.catalogCourseId,
              plannedYear: newYear,
              plannedTerm: newTerm,
              sourceType: 'standard',
              note: null,
            },
          ];
        });
      } else {
        // Already placed → move to new cell
        setDraftCourses((current) =>
          current.map((entry) =>
            entry.catalogCourseId === dragData.catalogCourseId
              ? { ...entry, plannedYear: newYear, plannedTerm: newTerm }
              : entry
          )
        );
      }
    }
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

      {/* ── Enroll panel (shown when no plan exists) ── */}
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

      {/* ── Main planner (shown when enrolled) ── */}
      {plan && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Action bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>4-Year Degree Plan</h2>
              <p className={styles.muted} style={{ margin: '2px 0 0' }}>
                {plan.program.code} · {plan.program.title}
                {plan.selectedTrack ? ` · ${plan.selectedTrack.title}` : ''}
              </p>
            </div>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void savePlan()}
              disabled={saving || plan.isLocked}
            >
              {saving ? 'Saving…' : 'Save plan'}
            </button>
          </div>

          {saveError && <p className={styles.errorText}>{saveError}</p>}

          {plan.isLocked && (
            <div className={plannerStyles.lockedBanner}>
              ⚠ This plan is locked and cannot be edited.
            </div>
          )}

          {/* Track recommendation banner — shown when year 1 courses exist and no track selected */}
          {!plan.selectedTrack && recData && recData.recommendations.length > 0 && (
            <RecommendationBanner
              recommendations={recData.recommendations}
              year1CourseCount={recData.year1CourseCount}
              canSelectTrack={plan.canSelectTrack}
              onTrackSelected={() => {
                reload();
                reloadRec();
              }}
            />
          )}

          {/* Two-column layout: palette left, grid right */}
          <div className={plannerStyles.plannerLayout}>
            <CoursePalette
              unplacedCourses={plan.catalogCourses.filter(
                (c) => !draftCourses.some((d) => d.catalogCourseId === c.id)
              )}
              isLocked={plan.isLocked}
            />
            <PlannerGrid
              draftCourses={draftCourses}
              catalogCourses={plan.catalogCourses}
              isLocked={plan.isLocked}
              onRemove={removeCourse}
            />
          </div>

          {/* Floating drag overlay */}
          <DragOverlay>
            {activeId &&
              (() => {
                const course = plan.catalogCourses.find((c) => c.id === activeId);
                if (!course) return null;
                return (
                  <div
                    className={plannerStyles.chip}
                    style={{
                      transform: CSS.Transform.toString(null),
                      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                      pointerEvents: 'none',
                    }}
                  >
                    <span className={plannerStyles.chipTitle}>{course.title}</span>
                  </div>
                );
              })()}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
