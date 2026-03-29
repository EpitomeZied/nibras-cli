"use client";

import { useState } from "react";
import Image from "next/image";
import NibrasLogo from "./_components/nibras-logo";
import { discoverApiBaseUrl } from "./lib/session";
import styles from "./signin.module.css";

export default function HomePage() {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    setError("");
    setSubmitting(true);
    try {
      const apiBaseUrl = await discoverApiBaseUrl();
      const configRes = await fetch(`${apiBaseUrl}/v1/github/config`);
      if (configRes.ok) {
        const config = await configRes.json() as { configured: boolean };
        if (!config.configured) {
          setError("GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_CLIENT_ID, and related environment variables, then restart the API.");
          setSubmitting(false);
          return;
        }
      }
      const returnTo = `${window.location.origin}/auth/complete`;
      window.location.href = `${apiBaseUrl}/v1/github/oauth/start?return_to=${encodeURIComponent(returnTo)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      {/* Animated orbs */}
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />

      {/* Dot grid */}
      <div className={styles.grid} />

      {/* Top nav */}
      <nav className={styles.nav}>
        <div className={styles.navLogo} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/branding/nibras-icon.svg" alt="Nibras" width={28} height={28} priority />
          <span style={{ fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: "-0.01em" }}>Nibras</span>
        </div>
      </nav>

      {/* Hero */}
      <div className={styles.hero}>
        <h1 className={styles.headline}>
          <span className={styles.headlineBright}>Ship. Learn. Dominate.</span>
          <br />
          <span className={styles.headlineMuted}>No excuses. Just results.</span>
        </h1>

        <p className={styles.sub}>
          The platform that helps you teach, track, and grow.
        </p>
      </div>

      {/* Sign-in card */}
      <div className={styles.cardWrap}>
        <div className={styles.formCard}>
          <div className={styles.formIntro}>
            <h2>Welcome back</h2>
            <p>Sign in with GitHub to access your dashboard, projects, and course activity.</p>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.formActions}>
            <button
              className={styles.btnGitHub}
              type="button"
              onClick={() => void handleSignIn()}
              disabled={submitting}
            >
              <svg className={styles.githubIcon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              {submitting ? "Connecting…" : "Continue with GitHub"}
            </button>
          </div>

          <p className={styles.formHint}>
            By continuing you agree to connect your GitHub account to Nibras.
            Your repositories are only accessed with your explicit permission.
          </p>
        </div>
      </div>

      {/* Feature strip */}
      <div className={styles.featureGrid}>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>◫</span>
          <strong>Dashboard</strong>
          <p>Track account, projects, and milestones at a glance.</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>▣</span>
          <strong>GitHub-backed</strong>
          <p>Provision repos, link installs, and track submissions.</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>⊞</span>
          <strong>Instructor tools</strong>
          <p>Manage courses, milestones, and grade with rubrics.</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>⬡</span>
          <strong>Student portal</strong>
          <p>Join via invite and track progress every step.</p>
        </div>
      </div>
    </main>
  );
}
