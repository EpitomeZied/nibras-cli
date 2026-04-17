'use client';

import { useEffect, useState } from 'react';
import type {
  CreateProjectRoleApplicationRequest,
  ProjectRoleApplication,
  ProjectTemplateRole,
  TrackingProjectSummary,
} from '@nibras/contracts';
import styles from './team-application-modal.module.css';

type Props = {
  project: TrackingProjectSummary;
  application: ProjectRoleApplication | null;
  submitting: boolean;
  submitError: string;
  onClose: () => void;
  onSubmit: (payload: CreateProjectRoleApplicationRequest) => Promise<void>;
};

type PreferenceRow = {
  templateRoleId: string;
  rank: number;
};

export default function TeamApplicationModal({
  project,
  application,
  submitting,
  submitError,
  onClose,
  onSubmit,
}: Props) {
  const [statement, setStatement] = useState('');
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [preferences, setPreferences] = useState<PreferenceRow[]>([]);

  useEffect(() => {
    setStatement(application?.statement ?? '');
    setAvailabilityNote(application?.availabilityNote ?? '');
    if (application?.preferences?.length) {
      setPreferences(
        application.preferences.map((entry) => ({
          templateRoleId: entry.templateRoleId,
          rank: entry.rank,
        }))
      );
      return;
    }
    setPreferences(
      project.teamRoles.map((role, index) => ({
        templateRoleId: role.id,
        rank: index + 1,
      }))
    );
  }, [application, project.teamRoles]);

  const sortedRoles = project.teamRoles
    .slice()
    .sort(
      (left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
    );

  function updatePreference(rank: number, templateRoleId: string) {
    setPreferences((current) => {
      const next = current.filter((entry) => entry.rank !== rank);
      next.push({ rank, templateRoleId });
      return next.sort((left, right) => left.rank - right.rank);
    });
  }

  async function handleSubmit() {
    const payload: CreateProjectRoleApplicationRequest = {
      statement: statement.trim(),
      availabilityNote: availabilityNote.trim(),
      preferences: preferences
        .filter((entry) => entry.templateRoleId)
        .sort((left, right) => left.rank - right.rank),
    };
    await onSubmit(payload);
  }

  return (
    <div
      className={styles.backdrop}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-apply-title"
      >
        <div className={styles.header}>
          <div>
            <h2 id="team-apply-title" className={styles.title}>
              Team role application
            </h2>
            <p className={styles.sub}>
              {project.title} · rank your preferred roles before team formation locks.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.grid}>
          <div className={styles.workflowCard}>
            <strong>How this works</strong>
            <ol className={styles.workflowList}>
              <li>Rank the roles you want most.</li>
              <li>Explain your skills and availability constraints.</li>
              <li>Instructors review applications, generate teams, then lock the final roster.</li>
            </ol>
          </div>

          <div className={styles.field}>
            <label htmlFor="role-statement">Motivation / skills</label>
            <textarea
              id="role-statement"
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder="Briefly describe what you can contribute to the team."
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="role-availability">Availability note</label>
            <textarea
              id="role-availability"
              value={availabilityNote}
              onChange={(event) => setAvailabilityNote(event.target.value)}
              placeholder="Add schedule or collaboration constraints if needed."
            />
          </div>

          <div className={styles.field}>
            <label>Rank your preferred roles</label>
            <div className={styles.roles}>
              {project.teamRoles.map((_, index) => (
                <div key={index} className={styles.roleRow}>
                  <span>Choice {index + 1}</span>
                  <select
                    value={
                      preferences.find((entry) => entry.rank === index + 1)?.templateRoleId ?? ''
                    }
                    onChange={(event) => updatePreference(index + 1, event.target.value)}
                  >
                    <option value="" disabled>
                      Select a role
                    </option>
                    {sortedRoles.map((role: ProjectTemplateRole) => (
                      <option key={role.id} value={role.id}>
                        {role.label} ({role.count})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className={styles.hint}>
              Preferences guide team generation. Required role coverage is filled first, then the
              system balances teams by student level.
            </p>
          </div>

          {submitError && <p className={styles.error}>{submitError}</p>}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : application ? 'Update Application' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  );
}
