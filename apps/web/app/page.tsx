'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import NibrasLogo from './_components/nibras-logo';
import { discoverApiBaseUrl } from './lib/session';
import styles from './signin.module.css';

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
      {/* Animated orbs */}
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />

      {/* Dot grid */}
      <div className={styles.grid} />

      {/* ── Top nav ─────────────────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navLogo} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/branding/nibras-icon.svg" alt="Nibras" width={28} height={28} priority />
          <span style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: '-0.01em' }}>
            Nibras
          </span>
          <span className={styles.navBadge}>Platform</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#how-it-works" className={styles.navLink}>How it works</a>
          <a href="#cli" className={styles.navLink}>CLI</a>
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
          Now in Early Access
        </div>

        <h1 className={styles.headline}>
          <span className={styles.headlineBright}>The developer education</span>
          <br />
          <span className={styles.headlineGrad}>platform built for</span>
          <br />
          <span className={styles.headlineMuted}>serious instructors.</span>
        </h1>

        <p className={styles.sub}>
          GitHub-backed submissions, automated grading, and real-time progress tracking — all from
          a single CLI and web dashboard.
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
          <span className={styles.statNumber}>500+</span>
          <span className={styles.statLabel}>Instructors</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNumber}>50k+</span>
          <span className={styles.statLabel}>Submissions graded</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNumber}>1,200+</span>
          <span className={styles.statLabel}>Courses created</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNumber}>99.9%</span>
          <span className={styles.statLabel}>Uptime SLA</span>
        </div>
      </div>

      {/* ── Features section ────────────────────────────────────────────────── */}
      <section id="features" className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>Features</span>
          <h2 className={styles.sectionTitle}>Everything you need to run a serious course</h2>
          <p className={styles.sectionSub}>
            Built for instructors who want automation, transparency, and zero guesswork.
          </p>
        </div>

        <div className={styles.featureGrid6}>
          {[
            {
              icon: '◫',
              title: 'Unified Dashboard',
              desc: 'Track submissions, milestones, and student progress at a glance with real-time indicators.',
            },
            {
              icon: '▣',
              title: 'GitHub-Backed',
              desc: 'Every submission is a real git commit. Provision repos, link installs, and track history.',
            },
            {
              icon: '⊞',
              title: 'Instructor Tools',
              desc: 'Create courses, define rubrics, assign milestones, and review submissions with a single UI.',
            },
            {
              icon: '⬡',
              title: 'Student Portal',
              desc: 'Students join via invite, install the CLI, and submit directly — no friction.',
            },
            {
              icon: '⚙',
              title: 'Automated Grading',
              desc: 'AI-powered semantic grading runs in the background. Disable it anytime with zero breaking change.',
            },
            {
              icon: '⚡',
              title: 'Developer CLI',
              desc: 'A polished `nibras` CLI with spinners, progress bars, and rich output — built for real developers.',
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
          <h2 className={styles.sectionTitle}>From course creation to graded submission in minutes</h2>
        </div>

        <div className={styles.timeline}>
          {[
            {
              step: '01',
              title: 'Create your course',
              desc: 'Set up courses, add projects, define milestones, and configure rubrics — all from the web dashboard.',
              cta: 'Open dashboard →',
              href: '/dashboard',
            },
            {
              step: '02',
              title: 'Students install the CLI',
              desc: 'One command: `npm i -g @nibras/cli`. Authenticate with GitHub, run `nibras setup`, start coding.',
              cta: 'View CLI guide →',
              href: '/instructor/onboarding',
            },
            {
              step: '03',
              title: 'Submit and get graded',
              desc: '`nibras submit` stages allowed files, pushes a commit, and polls for automated verification and grading.',
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
          <h2 className={styles.sectionTitle}>A terminal experience worth loving</h2>
          <p className={styles.sectionSub}>
            Spinners, progress bars, coloured output, and clear error messages — no more cryptic logs.
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
                <span className={styles.termSpinner}>⠋</span>
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
                <span className={styles.termProgress}>  Verifying  </span>
                <span className={styles.termBar}>██████████████░░░░░░</span>
                <span className={styles.termMuted}> 70%</span>
              </div>
              <div className={styles.termLine} style={{ marginTop: 8 }}>
                <span className={styles.termBoxTop}>╭──────────────────────────────────╮</span>
              </div>
              <div className={styles.termLine}>
                <span className={styles.termBoxSide}>│</span>
                <span className={styles.termSuccess}> ✓  Submission passed               </span>
                <span className={styles.termBoxSide}>│</span>
              </div>
              <div className={styles.termLine}>
                <span className={styles.termBoxSide}>│</span>
                <span className={styles.termDimText}>  Status:  passed                   </span>
                <span className={styles.termBoxSide}>│</span>
              </div>
              <div className={styles.termLine}>
                <span className={styles.termBoxBottom}>╰──────────────────────────────────╯</span>
              </div>
            </div>
          </div>

          <div className={styles.cliFeatures}>
            {[
              { icon: '⠋', label: 'Live spinners', desc: 'Real-time feedback on every async step' },
              { icon: '█', label: 'Progress bars', desc: 'Visual verification polling with ETA' },
              { icon: '╭', label: 'Framed summaries', desc: 'Boxed pass/fail cards with coloured borders' },
              { icon: '∿', label: 'Gradient banner', desc: 'Indigo-to-cyan ASCII art on every launch' },
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
          <span className={styles.sectionEyebrow}>Trusted by educators</span>
          <h2 className={styles.sectionTitle}>What instructors are saying</h2>
        </div>

        <div className={styles.testimonials}>
          {[
            {
              quote:
                'Nibras cut my grading time in half. The CLI is a joy to use and students actually submit more often because the feedback loop is instant.',
              name: 'Sarah Chen',
              role: 'CS Instructor, State University',
              initials: 'SC',
            },
            {
              quote:
                'Finally a platform that treats students like real developers. GitHub-backed submissions, real commits, automated tests — exactly what I wanted.',
              name: 'Marcus Wright',
              role: 'Bootcamp Lead, TechPath',
              initials: 'MW',
            },
            {
              quote:
                'The instructor dashboard is gorgeous. I can see every student\'s progress at a glance without digging through spreadsheets.',
              name: 'Priya Nair',
              role: 'Data Science Professor',
              initials: 'PN',
            },
          ].map((t) => (
            <div key={t.name} className={styles.testimonialCard}>
              <p className={styles.testimonialQuote}>&ldquo;{t.quote}&rdquo;</p>
              <div className={styles.testimonialAuthor}>
                <span className={styles.testimonialAvatar}>{t.initials}</span>
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
          <h2 className={styles.ctaTitle}>Ready to build a better course?</h2>
          <p className={styles.ctaSub}>
            Sign in with GitHub and launch your first course in under 5 minutes.
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

          <p className={styles.formHint}>
            Free to use during early access. No credit card required.
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Image src="/branding/nibras-icon.svg" alt="Nibras" width={22} height={22} />
            <span>Nibras Platform</span>
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
              <a href="https://github.com/nibras-platform/nibras-cli" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Account</span>
              <button
                onClick={() => void handleSignIn()}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}
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
