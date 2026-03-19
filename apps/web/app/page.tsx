"use client";

import { useState } from "react";
import { discoverApiBaseUrl } from "./lib/session";

export default function HomePage() {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    setError("");
    setSubmitting(true);
    try {
      const apiBaseUrl = await discoverApiBaseUrl();
      const returnTo = `${window.location.origin}/auth/complete`;
      window.location.href = `${apiBaseUrl}/v1/github/oauth/start?return_to=${encodeURIComponent(returnTo)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <main>
      <div className="shell">
        <section className="hero">
          <span className="eyebrow">GitHub-linked CLI</span>
          <h1>Nibras is now a real product surface.</h1>
          <p>
            Sign in with GitHub, install the GitHub App, provision project repos,
            and connect the CLI to a hosted backend instead of a local-only demo flow.
          </p>
          <div className="actions">
            <button className="button" type="button" onClick={() => void handleSignIn()} disabled={submitting}>
              {submitting ? "Connecting..." : "Sign in with GitHub"}
            </button>
            <a className="button-secondary" href="https://github.com/apps" target="_blank" rel="noreferrer">GitHub Apps</a>
          </div>
          {error ? <p>{error}</p> : null}
        </section>

        <div className="grid">
          <section className="card">
            <span className="badge">CLI</span>
            <p>Use <span className="mono">nibras login</span>, <span className="mono">nibras setup</span>, and <span className="mono">nibras submit</span> locally.</p>
          </section>
          <section className="card">
            <span className="badge">API</span>
            <p>The API handles sessions, GitHub App install URLs, webhook verification, and submission state.</p>
          </section>
          <section className="card">
            <span className="badge">Web</span>
            <p>The dashboard links your GitHub account, completes installation, and shows account state without relying on a fake scaffold.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
