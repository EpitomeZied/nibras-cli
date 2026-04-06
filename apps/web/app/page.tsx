'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { discoverApiBaseUrl } from './lib/session';
import NibrasLogo from './_components/nibras-logo';
import styles from './signin.module.css';

function AuthBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get('auth') !== 'required') return null;
  return (
    <div className={styles.authBanner} role="alert">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
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
      {/* Auth required banner */}
      <Suspense>
        <AuthBanner />
      </Suspense>

      {/* Animated orbs */}
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />

      {/* Dot grid */}
      <div className={styles.grid} />

      {/* ── Top nav ─────────────────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <NibrasLogo variant="inverse" width={120} priority />
        </div>
        <div className={styles.navLinks}>
          <a href="#features" className={styles.navLink}>
            Features
          </a>
          <a href="#how-it-works" className={styles.navLink}>
            How it works
          </a>
          <a href="#cli" className={styles.navLink}>
            CLI
          </a>
          <button
            className={styles.navSignIn}
            onClick={() => void handleSignIn()}
            disabled={submitting}
          >
            {submitting ? 'Connecting…' : 'Sign in'}
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.badgeDot} />
          Early Access for Modern Coding Educators
        </div>

        <h1 className={styles.headline}>
          <span className={styles.headlineBright}>Run your coding course</span>
          <br />
          <span className={styles.headlineGrad}>like a real</span>
          <br />
          <span className={styles.headlineMuted}>dev team.</span>
        </h1>

        <p className={styles.sub}>
          Nibras brings GitHub-native submissions, automated grading, and live student progress into
          one smooth workflow — so you spend less time managing and more time teaching.
        </p>

        <div className={styles.heroCtas}>
          <button
            className={styles.btnHeroPrimary}
            onClick={() => void handleSignIn()}
            disabled={submitting}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {submitting ? 'Connecting…' : 'Get started free'}
          </button>
          <a href="#how-it-works" className={styles.btnHeroGhost}>
            See how it works →
          </a>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>0</span>
          <span className={styles.statLabel}>Instructors using Nibras</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNumber}>0</span>
          <span className={styles.statLabel}>Submissions processed</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNumber}>0</span>
          <span className={styles.statLabel}>Courses launched</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNumber}>99.9%</span>
          <span className={styles.statLabel}>Platform uptime</span>
        </div>
      </div>

      {/* ── Features section ────────────────────────────────────────────────── */}
      <section id="features" className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>Features</span>
          <h2 className={styles.sectionTitle}>Everything you need to run a modern coding course</h2>
          <p className={styles.sectionSub}>
            From course setup to grading, Nibras turns scattered tools and manual work into one
            clean, developer-first workflow.
          </p>
        </div>

        <div className={styles.featureGrid6}>
          {[
            {
              icon: (
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
              ),
              title: 'Unified Dashboard',
              desc: 'See every student, milestone, and submission in one live view.',
            },
            {
              icon: (
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              ),
              title: 'GitHub-Backed',
              desc: 'Every submission is a real commit in a real repo — with history you can actually trust.',
            },
            {
              icon: (
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                </svg>
              ),
              title: 'Full Course Control',
              desc: 'Build courses, set rubrics, assign milestones, and review work without the admin mess.',
            },
            {
              icon: (
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
              ),
              title: 'Zero-Friction Setup',
              desc: 'Invite students in, get them set up fast, and let them submit without friction.',
            },
            {
              icon: (
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
              ),
              title: 'Automated Grading',
              desc: 'Get fast, consistent grading in the background — with full control whenever you want it.',
            },
            {
              icon: (
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                </svg>
              ),
              title: 'Developer CLI',
              desc: 'A polished CLI your students will actually enjoy using, with clear feedback at every step.',
            },
          ].map((f) => (
            <div key={f.title} className={styles.featureCard6}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <strong>{f.title}</strong>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>How it works</span>
          <h2 className={styles.sectionTitle}>
            From course setup to graded submissions in minutes
          </h2>
        </div>

        <div className={styles.timeline}>
          {[
            {
              step: '01',
              title: 'Launch your course',
              desc: 'Create projects, milestones, and rubrics in one streamlined dashboard — no setup maze.',
              cta: 'Open dashboard →',
              href: '/dashboard',
            },
            {
              step: '02',
              title: 'Students get started fast',
              desc: 'Install the CLI, connect GitHub, run setup, and start building in minutes.',
              cta: 'View CLI guide →',
              href: '/instructor/onboarding',
            },
            {
              step: '03',
              title: 'Submit. Verify. Grade.',
              desc: 'Students submit from the terminal while Nibras verifies work and delivers results automatically.',
              cta: null,
              href: null,
            },
          ].map((step, i) => (
            <div key={step.step} className={styles.timelineStep}>
              <div className={styles.timelineNumber}>{step.step}</div>
              {i < 2 && <div className={styles.timelineConnector} />}
              <div className={styles.timelineContent}>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                {step.cta && step.href && (
                  <Link href={step.href} className={styles.timelineCta}>
                    {step.cta}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CLI Showcase ────────────────────────────────────────────────────── */}
      <section id="cli" className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>CLI</span>
          <h2 className={styles.sectionTitle}>A CLI students will actually love</h2>
          <p className={styles.sectionSub}>
            Most CLI tools get in the way. Nibras gets out of it — with live feedback, clean output,
            and human-readable errors that make every submission feel smooth.
          </p>
        </div>

        <div className={styles.cliShowcase}>
          <div className={styles.terminalWindow}>
            <div className={styles.terminalTitleBar}>
              <span className={styles.termDot} style={{ background: '#ff5f57' }} />
              <span className={styles.termDot} style={{ background: '#febc2e' }} />
              <span className={styles.termDot} style={{ background: '#28c840' }} />
              <span className={styles.termTitle}>nibras — terminal</span>
            </div>
            <div className={styles.terminalBody}>
              <div className={styles.termLine}>
                <span className={styles.termPrompt}>~</span>
                <span className={styles.termCmd}> nibras submit</span>
              </div>
              <div className={styles.termLine}>
                <span className={styles.termSpinner} aria-hidden="true" />
                <span className={styles.termMuted}> Staging allowed files…</span>
              </div>
              <div className={styles.termLine}>
                <span className={styles.termSuccess}>✓</span>
                <span className={styles.termMuted}> Staged </span>
                <span className={styles.termHighlight}>3 files</span>
              </div>
              <div className={styles.termLine}>
                <span className={styles.termSuccess}>✓</span>
                <span className={styles.termMuted}> Pushed commit </span>
                <span className={styles.termHighlight}>a3f7c1d</span>
              </div>
              <div className={styles.termLine}>
                <span className={styles.termProgress}> Verifying </span>
                <span className={styles.termBar}>██████████████░░░░░░</span>
                <span className={styles.termMuted}> 70%</span>
              </div>
              <div className={styles.termLine} style={{ marginTop: 8 }}>
                <span className={styles.termBoxTop}>╭──────────────────────────────────╮</span>
              </div>
              <div className={styles.termLine}>
                <span className={styles.termBoxSide}>│</span>
                <span className={styles.termSuccess}> ✓ Submission passed </span>
                <span className={styles.termBoxSide}>│</span>
              </div>
              <div className={styles.termLine}>
                <span className={styles.termBoxSide}>│</span>
                <span className={styles.termDimText}> Status: passed </span>
                <span className={styles.termBoxSide}>│</span>
              </div>
              <div className={styles.termLine}>
                <span className={styles.termBoxBottom}>╰──────────────────────────────────╯</span>
              </div>
            </div>
          </div>

          <div className={styles.cliFeatures}>
            {[
              {
                icon: '◉',
                label: 'Live feedback on every step',
                desc: 'Real-time status on every async operation',
              },
              {
                icon: '█',
                label: 'Progress you can actually see',
                desc: 'Visual verification polling with ETA',
              },
              {
                icon: '╭',
                label: 'Clear pass/fail summaries',
                desc: 'Boxed result cards with coloured borders',
              },
              {
                icon: '∿',
                label: 'Built for real developer workflows',
                desc: 'Feels native to the terminal, not bolted on',
              },
            ].map((f) => (
              <div key={f.label} className={styles.cliFeat}>
                <span className={styles.cliFeatIcon}>{f.icon}</span>
                <div>
                  <strong>{f.label}</strong>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof ────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>Why instructors switch to Nibras</span>
          <h2 className={styles.sectionTitle}>
            Less admin. Faster grading. A better experience for both.
          </h2>
        </div>

        <div className={styles.testimonials}>
          {[
            {
              quote: 'blah',
              name: 'Mahmoud AboZied',
              role: 'CS Instructor, State University',
              avatar: '/testimonials/sarah-chen.svg',
            },
            {
              quote: 'blah',
              name: 'Mahmoud AboZied',
              role: 'Bootcamp Lead, TechPath',
              avatar: '/testimonials/marcus-wright.svg',
            },
            {
              quote: 'blah',
              name: 'Mahmoud AboZied',
              role: 'Data Science Professor',
              avatar: '/testimonials/priya-nair.svg',
            },
          ].map((t) => (
            <div key={t.name} className={styles.testimonialCard}>
              <p className={styles.testimonialQuote}>&ldquo;{t.quote}&rdquo;</p>
              <div className={styles.testimonialAuthor}>
                <img
                  src={t.avatar}
                  alt={t.name}
                  className={styles.testimonialAvatar}
                  width={38}
                  height={38}
                />
                <div>
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sign-in card ────────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaCard}>
          <h2 className={styles.ctaTitle}>Build the coding course students actually want to use</h2>
          <p className={styles.ctaSub}>
            Sign in with GitHub, launch your first course, and start teaching with a workflow built
            for real developers.
          </p>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <button
            className={styles.btnGitHub}
            type="button"
            onClick={() => void handleSignIn()}
            disabled={submitting}
          >
            <svg
              className={styles.githubIcon}
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="currentColor"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {submitting ? 'Connecting…' : 'Continue with GitHub'}
          </button>

          <p className={styles.formHint}>Free during early access. No credit card.</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.footerBrandRow}>
              <NibrasLogo variant="inverse" width={100} />
            </div>
            <p className={styles.footerTagline}>
              The developer education platform for serious instructors.
            </p>
          </div>

          <div className={styles.footerLinks}>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Product</span>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href="#cli">CLI</a>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Developers</span>
              <a href="/instructor/onboarding">CLI Setup Guide</a>
              <a
                href="https://github.com/nibras-platform/nibras-cli"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Account</span>
              <button
                onClick={() => void handleSignIn()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                  font: 'inherit',
                }}
              >
                Sign in
              </button>
              <a href="/dashboard">Dashboard</a>
            </div>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} Nibras Platform. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}
