/**
 * Thin Resend wrapper for transactional emails.
 * Silently disabled when RESEND_API_KEY is not set.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
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

export async function sendReviewSubmittedEmail(opts: {
  studentEmail: string;
  studentName: string;
  projectName: string;
  reviewStatus: "approved" | "graded" | "changes_requested" | "pending";
  feedback: string;
  submissionUrl: string;
}): Promise<void> {
  const label = opts.reviewStatus === "changes_requested" ? "changes requested" : opts.reviewStatus;
  const subject = `[Nibras] ${opts.projectName} — review: ${label}`;
  const feedbackLine = opts.feedback ? `\n\nInstructor feedback:\n${opts.feedback}` : "";
  const text = `Hi ${opts.studentName},\n\nYour instructor has reviewed your submission for "${opts.projectName}" (${label}).${feedbackLine}\n\nView details: ${opts.submissionUrl}`;
  await sendEmail(opts.studentEmail, subject, text);
}
