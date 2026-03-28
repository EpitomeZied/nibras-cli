"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { apiFetch, discoverApiBaseUrl } from "../../lib/session";
import NibrasLogo from "../../_components/nibras-logo";

type InvitePreview = {
  code: string;
  courseTitle: string;
  courseCode: string;
  termLabel: string;
  role: string;
  expiresAt: string | null;
};

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch(`/v1/tracking/invites/${code}`);
        if (res.status === 404 || res.status === 410) {
          const body = await res.json() as { error?: string };
          setInviteError(body.error || "Invalid or expired invite.");
          return;
        }
        if (!res.ok) throw new Error("Failed to load invite.");
        setInvite(await res.json() as InvitePreview);
      } catch {
        setInviteError("Unable to load this invite. Check your connection and try again.");
      } finally {
        setLoadingInvite(false);
      }
    })();

    void (async () => {
      try {
        const res = await apiFetch("/v1/web/session", { auth: true });
        setIsAuthenticated(res.ok);
      } catch {
        setIsAuthenticated(false);
      }
    })();
  }, [code]);

  async function handleSignIn() {
    try {
      const apiBaseUrl = await discoverApiBaseUrl();
      const returnTo = `${window.location.href}`;
      window.location.href = `${apiBaseUrl}/v1/github/oauth/start?return_to=${encodeURIComponent(returnTo)}`;
    } catch {
      setJoinError("Could not initiate sign-in. Please try again.");
    }
  }

  async function handleJoin() {
    setJoinError(null);
    setJoining(true);
    try {
      const res = await apiFetch(`/v1/tracking/invites/${code}/join`, {
        method: "POST",
        auth: true
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error || "Failed to join course.");
      }
      router.push("/projects");
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join course.");
      setJoining(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "var(--background, #0d0d0d)"
    }}>
      <div style={{
        maxWidth: 440,
        width: "100%",
        background: "var(--surface, #1a1a1a)",
        border: "1px solid var(--border, #2a2a2a)",
        borderRadius: 12,
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: 24
      }}>
        <div>
          <NibrasLogo variant="theme" width={110} priority />
        </div>

        {loadingInvite && (
          <p style={{ color: "var(--text-muted, #666)", fontSize: 14 }}>Loading invite…</p>
        )}

        {inviteError && (
          <div>
            <h2 style={{ margin: "0 0 8px" }}>Invalid Invite</h2>
            <p style={{ color: "var(--error, #e53e3e)", margin: 0 }}>{inviteError}</p>
          </div>
        )}

        {!loadingInvite && !inviteError && invite && (
          <>
            <div>
              <p style={{ color: "var(--text-muted, #888)", fontSize: 12, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Course Invite
              </p>
              <h2 style={{ margin: "0 0 4px", fontSize: "1.4rem" }}>{invite.courseTitle}</h2>
              <p style={{ color: "var(--text-muted, #888)", margin: "0 0 16px", fontSize: 14 }}>
                {invite.courseCode} &middot; {invite.termLabel}
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={{
                  padding: "3px 10px",
                  background: "var(--accent-dim, rgba(99,102,241,0.15))",
                  color: "var(--accent, #6366f1)",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600
                }}>
                  {invite.role}
                </span>
                {invite.expiresAt && (
                  <span style={{
                    padding: "3px 10px",
                    background: "var(--surface-2, #222)",
                    color: "var(--text-muted, #888)",
                    borderRadius: 20,
                    fontSize: 12
                  }}>
                    Expires {new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>

            {joinError && (
              <p style={{ color: "var(--error, #e53e3e)", fontSize: 13, margin: 0 }}>{joinError}</p>
            )}

            {isAuthenticated ? (
              <button
                onClick={() => void handleJoin()}
                disabled={joining}
                style={{
                  padding: "12px 20px",
                  background: "var(--accent, #6366f1)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: joining ? "not-allowed" : "pointer",
                  opacity: joining ? 0.7 : 1
                }}
              >
                {joining ? "Joining…" : `Join as ${invite.role}`}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "var(--text-muted, #888)", fontSize: 14, margin: 0 }}>
                  Sign in with GitHub to join this course.
                </p>
                <button
                  onClick={() => void handleSignIn()}
                  style={{
                    padding: "12px 20px",
                    background: "var(--accent, #6366f1)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Sign in with GitHub
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
