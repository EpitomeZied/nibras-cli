"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/session";

export default function AuthCompletePage() {
  const [status, setStatus] = useState("Completing sign-in...");

  useEffect(() => {
    void (async () => {
      try {
        const response = await apiFetch("/v1/web/session", { auth: true });
        if (!response.ok) {
          throw new Error("Web session was not established.");
        }
        setStatus("Sign-in complete. Redirecting to the dashboard...");
        window.setTimeout(() => {
          window.location.href = "/dashboard";
        }, 700);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  return (
    <main>
      <div className="shell">
        <section className="card">
          <h1>Auth Complete</h1>
          <p>{status}</p>
        </section>
      </div>
    </main>
  );
}
