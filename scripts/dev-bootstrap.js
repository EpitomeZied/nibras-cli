#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const dockerComposeArgs = ["compose"];

function fail(message) {
  console.error(`[dev-bootstrap] ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[dev-bootstrap] ${message}`);
}

function run(command, args, label, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    ...options
  });

  if (result.error) {
    fail(`${label} failed: ${result.error.message}`);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    fail(`${label} exited with code ${result.status}.`);
  }
}

function parseDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    const database = parsed.pathname.replace(/^\//, "");
    if (!database) {
      fail("DATABASE_URL is missing a database name.");
    }
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port || "5432",
      user: decodeURIComponent(parsed.username || "nibras"),
      password: decodeURIComponent(parsed.password || ""),
      database
    };
  } catch (error) {
    fail(`DATABASE_URL is invalid: ${error.message}`);
  }
}

function waitForPostgres(config) {
  const deadline = Date.now() + 60_000;
  const pgReadyArgs = [
    "-h",
    config.host,
    "-p",
    config.port,
    "-U",
    config.user,
    "-d",
    config.database
  ];

  while (Date.now() < deadline) {
    const result = spawnSync("pg_isready", pgReadyArgs, {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        PGPASSWORD: process.env.PGPASSWORD || config.password
      }
    });

    if (result.status === 0) {
      return;
    }

    if (result.error) {
      fail(`Postgres readiness check failed: ${result.error.message}`);
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
  }

  fail("Timed out waiting for Postgres to become ready.");
}

if (!fs.existsSync(envPath)) {
  fail("Missing .env. Copy .env.example first: cp .env.example .env");
}

dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
  fail("Missing DATABASE_URL in .env.");
}

const databaseConfig = parseDatabaseUrl(process.env.DATABASE_URL);
log("Starting local Postgres with docker compose.");
const dockerResult = spawnSync("docker", [...dockerComposeArgs, "up", "-d"], {
  cwd: rootDir,
  stdio: "inherit"
});

if (dockerResult.error) {
  fail(`docker compose up failed: ${dockerResult.error.message}`);
}

if (typeof dockerResult.status === "number" && dockerResult.status !== 0) {
  log("docker compose up failed; continuing because DATABASE_URL may already be backed by a running Postgres instance.");
}

log("Waiting for Postgres readiness.");
waitForPostgres(databaseConfig);
log("Applying Prisma migrations.");
run("npx", ["prisma", "migrate", "deploy"], "prisma migrate deploy");
log("Building workspace packages and services.");
run("npm", ["run", "build"], "npm run build");
