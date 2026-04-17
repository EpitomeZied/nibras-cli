'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { use } from 'react';
import type { ProjectRoleApplication, Team, TeamFormationRun } from '@nibras/contracts';
import { apiFetch } from '../../../../../../../lib/session';
import styles from '../../../../../instructor.module.css';

export default function ProjectTeamsPage({
  params,
}: {
  params: Promise<{ courseId: string; projectId: string }>;
}) {
  const { courseId, projectId } = use(params);
  const [applications, setApplications] = useState<ProjectRoleApplication[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [run, setRun] = useState<TeamFormationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [applicationsResponse, teamsResponse] = await Promise.all([
        apiFetch(`/v1/tracking/projects/${projectId}/applications`, { auth: true }),
        apiFetch(`/v1/tracking/projects/${projectId}/teams`, { auth: true }),
      ]);
      if (!applicationsResponse.ok) {
        const body = (await applicationsResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to load applications.');
      }
      if (!teamsResponse.ok) {
        const body = (await teamsResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to load teams.');
      }
      setApplications((await applicationsResponse.json()) as ProjectRoleApplication[]);
      setTeams((await teamsResponse.json()) as Team[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function generateTeams() {
    setWorking(true);
    setError('');
    try {
      const response = await apiFetch(
        `/v1/tracking/projects/${projectId}/team-formation/generate`,
        {
          auth: true,
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ algorithmVersion: 'v1' }),
        }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to generate teams.');
      }
      setRun((await response.json()) as TeamFormationRun);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setWorking(false);
    }
  }

  async function lockTeams() {
    setWorking(true);
    setError('');
    try {
      const response = await apiFetch(`/v1/tracking/projects/${projectId}/team-formation/lock`, {
        auth: true,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ formationRunId: run?.id }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to lock teams.');
      }
      setTeams((await response.json()) as Team[]);
      setRun(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href="/instructor">Instructor</Link> /{' '}
            <Link href={`/instructor/courses/${courseId}`}>Course</Link> / Team Review
          </p>
          <h1>Team Formation</h1>
          <p className={styles.subtitle}>
            Review role applications, generate balanced team suggestions, and lock the final team
            roster for this project.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void generateTeams()}
            disabled={working}
          >
            {working ? 'Working…' : 'Generate Teams'}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void lockTeams()}
            disabled={working || !run}
          >
            Lock Teams
          </button>
        </div>
      </div>

      {loading && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && (
        <>
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Applications</span>
              <strong>{applications.length}</strong>
              <p>Students who ranked preferred roles</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Suggested Teams</span>
              <strong>{run?.result.teams.length ?? 0}</strong>
              <p>{run ? 'Ready to review before locking' : 'Generate a preview to begin'}</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Locked Teams</span>
              <strong>{teams.length}</strong>
              <p>Finalized teams in this project</p>
            </article>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Applications</h2>
              <span className={styles.muted}>{applications.length} total</span>
            </div>
            {!applications.length ? (
              <p className={styles.muted}>No applications yet.</p>
            ) : (
              <table className={styles.submissionTable}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Preferences</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td className={styles.mono}>{application.userId}</td>
                      <td>
                        {application.preferences
                          .map((preference) => preference.roleLabel)
                          .join(', ')}
                      </td>
                      <td>{application.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.detailGrid}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Suggested Teams</h2>
                <span className={styles.muted}>{run?.result.teams.length ?? 0} previewed</span>
              </div>

              {!run ? (
                <p className={styles.muted}>Generate teams to preview groupings before locking.</p>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {run.result.teams.map((team) => (
                    <div
                      key={team.name}
                      className={`${styles.projectRow} ${styles.suggestedTeamRow}`}
                      style={{ display: 'grid', gap: '6px' }}
                    >
                      <strong>{team.name}</strong>
                      <span className={styles.muted}>
                        {team.members
                          .map((member) => `${member.username} · ${member.roleLabel}`)
                          .join(' | ')}
                      </span>
                    </div>
                  ))}
                  {run.result.waitlist.length > 0 && (
                    <p className={styles.muted}>
                      Waitlist: {run.result.waitlist.map((entry) => entry.username).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Locked Teams</h2>
                <span className={styles.muted}>{teams.length} locked</span>
              </div>

              {!teams.length ? (
                <p className={styles.muted}>No locked teams yet.</p>
              ) : (
                <div className={styles.projectList}>
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className={`${styles.projectRow} ${styles.lockedTeamRow}`}
                      style={{ display: 'grid', gap: '6px' }}
                    >
                      <strong>{team.name}</strong>
                      <span className={styles.muted}>
                        {team.members
                          .map((member) => `${member.username} · ${member.roleLabel}`)
                          .join(' | ')}
                      </span>
                      {team.repo?.name && (
                        <span className={styles.muted}>Repo: {team.repo.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
