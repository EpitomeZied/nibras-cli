"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/session";

type MePayload = {
  user: {
    username: string;
    email: string;
    githubLogin: string;
    githubLinked: boolean;
    githubAppInstalled: boolean;
  };
  apiBaseUrl: string;
};

type InstallUrlPayload = {
  installUrl: string;
};

export default function DashboardPage() {
  const [me, setMe] = useState<MePayload | null>(null);
  const [installUrl, setInstallUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const [meResponse, installResponse] = await Promise.all([
          apiFetch("/v1/web/session", { auth: true }),
          apiFetch("/v1/github/install-url", { auth: true })
        ]);
        const mePayload = await meResponse.json() as MePayload;
        const installPayload = await installResponse.json() as InstallUrlPayload;
        setMe(mePayload);
        if (installPayload.installUrl) {
          setInstallUrl(installPayload.installUrl);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  return (
    <main>
      <div className="shell stack">
        <section className="hero">
          <span className="eyebrow">Dashboard</span>
          <h1>Connect the GitHub App and keep the CLI moving.</h1>
          <p>
            This page uses the hosted API session created during GitHub sign-in.
            Install the GitHub App to enable repo provisioning and webhook-backed submissions.
          </p>
          {installUrl ? (
            <div className="actions">
              <a className="button" href={installUrl}>Install GitHub App</a>
              <a className="button-secondary" href="/install/complete">Finish setup</a>
            </div>
          ) : null}
        </section>

        {error ? (
          <section className="card">
            <h1>Session Error</h1>
            <p>{error}</p>
          </section>
        ) : null}

        {me ? (
          <div className="grid">
            <section className="card">
              <h1>{me.user.username}</h1>
              <p className="mono">{me.user.email}</p>
              <div className="divider" />
              <p>GitHub login: <span className="mono">{me.user.githubLogin}</span></p>
              <p>API: <span className="mono">{me.apiBaseUrl}</span></p>
            </section>
            <section className="card">
              <h1>GitHub Status</h1>
              <p>Linked: {me.user.githubLinked ? "yes" : "no"}</p>
              <p>App installed: {me.user.githubAppInstalled ? "yes" : "no"}</p>
            </section>
            <section className="card">
              <h1>CLI Commands</h1>
              <p className="mono">nibras login</p>
              <p className="mono">nibras ping</p>
              <p className="mono">nibras setup --project cs161/exam1</p>
              <p className="mono">nibras submit</p>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
