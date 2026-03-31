import Link from "next/link";

export default function NotFound() {
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
              background: "rgba(99, 102, 241, 0.12)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 24px",
              fontSize: "22px",
              fontWeight: 700,
              color: "#a5b4fc"
            }}>
              404
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 700 }}>
              Page not found
            </h1>
            <p style={{ margin: "0 0 28px", color: "#7c92b0", fontSize: "14px", lineHeight: 1.6 }}>
              The page you are looking for does not exist or has been moved.
            </p>
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "10px 24px",
                borderRadius: "10px",
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                color: "#a5b4fc",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none"
              }}
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
