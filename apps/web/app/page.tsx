'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import NibrasLogo from './_components/nibras-logo';
import { discoverApiBaseUrl } from './lib/session';
import styles from './signin.module.css';

const workflowSteps = [
  {
    number: '01',
    title: 'Blueprint',
    subtitle: 'Define the structure',
    body: 'Start from a project template, a team-project setup, or a university program blueprint. Nibras organizes the workflow before the work begins.',
  },
  {
    number: '02',
    title: 'Coordinate',
    subtitle: 'Set the intent',
    body: 'Collect role applications, shape team formation, choose tracks, and route petitions and approvals through one coherent system.',
  },
  {
    number: '03',
    title: 'Deliver',
    subtitle: 'Run the workflow',
    body: 'Students use the CLI and GitHub flow, instructors review submissions, and planners keep academic progress visible and printable.',
  },
];

const capabilities = [
  {
    eyebrow: 'Templates',
    title: 'Reusable project blueprints',
    body: 'Define repeatable project structure, delivery mode, team size, and role setup once.',
  },
  {
    eyebrow: 'Team Formation',
    title: 'Role applications to locked teams',
    body: 'Students rank preferences, instructors generate suggestions, and final team rosters are locked cleanly.',
  },
  {
    eyebrow: 'Planner',
    title: 'University-style program planning',
    body: 'Tracks, petitions, approvals, and printable sheets live in one student-facing planning workspace.',
  },
  {
    eyebrow: 'CLI + GitHub',
    title: 'Still built for real developer workflows',
    body: 'Setup, testing, and submission stay GitHub-native while the web app handles coordination and review.',
  },
];

function AuthBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get('auth') !== 'required') return null;
  return (
    <div className={styles.authBanner} role="alert">
      Authentication required. Please sign in to access the dashboard.
    </div>
  );
}

export default function HomePage() {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    setError('');
    setSubmitting(true);
    try {
      const apiBaseUrl = await discoverApiBaseUrl();
      const configRes = await fetch(`${apiBaseUrl}/v1/github/config`);
      if (configRes.ok) {
        const config = (await configRes.json()) as { configured: boolean };
        if (!config.configured) {
          setError(
            'GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_CLIENT_ID, and related environment variables, then restart the API.'
          );
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
      <Suspense>
        <AuthBanner />
      </Suspense>

      <div className={styles.ambientGlow} />
      <div className={styles.gridOverlay} />

      <nav className={styles.nav}>
        <div className={styles.brand}>
          <NibrasLogo variant="inverse" width={118} priority />
          <span className={styles.betaPill}>Beta</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#how-it-works">How it works</a>
          <a href="#transformation">Transformation</a>
          <a href="#features">Features</a>
          <button
            className={styles.navAction}
            onClick={() => void handleSignIn()}
            disabled={submitting}
          >
            {submitting ? 'Connecting…' : 'Sign in'}
          </button>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Beta • Workflows that organize themselves</span>
          <h1>
            Other tools only track submissions.
            <span> Nibras designs the workflow.</span>
          </h1>
          <p className={styles.heroText}>
            Project templates, role applications, team formation, and university-style program
            planning now live in one structured platform built around how courses actually run.
          </p>

          <div className={styles.heroActions}>
            <button
              className={styles.primaryButton}
              onClick={() => void handleSignIn()}
              disabled={submitting}
            >
              {submitting ? 'Connecting…' : 'Start with GitHub'}
            </button>
            <a href="#features" className={styles.secondaryButton}>
              Explore platform
            </a>
          </div>

          <div className={styles.signalRow}>
            <span>Project Templates</span>
            <span>Role Applications</span>
            <span>Team Formation</span>
            <span>Program Planner</span>
          </div>

          {error ? <p className={styles.errorBox}>{error}</p> : null}
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.blueprintCard}>
            <div className={styles.windowDots}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.blueprintShell}>
              <aside className={styles.leftRail}>
                <div className={styles.railSection}>
                  <span className={styles.railLabel}>Blueprint</span>
                  <strong>Capstone Course Ops</strong>
                </div>
                <div className={styles.railList}>
                  <span className={styles.activeRailItem}>Project Templates</span>
                  <span>Role Applications</span>
                  <span>Team Formation</span>
                  <span>Program Planner</span>
                  <span>Printable Sheet</span>
                </div>
              </aside>

              <div className={styles.workspace}>
                <div className={styles.workspaceHeader}>
                  <div>
                    <span className={styles.workspaceEyebrow}>Generated Structure</span>
                    <h2>Applied Systems Track</h2>
                  </div>
                  <span className={styles.statusChip}>Early Access</span>
                </div>

                <div className={styles.panelGrid}>
                  <article className={styles.infoPanel}>
                    <span className={styles.panelEyebrow}>Template</span>
                    <strong>Capstone Team Project</strong>
                    <p>3-person teams • lead / research / QA</p>
                  </article>
                  <article className={styles.infoPanel}>
                    <span className={styles.panelEyebrow}>Formation</span>
                    <strong>Suggested Teams Ready</strong>
                    <p>12 applications • 4 teams • 1 waitlist</p>
                  </article>
                  <article className={styles.infoPanel}>
                    <span className={styles.panelEyebrow}>Planner</span>
                    <strong>Requirement Audit Live</strong>
                    <p>Track selected • 1 petition pending</p>
                  </article>
                </div>

                <div className={styles.docPanel}>
                  <div className={styles.docHeader}>
                    <strong>Program Sheet Snapshot</strong>
                    <span>Generated view</span>
                  </div>
                  <div className={styles.docRows}>
                    <div>
                      <span>Foundation</span>
                      <strong>Satisfied</strong>
                    </div>
                    <div>
                      <span>Core</span>
                      <strong>2 courses left</strong>
                    </div>
                    <div>
                      <span>Petitions</span>
                      <strong>Pending advisor</strong>
                    </div>
                    <div>
                      <span>Final output</span>
                      <strong>Printable sheet</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.section}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>How It Works</span>
          <h2>From blank workflow to organized delivery.</h2>
          <p>
            The same logic Docinit applies to documentation structure is the right visual direction
            for Nibras: blueprint first, then execution.
          </p>
        </div>

        <div className={styles.stepsGrid}>
          {workflowSteps.map((step) => (
            <article key={step.number} className={styles.stepCard}>
              <span className={styles.stepNumber}>{step.number}</span>
              <h3>{step.title}</h3>
              <strong>{step.subtitle}</strong>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="transformation" className={styles.section}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>Transformation</span>
          <h2>From scattered operations to a coherent academic system.</h2>
          <p>
            Nibras now covers more than submissions. The UI should make the before-and-after
            obvious.
          </p>
        </div>

        <div className={styles.compareGrid}>
          <article className={styles.compareCard}>
            <span className={styles.compareLabel}>Before</span>
            <strong>Course ops scattered across tools</strong>
            <ul>
              <li>Templates hidden inside course setup</li>
              <li>Team applications feel bolted onto submissions</li>
              <li>Program planning lives outside the main product story</li>
              <li>Navigation mixes unrelated workflows together</li>
            </ul>
          </article>

          <article className={`${styles.compareCard} ${styles.compareCardAccent}`}>
            <span className={styles.compareLabel}>After</span>
            <strong>Blueprint-driven academic workflows</strong>
            <ul>
              <li>Templates are first-class reusable blueprints</li>
              <li>Role applications lead naturally into team formation</li>
              <li>Planner, tracks, petitions, and printable sheets are visible</li>
              <li>Role-based workspaces organize the app around real jobs</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>Everything You Need</span>
          <h2>Four product areas, one design language.</h2>
          <p>
            The UI is now organized around the actual shipped feature surface instead of the older
            grading-only story.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {capabilities.map((capability) => (
            <article key={capability.title} className={styles.featureCard}>
              <span>{capability.eyebrow}</span>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div>
          <span className={styles.eyebrow}>Ready To Open Nibras?</span>
          <h2>Start from the blueprint, not the chaos.</h2>
          <p>
            Sign in to access the redesigned platform with grouped navigation, planner workspaces,
            template flows, and team formation UI.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button
            className={styles.primaryButton}
            onClick={() => void handleSignIn()}
            disabled={submitting}
          >
            {submitting ? 'Connecting…' : 'Sign in with GitHub'}
          </button>
          <Link href="/device" className={styles.secondaryButton}>
            CLI guide
          </Link>
        </div>
      </section>
    </main>
  );
}
