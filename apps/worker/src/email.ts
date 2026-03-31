/**
 * Thin Resend wrapper for transactional emails.
 * Silently disabled when RESEND_API_KEY is not set.
 */
async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const from = process.env.NIBRAS_EMAIL_FROM ?? "Nibras <noreply@nibras.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text })
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

export type SubmissionStatusEmailContext = {
  studentEmail: string;
  studentName: string;
  projectName: string;
  status: "passed" | "failed" | "needs_review";
  submissionUrl: string;
};

export async function sendSubmissionStatusEmail(ctx: SubmissionStatusEmailContext): Promise<void> {
  const subjectMap = {
    passed: `[Nibras] ${ctx.projectName} — tests passed`,
    failed: `[Nibras] ${ctx.projectName} — tests failed`,
    needs_review: `[Nibras] ${ctx.projectName} — tests passed, awaiting review`
  };
  const bodyMap = {
    passed: `Hi ${ctx.studentName},\n\nYour submission for "${ctx.projectName}" passed all tests.\n\nView details: ${ctx.submissionUrl}`,
    failed: `Hi ${ctx.studentName},\n\nYour submission for "${ctx.projectName}" did not pass the automated tests. Please review your code and resubmit.\n\nView details: ${ctx.submissionUrl}`,
    needs_review: `Hi ${ctx.studentName},\n\nYour submission for "${ctx.projectName}" passed all automated tests and has been sent to your instructor for review.\n\nView details: ${ctx.submissionUrl}`
  };
  await sendEmail(ctx.studentEmail, subjectMap[ctx.status], bodyMap[ctx.status]);
}

export type ReviewReadyEmailContext = {
  instructorEmail: string;
  instructorName: string;
  studentName: string;
  projectName: string;
  reviewQueueUrl: string;
};

export async function sendReviewReadyEmail(ctx: ReviewReadyEmailContext): Promise<void> {
  const subject = `[Nibras] Review needed — ${ctx.projectName} (${ctx.studentName})`;
  const text = `Hi ${ctx.instructorName},\n\n${ctx.studentName}'s submission for "${ctx.projectName}" passed automated tests but was flagged for human review.\n\nReview queue: ${ctx.reviewQueueUrl}`;
  await sendEmail(ctx.instructorEmail, subject, text);
}
