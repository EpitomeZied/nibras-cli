import { buildApp } from "./app";

/**
 * Validate that all required environment variables are present
 * before the server starts. Exits with a clear error in production.
 */
function validateEnv(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const required = [
    "DATABASE_URL",
    "NIBRAS_ENCRYPTION_KEY",
    "GITHUB_APP_ID",
    "GITHUB_WEBHOOK_SECRET"
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[nibras-api] Missing required environment variables: ${missing.join(", ")}. ` +
      "Set them before starting the server."
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  validateEnv();
  const port = Number(process.env.PORT || "4848");
  const host = process.env.HOST || "127.0.0.1";
  const app = buildApp();
  await app.listen({ port, host });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: "info", msg: "Nibras API started", host, port }));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
