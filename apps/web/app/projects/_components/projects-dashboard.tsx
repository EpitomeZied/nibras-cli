"use client";

import { useEffect, useMemo, useState } from "react";
import type { StudentProjectsDashboardResponse, TrackingMilestone, TrackingProjectSummary } from "@nibras/contracts";
import { apiFetch, discoverApiBaseUrl } from "../../lib/session";
import styles from "./projects.module.css";

type SubmissionType = "github" | "link" | "text";

function statusTone(status: string): string {
  if (status === "approved" || status === "graded") return styles.badgeApproved;
  if (status === "submitted") return styles.badgeSubmitted;
  return styles.badgeOpen;
}

export default function ProjectsDashboard({ initialCourseId = null }: { initialCourseId?: string | null }) {
  const [dashboard, setDashboard] = useState<StudentProjectsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeMilestone, setActiveMilestone] = useState<TrackingMilestone | null>(null);
  const [submissionType, setSubmissionType] = useState<SubmissionType>("github");
  const [submissionValue, setSubmissionValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  async function loadDashboard(courseId?: string | null) {
    setLoading(true);
    setError("");
    try {
      const baseUrl = await discoverApiBaseUrl();
      setApiBaseUrl(baseUrl);
      const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
      const response = await apiFetch(`/v1/tracking/dashboard/student${query}`, { auth: true });
      const payload = await response.json() as StudentProjectsDashboardResponse;
      setDashboard(payload);
      setSelectedProjectId((current) => (
        payload.projects.some((project) => project.id === current)
          ? current
          : payload.activeProjectId || payload.projects[0]?.id || ""
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard(initialCourseId);
  }, [initialCourseId]);

  const activeProject = useMemo<TrackingProjectSummary | null>(() => {
    if (!dashboard) return null;
    return dashboard.projects.find((project) => project.id === selectedProjectId) || dashboard.projects[0] || null;
  }, [dashboard, selectedProjectId]);

  const activeMilestones = useMemo(() => {
    if (!dashboard || !activeProject) return [];
    return dashboard.milestonesByProject[activeProject.id] || [];
  }, [dashboard, activeProject]);

  const activeStats = useMemo(() => {
    if (!dashboard || !activeProject) return null;
    return dashboard.statsByProject[activeProject.id] || null;
  }, [dashboard, activeProject]);

  async function submitMilestone() {
    if (!activeMilestone || !submissionValue.trim()) {
      setError("A submission value is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiFetch(`/v1/tracking/milestones/${activeMilestone.id}/submissions`, {
        auth: true,
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          submissionType,
          submissionValue,
          notes,
          repoUrl: submissionType === "github" ? submissionValue : "",
          branch: "main",
          commitSha: ""
        })
      });
      setActiveMilestone(null);
      setSubmissionValue("");
      setNotes("");
      await loadDashboard(dashboard?.course?.id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const finalMilestone = activeMilestones.find((milestone) => milestone.isFinal) || null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.pageHeader}>
          <div>
            <h1>Projects</h1>
            <p className={styles.subtitle}>
              {dashboard?.course ? `${dashboard.course.title} · ${dashboard.course.termLabel}` : "Project tracking"}
            </p>
          </div>
          <div className={styles.progressBadge}>
            <span>Overall Progress</span>
            <strong>{activeStats ? `${activeStats.completion}% Complete` : "Loading..."}</strong>
          </div>
        </header>

        {error ? (
          <section className={styles.stateCard}>
            <h2>Session Error</h2>
            <p>{error}</p>
          </section>
        ) : null}

        {loading ? (
          <section className={styles.stateCard}>
            <h2>Loading</h2>
            <p>Fetching project tracking data…</p>
          </section>
        ) : null}

        {!loading && dashboard?.pageError ? (
          <section className={styles.stateCard}>
            <h2>Nothing Published Yet</h2>
            <p>{dashboard.pageError}</p>
          </section>
        ) : null}

        {!loading && dashboard?.projects.length ? (
          <>
            <section className={styles.tabsSection}>
              {dashboard.projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`${styles.projectTab} ${project.id === activeProject?.id ? styles.activeTab : ""}`}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <strong>{project.title}</strong>
                  <span>{project.type}</span>
                  <span className={styles.tabBadge}>{project.status}</span>
                </button>
              ))}
            </section>

            <div className={styles.grid}>
              <div className={styles.leftColumn}>
                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2>Project Overview</h2>
                  </div>
                  <div className={styles.cardBody}>
                    <span className={`${styles.statusChip} ${statusTone(activeProject?.status || "open")}`}>{activeProject?.status || "draft"}</span>
                    <h3>{activeProject?.title}</h3>
                    <p>{activeProject?.description}</p>
                    <div className={styles.metaGrid}>
                      <div>
                        <span className={styles.metaLabel}>Grade Weight</span>
                        <strong>{activeProject?.gradeWeight || "TBD"}</strong>
                      </div>
                      <div>
                        <span className={styles.metaLabel}>Delivery</span>
                        <strong>{activeProject?.type || "Individual"}</strong>
                      </div>
                      <div>
                        <span className={styles.metaLabel}>Instructor</span>
                        <strong>{activeProject?.instructorName || "Course Staff"}</strong>
                      </div>
                    </div>
                  </div>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2>Milestones &amp; Phases</h2>
                    <span>{activeStats ? `${activeStats.approved} of ${activeStats.total} completed` : "0 of 0 completed"}</span>
                  </div>
                  <div className={styles.timeline}>
                    {activeMilestones.map((milestone) => (
                      <article key={milestone.id} className={styles.timelineItem}>
                        <div className={`${styles.timelineMarker} ${statusTone(milestone.status)}`} />
                        <div className={styles.timelineContent}>
                          <div className={styles.timelineTop}>
                            <strong>{milestone.title}</strong>
                            <span className={`${styles.milestoneBadge} ${statusTone(milestone.status)}`}>{milestone.statusLabel}</span>
                          </div>
                          <p>{milestone.description}</p>
                          <span className={styles.dueDate}>{milestone.dueDateLabel}</span>
                          {milestone.status !== "approved" && milestone.status !== "graded" ? (
                            <button
                              type="button"
                              className={styles.primaryButton}
                              onClick={() => {
                                setActiveMilestone(milestone);
                                setSubmissionType("github");
                                setSubmissionValue("");
                                setNotes("");
                              }}
                            >
                              Submit
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2>Final Project Submission</h2>
                  </div>
                  <div className={styles.finalSubmission}>
                    <p>Click to submit your final project state and write-up.</p>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={!finalMilestone}
                      onClick={() => {
                        if (finalMilestone) {
                          setActiveMilestone(finalMilestone);
                        }
                      }}
                    >
                      Submit Final Project
                    </button>
                  </div>
                </section>
              </div>

              <div className={styles.rightColumn}>
                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2>Overall Progress</h2>
                  </div>
                  <div className={styles.progressPanel}>
                    <div className={styles.progressRow}>
                      <span>Completion</span>
                      <strong>{activeStats ? `${activeStats.completion}%` : "0%"}</strong>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${activeStats?.completion || 0}%` }} />
                    </div>
                    <dl className={styles.statList}>
                      <div>
                        <dt>Approved</dt>
                        <dd>{activeStats ? `${activeStats.approved}/${activeStats.total}` : "0/0"}</dd>
                      </div>
                      <div>
                        <dt>Under Review</dt>
                        <dd>{activeStats?.underReview || 0}</dd>
                      </div>
                      <div>
                        <dt>Days Remaining</dt>
                        <dd>{activeStats?.daysRemaining || 0}</dd>
                      </div>
                    </dl>
                  </div>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2>Grading Breakdown</h2>
                  </div>
                  <div className={styles.breakdown}>
                    {activeProject?.rubric.map((item) => {
                      const total = activeProject.rubric.reduce((sum, entry) => sum + entry.maxScore, 0) || 1;
                      const width = Math.round((item.maxScore / total) * 100);
                      return (
                        <div key={item.criterion} className={styles.breakdownRow}>
                          <div>
                            <span>{item.criterion}</span>
                            <div className={styles.miniTrack}>
                              <div className={styles.miniFill} style={{ width: `${width}%` }} />
                            </div>
                          </div>
                          <strong>{width}%</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2>Resources</h2>
                  </div>
                  <div className={styles.resources}>
                    {activeProject?.resources.length ? activeProject.resources.map((resource) => (
                      <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className={styles.resourceLink}>
                        {resource.label}
                      </a>
                    )) : <p>No linked resources.</p>}
                  </div>
                </section>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {activeMilestone ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <button type="button" className={styles.closeButton} onClick={() => setActiveMilestone(null)}>×</button>
            <h2>Submit Milestone</h2>
            <p>{activeMilestone.title}</p>

            <label className={styles.formField}>
              <span>Submission Type</span>
              <select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as SubmissionType)}>
                <option value="github">GitHub Repository</option>
                <option value="link">Link (URL)</option>
                <option value="text">Text / Write-up</option>
              </select>
            </label>

            {submissionType === "github" ? (
              <div className={styles.githubNote}>
                <strong>GitHub webhook setup</strong>
                <p>Submit your repository URL, then add a webhook in GitHub pointing to:</p>
                <code>{apiBaseUrl ? `${apiBaseUrl}/v1/github/webhooks` : "/v1/github/webhooks"}</code>
              </div>
            ) : null}

            <label className={styles.formField}>
              <span>{submissionType === "text" ? "Write-up" : "Submission"}</span>
              {submissionType === "text" ? (
                <textarea rows={4} value={submissionValue} onChange={(event) => setSubmissionValue(event.target.value)} placeholder="Describe what you built…" />
              ) : (
                <input
                  type="text"
                  value={submissionValue}
                  onChange={(event) => setSubmissionValue(event.target.value)}
                  placeholder={submissionType === "github" ? "https://github.com/you/repo" : "https://example.com/submission"}
                />
              )}
            </label>

            <label className={styles.formField}>
              <span>Notes to Reviewer</span>
              <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything the reviewer should know?" />
            </label>

            <div className={styles.modalActions}>
              <button type="button" className={styles.primaryButton} disabled={submitting} onClick={() => void submitMilestone()}>
                {submitting ? "Submitting..." : "Submit"}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => setActiveMilestone(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
