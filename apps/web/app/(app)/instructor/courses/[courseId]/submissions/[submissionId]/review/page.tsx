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

type Review = {
  status: string;
  score: number | null;
  feedback: string;
  rubric: RubricItem[];
};

type RubricScore = { criterion: string; maxScore: number; score: number };

const REVIEW_STATUSES = ["approved", "changes_requested", "graded"] as const;

export default function SubmissionReviewPage({
  params
}: {
  params: Promise<{ courseId: string; submissionId: string }>;
}) {
  const { courseId, submissionId } = use(params);
  const router = useRouter();
  const [submission, setSubmission] = useState<Submission | null>(null);
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
          const reviewData = await reviewRes.json() as Review;
          setReviewStatus(reviewData.status);
          setScore(reviewData.score !== null ? String(reviewData.score) : "");
          setFeedback(reviewData.feedback || "");
          if (reviewData.rubric.length > 0) {
            setRubricScores(
              reviewData.rubric.map((item) => ({
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
        {/* Left: submission summary */}
        <div>
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
        </div>

        {/* Right: review form */}
        <div>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Review</h2>
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
