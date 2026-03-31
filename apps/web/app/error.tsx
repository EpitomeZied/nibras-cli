"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in dev; in production a Sentry integration would capture this
    console.error("[Nibras] Unhandled error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#06060a", color: "#f1f5f9", fontFamily: "Inter, Segoe UI, sans-serif" }}>
        <div style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "32px"
        }}>
          <div style={{
            maxWidth: "480px",
            width: "100%",
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px",
            padding: "40px",
            textAlign: "center"
          }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "rgba(248, 113, 113, 0.12)",
              border: "1px solid rgba(248, 113, 113, 0.25)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 24px",
              fontSize: "28px"
            }}>
              &#9888;
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 700 }}>
              Something went wrong
            </h1>
            <p style={{ margin: "0 0 28px", color: "#7c92b0", fontSize: "14px", lineHeight: 1.6 }}>
              An unexpected error occurred. If this keeps happening, please contact support.
            </p>
            {error.digest && (
              <p style={{ margin: "0 0 24px", fontFamily: "monospace", fontSize: "12px", color: "#4a6080" }}>
                Error ID: {error.digest}
              </p>
            )}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "rgba(99, 102, 241, 0.15)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  color: "#a5b4fc",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600
                }}
              >
                Try again
              </button>
              <Link
                href="/dashboard"
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "#7c92b0",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center"
                }}
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
