"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "../../lib/session";

export default function InstallCompletePage() {
  const [installationId, setInstallationId] = useState("");
  const [status, setStatus] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await apiFetch("/v1/github/setup/complete", {
        method: "POST",
        auth: true,
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ installationId })
      });
      const payload = await response.json();
      setStatus(`Installation ${payload.installationId} linked successfully.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main>
      <div className="shell">
        <section className="card stack">
          <span className="eyebrow">GitHub App</span>
          <h1>Complete installation linking</h1>
          <p>
            After GitHub redirects back from the App installation flow, paste the
            installation ID here to verify ownership and mark the app as installed for your account.
          </p>
          <form className="stack" onSubmit={handleSubmit}>
            <input
              value={installationId}
              onChange={(event) => setInstallationId(event.target.value)}
              placeholder="GitHub installation ID"
              style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(16,35,58,0.12)" }}
            />
            <button className="button" type="submit">Link installation</button>
          </form>
          {status ? <p>{status}</p> : null}
        </section>
      </div>
    </main>
  );
}
