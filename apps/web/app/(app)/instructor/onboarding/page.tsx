'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import CliCodeBlock from '../../_components/cli-code-block';
import TerminalMockup, { type TerminalLine } from '../../_components/terminal-mockup';
import styles from './page.module.css';

// ── OS type ──────────────────────────────────────────────────────────────────
type OS = 'mac' | 'linux' | 'windows';

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'mac';
  const p = navigator.platform?.toLowerCase() ?? '';
  const ua = navigator.userAgent?.toLowerCase() ?? '';
  if (p.includes('win') || ua.includes('windows')) return 'windows';
  if (p.includes('linux') || ua.includes('linux')) return 'linux';
  return 'mac';
}

// ── OS-aware code block ───────────────────────────────────────────────────────
function OsCode({
  os,
  mac,
  linux,
  windows,
}: {
  os: OS;
  mac: string;
  linux?: string;
  windows?: string;
}) {
  const code = os === 'windows' ? (windows ?? mac) : os === 'linux' ? (linux ?? mac) : mac;
  return <CliCodeBlock code={code} />;
}

// ── Terminal outputs ──────────────────────────────────────────────────────────
const loginOutput: TerminalLine[] = [
  { type: 'cmd', text: 'nibras login' },
  { type: 'blank' },
  { type: 'output', text: '  Open  https://nibras-web.fly.dev/device?user_code=ABCD-1234' },
  { type: 'output', text: '  Code  ABCD-1234' },
  { type: 'blank' },
  { type: 'muted', text: '  ⠋ Waiting for browser authorization…' },
  { type: 'blank' },
  { type: 'success', text: '╭─────────────────────────────────────────╮' },
  { type: 'success', text: '│  ✓  Authenticated as jsmith             │' },
  { type: 'muted', text: '│  User:    jsmith                        │' },
  { type: 'muted', text: '│  GitHub:  jsmith                        │' },
  { type: 'muted', text: '│  API:     https://nibras-api.fly.dev    │' },
  { type: 'success', text: '╰─────────────────────────────────────────╯' },
];

const setupOutput: TerminalLine[] = [
  { type: 'cmd', text: 'nibras setup --project cs101/assignment-1' },
  { type: 'blank' },
  { type: 'muted', text: '  ⠋ Setting up project cs101/assignment-1…' },
  { type: 'muted', text: '  ⠋ Writing project manifest…' },
  { type: 'success', text: '  ✓ Project set up' },
  { type: 'blank' },
  { type: 'success', text: '╭────────────────────────────────────────────╮' },
  { type: 'success', text: '│  ✓  Project ready: cs101/assignment-1      │' },
  { type: 'muted', text: '│  Project: cs101/assignment-1               │' },
  { type: 'muted', text: '│  Repo:    nibras-platform/cs101-jsmith     │' },
  { type: 'muted', text: '│  Next steps:                               │' },
  { type: 'muted', text: '│    nibras task    — view task instructions │' },
  { type: 'muted', text: '│    nibras test    — run local tests        │' },
  { type: 'muted', text: '│    nibras submit  — submit your solution   │' },
  { type: 'success', text: '╰────────────────────────────────────────────╯' },
];

const submitOutput: TerminalLine[] = [
  { type: 'cmd', text: 'nibras submit' },
  { type: 'blank' },
  { type: 'success', text: '  ✓ Staged 3 files' },
  { type: 'success', text: '  ✓ Pushed commit a3f7c1d' },
  { type: 'output', text: '  Verifying  ████████████████░░░░  80%' },
  { type: 'blank' },
  { type: 'success', text: '╭──────────────────────────────╮' },
  { type: 'success', text: '│  ✓  Submission passed ✓      │' },
  { type: 'muted', text: '│  Status:  passed             │' },
  { type: 'success', text: '╰──────────────────────────────╯' },
];

// ── Step definition ───────────────────────────────────────────────────────────
const STEPS = [
  { id: 'step-01', number: '01', label: 'Prerequisites' },
  { id: 'step-02', number: '02', label: 'Install the CLI' },
  { id: 'step-03', number: '03', label: 'Authenticate' },
  { id: 'step-04', number: '04', label: 'Create a course' },
  { id: 'step-05', number: '05', label: 'Set up a project' },
  { id: 'step-06', number: '06', label: 'Run tests' },
  { id: 'step-07', number: '07', label: 'Submit' },
  { id: 'step-08', number: '08', label: 'Check status' },
  { id: 'step-09', number: '09', label: 'Share with students' },
];

// ── Section with collapsible + scroll anchor ──────────────────────────────────
function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section id={id} className={styles.section}>
      <button
        className={styles.sectionHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className={styles.stepBadge}>{number}</div>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

function CheckItem({ label }: { label: React.ReactNode }) {
  return (
    <div className={styles.checkItem}>
      <span className={styles.checkIcon}>○</span>
      <span>{label}</span>
    </div>
  );
}

// ── OS Tab bar ────────────────────────────────────────────────────────────────
function OsTabs({ os, setOs }: { os: OS; setOs: (v: OS) => void }) {
  const tabs: { value: OS; label: string; icon: string }[] = [
    { value: 'mac', label: 'macOS', icon: '' },
    { value: 'linux', label: 'Linux', icon: '🐧' },
    { value: 'windows', label: 'Windows', icon: '⊞' },
  ];
  return (
    <div className={styles.osTabs}>
      {tabs.map((t) => (
        <button
          key={t.value}
          className={`${styles.osTab} ${os === t.value ? styles.osTabActive : ''}`}
          onClick={() => setOs(t.value)}
        >
          <span className={styles.osTabIcon}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [os, setOs] = useState<OS>('mac');
  const [activeStep, setActiveStep] = useState('step-01');

  // Detect OS on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nibras.onboarding.os') as OS | null;
      setOs(saved ?? detectOS());
    } catch {
      setOs(detectOS());
    }
  }, []);

  // Persist OS selection
  function handleSetOs(v: OS) {
    setOs(v);
    try {
      localStorage.setItem('nibras.onboarding.os', v);
    } catch {
      /* ignore */
    }
  }

  // IntersectionObserver — track active section
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    STEPS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveStep(id);
        },
        { rootMargin: '-20% 0px -70% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const configPath =
    os === 'windows' ? '%APPDATA%\\nibras\\config.json' : '~/.config/nibras/config.json';

  const dirExample =
    os === 'windows'
      ? 'nibras setup --project cs101/a1 --dir C:\\projects\\a1'
      : 'nibras setup --project cs101/a1 --dir ~/projects/a1';

  return (
    <div className={styles.pageWrapper}>
      {/* ── Step nav sidebar ─────────────────────────────────────────────── */}
      <nav className={styles.stepNav} aria-label="Steps">
        {STEPS.map(({ id, number, label }) => (
          <button
            key={id}
            className={`${styles.stepNavItem} ${activeStep === id ? styles.stepNavItemActive : ''}`}
            onClick={() => scrollTo(id)}
          >
            <span className={styles.stepNavNum}>{number}</span>
            <span className={styles.stepNavLabel}>{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className={styles.page}>
        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.heroBadge}>CLI Setup Guide</div>
          <h1 className={styles.heroTitle}>Get the Nibras CLI running</h1>
          <p className={styles.heroSub}>
            Install the CLI, authenticate with GitHub, create a project, and make your first
            submission — step by step, for your OS.
          </p>
          <OsTabs os={os} setOs={handleSetOs} />
          <div className={styles.heroActions}>
            <Link href="/instructor/courses/new" className={styles.btnPrimary}>
              Create a course first →
            </Link>
            <a
              href="https://github.com/nibras-platform/nibras-cli"
              target="_blank"
              rel="noreferrer"
              className={styles.btnGhost}
            >
              GitHub →
            </a>
          </div>
        </div>

        <div className={styles.content}>
          {/* 01 Prerequisites */}
          <Section id="step-01" number="01" title="Prerequisites">
            <p className={styles.bodyText}>
              Make sure you have these tools installed before continuing.
            </p>

            {os === 'windows' && (
              <div className={`${styles.callout} ${styles.calloutInfo}`}>
                <span className={styles.calloutIcon}>⊞</span>
                <p>
                  We recommend using <strong>Git Bash</strong> or <strong>WSL</strong> for the best
                  experience. PowerShell works but some commands and paths may differ.
                </p>
              </div>
            )}

            <div className={styles.checkList}>
              <CheckItem
                label={
                  <>
                    <strong>Node.js ≥ 18</strong> —{' '}
                    {os === 'linux' ? (
                      <>
                        install via{' '}
                        <a
                          href="https://github.com/nvm-sh/nvm"
                          target="_blank"
                          rel="noreferrer"
                          className={styles.link}
                        >
                          nvm
                        </a>{' '}
                        or{' '}
                        <a
                          href="https://nodejs.org"
                          target="_blank"
                          rel="noreferrer"
                          className={styles.link}
                        >
                          nodejs.org
                        </a>
                      </>
                    ) : os === 'windows' ? (
                      <>
                        download the Windows installer from{' '}
                        <a
                          href="https://nodejs.org"
                          target="_blank"
                          rel="noreferrer"
                          className={styles.link}
                        >
                          nodejs.org
                        </a>
                      </>
                    ) : (
                      <>
                        download from{' '}
                        <a
                          href="https://nodejs.org"
                          target="_blank"
                          rel="noreferrer"
                          className={styles.link}
                        >
                          nodejs.org
                        </a>{' '}
                        or use <code className={styles.inlineCode}>brew install node</code>
                      </>
                    )}
                  </>
                }
              />
              <CheckItem
                label={
                  <>
                    <strong>Git</strong> — installed and configured with{' '}
                    <code className={styles.inlineCode}>
                      git config --global user.name &quot;Your Name&quot;
                    </code>
                    {os === 'windows' && (
                      <span style={{ color: 'var(--text-soft)', fontSize: 13 }}>
                        {' '}
                        (run in Git Bash or WSL)
                      </span>
                    )}
                  </>
                }
              />
              <CheckItem
                label={
                  <>
                    <strong>GitHub account</strong> — you&apos;ll authenticate with GitHub OAuth in
                    step 3
                  </>
                }
              />
            </div>
          </Section>

          {/* 02 Install */}
          <Section id="step-02" number="02" title="Install the CLI">
            <p className={styles.bodyText}>
              Install <code className={styles.inlineCode}>@nibras/cli</code> globally via npm to get
              the <code className={styles.inlineCode}>nibras</code> command available anywhere.
            </p>

            {os === 'windows' && (
              <div className={`${styles.callout} ${styles.calloutInfo}`}>
                <span className={styles.calloutIcon}>💡</span>
                <p>
                  On Windows, run your terminal (<strong>PowerShell</strong> or{' '}
                  <strong>Git Bash</strong>) as <strong>Administrator</strong> when installing
                  global npm packages.
                </p>
              </div>
            )}

            <OsCode
              os={os}
              mac="npm install -g @nibras/cli"
              linux="npm install -g @nibras/cli"
              windows="npm install -g @nibras/cli"
            />
            <p className={styles.bodyText}>Or run without installing using npx:</p>
            <CliCodeBlock code="npx @nibras/cli --help" />
            <p className={styles.hint}>
              Verify the install: <code className={styles.inlineCode}>nibras --version</code>
            </p>
          </Section>

          {/* 03 Authenticate */}
          <Section id="step-03" number="03" title="Authenticate with GitHub">
            <p className={styles.bodyText}>
              Run <code className={styles.inlineCode}>nibras login</code> to start the device
              authorization flow. A URL and short code will be printed — open the URL in your
              browser, enter the code, and approve access.
            </p>
            <CliCodeBlock code="nibras login" />
            <div className={styles.terminalWrapper}>
              <TerminalMockup title="nibras login" lines={loginOutput} />
            </div>
            <p className={styles.hint}>
              Credentials are stored in <code className={styles.inlineCode}>{configPath}</code>. Run{' '}
              <code className={styles.inlineCode}>nibras whoami</code> to confirm.
            </p>
          </Section>

          {/* 04 Create a course */}
          <Section id="step-04" number="04" title="Create a course (web)">
            <p className={styles.bodyText}>
              Before students can use the CLI, create a course and at least one project from the web
              dashboard.
            </p>
            <ol className={styles.steps}>
              <li>
                Go to <strong>Instructor → New Course</strong>
              </li>
              <li>
                Enter the course code (e.g. <code className={styles.inlineCode}>cs101</code>),
                title, and term
              </li>
              <li>Add a project with an allowed file path pattern</li>
              <li>
                Copy the project key (e.g.{' '}
                <code className={styles.inlineCode}>cs101/assignment-1</code>)
              </li>
            </ol>
            <Link href="/instructor/courses/new" className={styles.btnPrimary}>
              Open course creator →
            </Link>
          </Section>

          {/* 05 Setup */}
          <Section id="step-05" number="05" title="Set up a project locally">
            <p className={styles.bodyText}>
              Run <code className={styles.inlineCode}>nibras setup</code> with the project key to
              bootstrap the local directory. This creates a{' '}
              <code className={styles.inlineCode}>.nibras/project.json</code> manifest and
              initialises a git repository.
            </p>
            <CliCodeBlock code="nibras setup --project cs101/assignment-1" />
            <div className={styles.terminalWrapper}>
              <TerminalMockup title="nibras setup" lines={setupOutput} />
            </div>
            <p className={styles.hint}>
              Specify a target directory: <code className={styles.inlineCode}>{dirExample}</code>
            </p>
          </Section>

          {/* 06 Tests */}
          <Section id="step-06" number="06" title="Run local tests">
            <p className={styles.bodyText}>
              Use <code className={styles.inlineCode}>nibras test</code> to run the public test
              suite from the project manifest. Pass{' '}
              <code className={styles.inlineCode}>--previous</code> to include earlier milestone
              tests.
            </p>
            <CliCodeBlock
              code={`nibras test\nnibras test --previous   # include previous milestone tests`}
            />
            <p className={styles.hint}>
              Tests run the command in{' '}
              <code className={styles.inlineCode}>.nibras/project.json → test.command</code>. A
              non-zero exit means tests failed.
            </p>
          </Section>

          {/* 07 Submit */}
          <Section id="step-07" number="07" title="Submit your solution">
            <p className={styles.bodyText}>
              <code className={styles.inlineCode}>nibras submit</code> stages allowed files, creates
              a commit, pushes to origin, and polls for automated verification.
            </p>
            <CliCodeBlock code="nibras submit" />
            <div className={styles.terminalWrapper}>
              <TerminalMockup title="nibras submit" lines={submitOutput} />
            </div>
            <div className={styles.callout}>
              <span className={styles.calloutIcon}>💡</span>
              <p>
                Only files matching{' '}
                <code className={styles.inlineCode}>submission.allowedPaths</code> in your manifest
                are included — students can&apos;t accidentally submit test or grading files.
              </p>
            </div>
          </Section>

          {/* 08 Status */}
          <Section id="step-08" number="08" title="Check status">
            <p className={styles.bodyText}>Two diagnostic commands are available at any time:</p>
            <CliCodeBlock
              code={`nibras ping    # check API, auth, GitHub, and repo state\nnibras whoami  # show signed-in user and linked GitHub account`}
            />
            <p className={styles.hint}>
              <code className={styles.inlineCode}>nibras ping</code> shows a colour-coded status
              table — green means all systems go.
            </p>
          </Section>

          {/* 09 Share */}
          <Section id="step-09" number="09" title="Share with students">
            <p className={styles.bodyText}>
              Students follow the same flow: install the CLI, run{' '}
              <code className={styles.inlineCode}>nibras login</code>, and{' '}
              <code className={styles.inlineCode}>nibras setup --project &lt;key&gt;</code>. Share
              the project key with your class.
            </p>

            {os === 'windows' && (
              <div className={`${styles.callout} ${styles.calloutInfo}`}>
                <span className={styles.calloutIcon}>⊞</span>
                <p>
                  Remind Windows students to run the commands in <strong>Git Bash</strong>,{' '}
                  <strong>WSL</strong>, or <strong>PowerShell (Admin)</strong>.
                </p>
              </div>
            )}

            <div className={styles.shareCard}>
              <div className={styles.shareCardTitle}>Student quick-start</div>
              <CliCodeBlock
                code={`npm install -g @nibras/cli\nnibras login\nnibras setup --project cs101/assignment-1\nnibras test\nnibras submit`}
              />
            </div>
            <p className={styles.hint}>
              Students can view task instructions at any time with{' '}
              <code className={styles.inlineCode}>nibras task</code>.
            </p>
          </Section>

          {/* Footer CTA */}
          <div className={styles.footerCta}>
            <h3>Ready to create your first course?</h3>
            <p>Set up a course and project on the web, then share the project key with students.</p>
            <div className={styles.footerCtaActions}>
              <Link href="/instructor/courses/new" className={styles.btnPrimary}>
                Create a course →
              </Link>
              <Link href="/instructor" className={styles.btnGhost}>
                Back to Instructor
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
