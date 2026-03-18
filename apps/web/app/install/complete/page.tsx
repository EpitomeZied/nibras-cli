"use client";

import { FormEvent, useState } from "react";

export default function InstallCompletePage() {
  const [installationId, setInstallationId] = useState("");
  const [status, setStatus] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const apiBaseUrl = window.localStorage.getItem("nibras.apiBaseUrl") || process.env.NEXT_PUBLIC_NIBRAS_API_BASE_URL || "http://127.0.0.1:4848";
    const accessToken = window.localStorage.getItem("nibras.accessToken");
    if (!accessToken) {
      setStatus("No web session found.");
      return;
    }
    const response = await fetch(`${apiBaseUrl}/v1/github/setup/complete`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ installationId })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error || "Failed to complete installation.");
      return;
    }
    setStatus(`Installation ${payload.installationId} linked successfully.`);
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
