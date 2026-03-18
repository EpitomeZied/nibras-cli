const apiBaseUrl = process.env.NEXT_PUBLIC_NIBRAS_API_BASE_URL || "http://127.0.0.1:4848";

export default function HomePage() {
  const loginUrl = `${apiBaseUrl}/v1/github/oauth/start?return_to=${encodeURIComponent(`${process.env.NEXT_PUBLIC_NIBRAS_WEB_BASE_URL || "http://127.0.0.1:3000"}/auth/complete`)}`;

  return (
    <main>
      <div className="shell">
        <section className="hero">
          <span className="eyebrow">GitHub-linked CLI</span>
          <h1>Nibras is now a real product surface.</h1>
          <p>
            Sign in with GitHub, install the GitHub App, provision project repos,
            and connect the CLI to a hosted backend instead of a local-only demo flow.
          </p>
          <div className="actions">
            <a className="button" href={loginUrl}>Sign in with GitHub</a>
            <a className="button-secondary" href="https://github.com/apps" target="_blank" rel="noreferrer">GitHub Apps</a>
          </div>
        </section>

        <div className="grid">
          <section className="card">
            <span className="badge">CLI</span>
            <p>Use <span className="mono">nibras login</span>, <span className="mono">nibras setup</span>, and <span className="mono">nibras submit</span> locally.</p>
          </section>
          <section className="card">
            <span className="badge">API</span>
            <p>The API handles sessions, GitHub App install URLs, webhook verification, and submission state.</p>
          </section>
          <section className="card">
            <span className="badge">Web</span>
            <p>The dashboard links your GitHub account, completes installation, and shows account state without relying on a fake scaffold.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
