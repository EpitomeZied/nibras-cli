'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import NibrasLogo from './_components/nibras-logo';
import { discoverApiBaseUrl } from './lib/session';
import styles from './signin.module.css';

const pillars = [
  {
    title: 'Course Delivery',
    copy: 'Run publishing, milestones, submissions, and review from one instructor workspace.',
    badge: 'Core',
  },
  {
    title: 'Team Project Operations',
    copy: 'Create reusable templates, collect role applications, generate teams, and lock rosters cleanly.',
    badge: 'Early Access',
  },
  {
    title: 'Academic Program Planning',
    copy: 'Support tracks, petitions, printable sheets, and requirement-aware planning for students.',
    badge: 'Early Access',
  },
  {
    title: 'CLI + GitHub Infrastructure',
    copy: 'Keep setup, testing, and submission GitHub-native with a polished terminal workflow.',
    badge: 'Core',
  },
];

const teamWorkflow = [
  {
    step: '01',
    title: 'Start from a template',
    copy: 'Instructors define a reusable project blueprint with team size, role structure, and repeatable launch settings.',
  },
  {
    step: '02',
    title: 'Students rank roles',
    copy: 'Each student submits a role application with ranked preferences, skills, and availability constraints.',
  },
  {
    step: '03',
    title: 'Generate and lock teams',
    copy: 'Nibras previews suggested teams, highlights waitlists, and locks the final roster before shared submissions begin.',
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

      <div className={styles.backdrop} />
      <div className={styles.grid} />

      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <NibrasLogo variant="inverse" width={114} priority />
          <span className={styles.betaBadge}>Unified Platform</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#pillars">Platform</a>
          <a href="#team-workflow">Team Projects</a>
          <a href="#planner-workflow">Planner</a>
          <a href="#cli">CLI</a>
          <button
            className={styles.navButton}
            onClick={() => void handleSignIn()}
            disabled={submitting}
          >
            {submitting ? 'Connecting…' : 'Sign in'}
          </button>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>Modern Academic Workflows</span>
          <h1>
            Run courses, team projects, and university-style planning
            <span> from one platform.</span>
          </h1>
          <p className={styles.heroText}>
            Nibras connects project templates, role applications, team formation, academic program
            planning, GitHub-backed submissions, and a real developer CLI into one coherent system.
          </p>

          <div className={styles.heroActions}>
            <button
              className={styles.primaryButton}
              onClick={() => void handleSignIn()}
              disabled={submitting}
            >
              {submitting ? 'Connecting…' : 'Open Nibras'}
            </button>
            <a href="#pillars" className={styles.secondaryButton}>
              Explore features
            </a>
          </div>

          <div className={styles.heroStats}>
            <div>
              <strong>Templates</strong>
              <span>Reusable project blueprints</span>
            </div>
            <div>
              <strong>Team Ops</strong>
              <span>Applications to locked rosters</span>
            </div>
            <div>
              <strong>Planner</strong>
              <span>Tracks, petitions, printable sheets</span>
            </div>
          </div>

          {error && <p className={styles.errorBox}>{error}</p>}
        </div>

        <div className={styles.heroPreview}>
          <article className={styles.previewCard}>
            <div className={styles.previewBar}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.previewHeader}>
              <span className={styles.previewBadge}>Template Builder</span>
              <strong>Capstone Team Project</strong>
            </div>
            <div className={styles.previewList}>
              <div>
                <span>Delivery mode</span>
                <strong>Team</strong>
              </div>
              <div>
                <span>Team size</span>
                <strong>3 students</strong>
              </div>
              <div>
                <span>Roles</span>
                <strong>Lead, Research, QA</strong>
              </div>
            </div>
          </article>

          <article className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <span className={styles.previewBadge}>Team Formation</span>
              <strong>Suggested Teams</strong>
            </div>
            <div className={styles.teamPreview}>
              <div>
                <strong>Team A</strong>
                <span>Mariam · Lead</span>
                <span>Omar · Research</span>
                <span>Nour · QA</span>
              </div>
              <div>
                <strong>Team B</strong>
                <span>Hana · Lead</span>
                <span>Youssef · Research</span>
                <span>Lina · QA</span>
              </div>
            </div>
          </article>

          <article className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <span className={styles.previewBadge}>Program Sheet</span>
              <strong>Requirement Snapshot</strong>
            </div>
            <div className={styles.sheetPreview}>
              <div>
                <span>Foundation</span>
                <strong>Satisfied</strong>
              </div>
              <div>
                <span>Core</span>
                <strong>2 courses left</strong>
              </div>
              <div>
                <span>Track</span>
                <strong>AI Systems</strong>
              </div>
              <div>
                <span>Petitions</span>
                <strong>1 pending</strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="pillars" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>Product Pillars</span>
          <h2>Everything Nibras now ships, organized around real workflows.</h2>
          <p>
            The platform is no longer just a submission dashboard. It now spans reusable project
            setup, team coordination, and degree planning.
          </p>
        </div>

        <div className={styles.pillarGrid}>
          {pillars.map((pillar) => (
            <article key={pillar.title} className={styles.pillarCard}>
              <div className={styles.pillarTop}>
                <strong>{pillar.title}</strong>
                <span>{pillar.badge}</span>
              </div>
              <p>{pillar.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="team-workflow" className={styles.section}>
        <div className={styles.splitSection}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Team Project Operations</span>
            <h2>From reusable template to locked team roster.</h2>
            <p>
              Templates define the structure. Students rank roles. Instructors generate previews,
              inspect the result, and lock teams before final work begins.
            </p>
          </div>

          <div className={styles.workflowList}>
            {teamWorkflow.map((item) => (
              <article key={item.step} className={styles.workflowCard}>
                <span>{item.step}</span>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="planner-workflow" className={styles.section}>
        <div className={styles.splitSection}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Academic Program Planning</span>
            <h2>Tracks, petitions, approvals, and printable sheets in one student planner.</h2>
            <p>
              Students can enroll in a program, choose tracks when eligible, manage planned courses,
              and produce a clear requirement-aware record for advisor review.
            </p>
          </div>

          <div className={styles.auditCard}>
            <div className={styles.auditTop}>
              <strong>Planner Overview</strong>
              <span>Early Access</span>
            </div>
            <div className={styles.auditGrid}>
              <div>
                <span>Track</span>
                <strong>Selected</strong>
              </div>
              <div>
                <span>Petitions</span>
                <strong>1 pending</strong>
              </div>
              <div>
                <span>Approvals</span>
                <strong>Advisor ready</strong>
              </div>
              <div>
                <span>Printable sheet</span>
                <strong>Snapshot available</strong>
              </div>
            </div>
            <p>
              Requirement groups, petitions, and approvals stay connected instead of living in
              separate spreadsheets or advisor email threads.
            </p>
          </div>
        </div>
      </section>

      <section id="cli" className={styles.section}>
        <div className={styles.splitSection}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>CLI + GitHub Foundation</span>
            <h2>The student experience still feels like developer tooling.</h2>
            <p>
              Setup, testing, and submission remain GitHub-native and CLI-first, while the web app
              handles planning, review, and coordination workflows around that foundation.
            </p>
          </div>

          <div className={styles.cliCard}>
            <pre>{`$ nibras setup
$ nibras test
$ nibras submit

Project template: linked
Team workflow: ready
Program planner: synced`}</pre>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div>
          <span className={styles.sectionEyebrow}>Ready to Organize the Platform?</span>
          <h2>Open the unified Nibras workspace.</h2>
          <p>
            Sign in with GitHub to access project templates, team formation tools, the planner, and
            the instructor workspace.
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

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <NibrasLogo variant="inverse" width={108} />
          <p>
            Project templates, team formation, and academic planning for modern learning workflows.
          </p>
        </div>
        <div className={styles.footerLinks}>
          <a href="#pillars">Platform</a>
          <a href="#team-workflow">Team Projects</a>
          <a href="#planner-workflow">Planner</a>
          <a href="#cli">CLI</a>
        </div>
      </footer>
    </main>
  );
}
