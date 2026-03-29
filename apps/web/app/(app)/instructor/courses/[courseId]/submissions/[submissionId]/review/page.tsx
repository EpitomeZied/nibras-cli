"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { apiFetch } from "../../../../../../../lib/session";
import styles from "../../../../../instructor.module.css";

type Submission = {
  id: string;
  projectId: string;
  projectKey: string;
  milestoneId: string | null;
  commitSha: string;
  branch: string;
  status: string;
  submissionType: string;
  notes: string | null;
  createdAt: string;
};

type RubricItem = { criterion: string; maxScore: number };

type Project = {
  rubric: RubricItem[];
};

type AiCriterionScore = {
  id: string;
  points: number;
  earned: number;
  justification: string;
};

type Review = {
  status: string;
  score: number | null;
  feedback: string;
  rubric: RubricItem[];
  aiConfidence: number | null;
  aiNeedsReview: boolean | null;
  aiReasoningSummary: string | null;
  aiCriterionScores: AiCriterionScore[] | null;
  aiEvidenceQuotes: string[] | null;
  aiModel: string | null;
  aiGradedAt: string | null;
};

type RubricScore = { criterion: string; maxScore: number; score: number };

const REVIEW_STATUSES = ["approved", "changes_requested", "graded"] as const;

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? "#34d399" : value >= 0.6 ? "#fbbf24" : "#f87171";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      background: `${color}18`,
      color,
      border: `1px solid ${color}40`
    }}>
      {pct}% confidence
    </span>
  );
}

export default function SubmissionReviewPage({
  params
}: {
  params: Promise<{ courseId: string; submissionId: string }>;
}) {
  const { courseId, submissionId } = use(params);
  const router = useRouter();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [reviewData, setReviewData] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviewStatus, setReviewStatus] = useState<string>("approved");
  const [score, setScore] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [rubricScores, setRubricScores] = useState<RubricScore[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const subRes = await apiFetch(`/v1/tracking/submissions/${submissionId}`, { auth: true });
        if (!subRes.ok) throw new Error("Failed to load submission.");
        const subData = await subRes.json() as Submission;
        setSubmission(subData);

        const [projRes, reviewRes] = await Promise.all([
          apiFetch(`/v1/tracking/projects/${subData.projectId}`, { auth: true }),
          apiFetch(`/v1/tracking/submissions/${submissionId}/review`, { auth: true })
        ]);

        if (projRes.ok) {
          const projData = await projRes.json() as Project;
          const scores = projData.rubric.map((item) => ({
            criterion: item.criterion,
            maxScore: item.maxScore,
            score: 0
          }));
          setRubricScores(scores);
        }

        if (reviewRes.ok) {
          const rd = await reviewRes.json() as Review;
          setReviewData(rd);
          setReviewStatus(rd.status);
          // Pre-fill score from AI result if no manual score yet
          const initialScore = rd.score !== null
            ? String(rd.score)
            : rd.aiCriterionScores
              ? String(rd.aiCriterionScores.reduce((s, c) => s + c.earned, 0))
              : "";
          setScore(initialScore);
          setFeedback(rd.feedback || "");
          if (rd.rubric.length > 0) {
            setRubricScores(
              rd.rubric.map((item) => ({
                criterion: item.criterion,
                maxScore: item.maxScore,
                score: item.maxScore
              }))
            );
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [submissionId]);

  function updateRubricScore(index: number, value: number) {
    setRubricScores((prev) =>
      prev.map((row, i) => i === index ? { ...row, score: value } : row)
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const payload = {
      status: reviewStatus,
      score: score !== "" ? parseFloat(score) : null,
      feedback: feedback.trim(),
      rubric: rubricScores.map((row) => ({
        criterion: row.criterion,
        maxScore: row.score
      }))
    };

    try {
      const res = await apiFetch(`/v1/tracking/submissions/${submissionId}/review`, {
        method: "POST",
        auth: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error || `Request failed (${res.status}).`);
      }
      router.push(`/instructor/courses/${courseId}/submissions`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error.");
      setSubmitting(false);
    }
  }

  function statusClass(status: string) {
    if (status === "passed" || status === "approved") return styles.statusPublished;
    if (status === "failed") return styles.statusArchived;
    return styles.statusDraft;
  }

  const hasAi = reviewData?.aiConfidence !== null && reviewData?.aiConfidence !== undefined;

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error ?? "Submission not found."}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href="/instructor">Instructor</Link> /{" "}
            <Link href={`/instructor/courses/${courseId}`}>Course</Link> /{" "}
            <Link href={`/instructor/courses/${courseId}/submissions`}>Submissions</Link> / Review
          </p>
          <h1>Review Submission</h1>
        </div>
      </div>

      <div className={styles.detailGrid}>
        {/* Left column: submission summary + AI panel */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Submission</h2>
              <span className={`${styles.statusBadge} ${statusClass(submission.status)}`}>
                {submission.status.replace("_", " ")}
              </span>
            </div>
            <table className={styles.submissionTable}>
              <tbody>
                <tr>
                  <td className={styles.muted}>Project</td>
                  <td><strong>{submission.projectKey}</strong></td>
                </tr>
                <tr>
                  <td className={styles.muted}>Branch</td>
                  <td className={styles.mono}>{submission.branch}</td>
                </tr>
                <tr>
                  <td className={styles.muted}>Commit</td>
                  <td className={styles.mono}>{submission.commitSha.slice(0, 7)}</td>
                </tr>
                <tr>
                  <td className={styles.muted}>Type</td>
                  <td>{submission.submissionType}</td>
                </tr>
                <tr>
                  <td className={styles.muted}>Submitted</td>
                  <td className={styles.mono}>
                    {new Date(submission.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </td>
                </tr>
                {submission.notes && (
                  <tr>
                    <td className={styles.muted}>Notes</td>
                    <td>{submission.notes}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── AI Analysis Panel ── */}
          {hasAi && reviewData && (
            <div className={styles.panel} style={{ borderColor: "rgba(99,102,241,0.3)" }}>
              <div className={styles.panelHeader}>
                <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, opacity: 0.6 }}>✦</span> AI Analysis
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {reviewData.aiConfidence !== null && (
                    <ConfidenceBadge value={reviewData.aiConfidence} />
                  )}
                  {reviewData.aiModel && (
                    <span style={{ fontSize: 11, color: "var(--text-soft)" }}>{reviewData.aiModel}</span>
                  )}
                </div>
              </div>

              {/* Needs-review warning */}
              {reviewData.aiNeedsReview && (
                <div style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(251,191,36,0.08)",
                  border: "1px solid rgba(251,191,36,0.25)",
                  color: "#fbbf24",
                  fontSize: 13,
                  marginBottom: 16,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start"
                }}>
                  <span>⚠</span>
                  <span>AI flagged this submission for human review — the answer may be ambiguous or off-rubric.</span>
                </div>
              )}

              {/* Reasoning summary */}
              {reviewData.aiReasoningSummary && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Reasoning</p>
                  <blockquote style={{
                    margin: 0,
                    padding: "10px 14px",
                    borderLeft: "3px solid rgba(99,102,241,0.5)",
                    background: "rgba(99,102,241,0.06)",
                    borderRadius: "0 8px 8px 0",
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.6
                  }}>
                    {reviewData.aiReasoningSummary}
                  </blockquote>
                </div>
              )}

              {/* Criterion breakdown */}
              {reviewData.aiCriterionScores && reviewData.aiCriterionScores.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Criterion Breakdown</p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {reviewData.aiCriterionScores.map((c) => (
                      <div key={c.id} style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "var(--surface-strong)",
                        border: "1px solid var(--border)",
                        display: "grid",
                        gap: 4
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{c.id}</span>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: c.earned >= c.points * 0.7 ? "#34d399" : c.earned > 0 ? "#fbbf24" : "#f87171"
                          }}>
                            {c.earned} / {c.points}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                          {c.justification}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence quotes */}
              {reviewData.aiEvidenceQuotes && reviewData.aiEvidenceQuotes.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Evidence Quotes</p>
                  <div style={{ display: "grid", gap: 6 }}>
                    {reviewData.aiEvidenceQuotes.map((q, i) => (
                      <blockquote key={i} style={{
                        margin: 0,
                        padding: "8px 12px",
                        borderLeft: "2px solid rgba(59,130,246,0.4)",
                        background: "rgba(59,130,246,0.05)",
                        borderRadius: "0 6px 6px 0",
                        fontSize: 12,
                        color: "var(--text-soft)",
                        fontStyle: "italic",
                        lineHeight: 1.5
                      }}>
                        &ldquo;{q}&rdquo;
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: review form */}
        <div>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Review</h2>
              {hasAi && (
                <span style={{ fontSize: 11, color: "var(--text-soft)", padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-strong)" }}>
                  Pre-filled by AI
                </span>
              )}
            </div>
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div className={styles.formGroup} style={{ marginBottom: 16 }}>
                <label htmlFor="reviewStatus">Decision</label>
                <select
                  id="reviewStatus"
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                >
                  {REVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 16 }}>
                <label htmlFor="score">Score (optional)</label>
                <input
                  id="score"
                  type="number"
                  min={0}
                  step="0.5"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="e.g. 85"
                  style={{ width: 120 }}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 16 }}>
                <label htmlFor="feedback">Feedback</label>
                <textarea
                  id="feedback"
                  rows={5}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Comments for the student…"
                />
              </div>

              {rubricScores.length > 0 && (
                <div className={styles.dynamicSection} style={{ marginBottom: 16 }}>
                  <div className={styles.dynamicSectionHeader}>
                    <span className={styles.dynamicSectionLabel}>Rubric Scores</span>
                  </div>
                  {rubricScores.map((row, index) => (
                    <div key={index} className={styles.dynamicRow}>
                      <span className={styles.dynamicRowMain}>{row.criterion}</span>
                      <input
                        type="number"
                        min={0}
                        max={row.maxScore}
                        value={row.score}
                        onChange={(e) => updateRubricScore(index, parseFloat(e.target.value) || 0)}
                        className={styles.dynamicRowScore}
                        title={`Max: ${row.maxScore}`}
                      />
                      <span className={styles.dynamicRowUnit}>/ {row.maxScore}</span>
                    </div>
                  ))}
                </div>
              )}

              {submitError && <p className={styles.errorText}>{submitError}</p>}

              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit Review"}
                </button>
                <Link
                  href={`/instructor/courses/${courseId}/submissions`}
                  className={styles.backLink}
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
