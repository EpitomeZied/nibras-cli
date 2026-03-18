import fs from "node:fs";
import path from "node:path";
import { CliConfig, CliConfigSchema } from "@nibras/contracts";
import { getDefaultApiBaseUrl, getGlobalConfigPath } from "./paths";

export function readCliConfig(): CliConfig {
  const configPath = getGlobalConfigPath();
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return CliConfigSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { apiBaseUrl: getDefaultApiBaseUrl() };
    }
    throw err;
  }
}

export function writeCliConfig(config: CliConfig): string {
  const configPath = getGlobalConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(CliConfigSchema.parse(config), null, 2)}\n`, { mode: 0o600 });
  return configPath;
}

export function clearCliSession(): CliConfig {
  const current = readCliConfig();
  const nextConfig: CliConfig = {
    apiBaseUrl: current.apiBaseUrl,
    defaultOrg: current.defaultOrg,
    telemetryOptIn: current.telemetryOptIn
  };
  writeCliConfig(nextConfig);
  return nextConfig;
}
