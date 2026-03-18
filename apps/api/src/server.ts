import { buildApp } from "./app";

async function main(): Promise<void> {
  const port = Number(process.env.PORT || "4848");
  const host = process.env.HOST || "127.0.0.1";
  const app = buildApp();
  await app.listen({ port, host });
  // eslint-disable-next-line no-console
  console.log(`Nibras API listening on http://${host}:${port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
