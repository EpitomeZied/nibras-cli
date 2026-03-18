"use client";

import { useEffect, useState } from "react";

function parseHash(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

export default function AuthCompletePage() {
  const [status, setStatus] = useState("Completing sign-in...");

  useEffect(() => {
    const values = parseHash();
    const accessToken = values.access_token;
    const refreshToken = values.refresh_token;
    const apiBaseUrl = values.api_base_url;
    const userId = values.user_id;
    if (!accessToken || !refreshToken || !apiBaseUrl || !userId) {
      setStatus("Missing sign-in payload from the API callback.");
      return;
    }
    window.localStorage.setItem("nibras.accessToken", accessToken);
    window.localStorage.setItem("nibras.refreshToken", refreshToken);
    window.localStorage.setItem("nibras.apiBaseUrl", apiBaseUrl);
    window.localStorage.setItem("nibras.userId", userId);
    setStatus("Sign-in complete. Redirecting to the dashboard...");
    window.setTimeout(() => {
      window.location.href = "/dashboard";
    }, 700);
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
