#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

async function main() {
  const modernEntry = path.join(__dirname, "..", "apps", "cli", "dist", "index.js");
  if (fs.existsSync(modernEntry)) {
    const { runCli } = require(modernEntry);
    await runCli(process.argv);
    return;
  }

  const { run } = require("../src/cli");
  await run(process.argv);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
