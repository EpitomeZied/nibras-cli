"use client";

import { useEffect, useState } from "react";
import { discoverApiBaseUrl, persistSessionValues } from "../../lib/session";
import { normalizeApiBaseUrl } from "../../lib/session-core.js";

function parseHash(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

export default function AuthCompletePage() {
  const [status, setStatus] = useState("Completing sign-in...");

  useEffect(() => {
    void (async () => {
      const values = parseHash();
      const accessToken = values.access_token;
      const refreshToken = values.refresh_token;
      const userId = values.user_id;
      if (!accessToken || !refreshToken || !userId) {
        setStatus("Missing sign-in payload from the API callback.");
        return;
      }

      try {
        const apiBaseUrl = normalizeApiBaseUrl(values.api_base_url) || await discoverApiBaseUrl();
        persistSessionValues({
          "nibras.accessToken": accessToken,
          "nibras.refreshToken": refreshToken,
          "nibras.apiBaseUrl": apiBaseUrl,
          "nibras.userId": userId
        });
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
