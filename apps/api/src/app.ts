import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rawBodyPlugin from "fastify-raw-body";
import { loadGitHubAppConfig } from "@nibras/github";
import { PrismaStore } from "./prisma-store";
import { AppStore, FileStore, getStorePath } from "./store";
import { registerGitHubRoutes } from "./features/github/routes";
import { registerHostedCliRoutes } from "./features/hosted-cli/routes";
import { registerTrackingRoutes } from "./features/tracking/routes";

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedCorsOrigins(): string[] {
  const configuredOrigins = process.env.NIBRAS_WEB_CORS_ORIGINS;
  const candidates = configuredOrigins
    ? configuredOrigins.split(",")
    : [
        process.env.NIBRAS_WEB_BASE_URL,
        process.env.NEXT_PUBLIC_NIBRAS_WEB_BASE_URL,
        "http://127.0.0.1:3000",
        "http://localhost:3000"
      ];

  const origins = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate?.trim());
    if (normalized) {
      origins.add(normalized);
    }
  }
  return Array.from(origins);
}

function createDefaultStore(): AppStore {
  if (process.env.DATABASE_URL) {
    return new PrismaStore();
  }
  return new FileStore(getStorePath());
}

export function buildApp(store: AppStore = createDefaultStore()): FastifyInstance {
  const app = Fastify({ logger: false });
  const githubConfig = loadGitHubAppConfig();
  const allowedCorsOrigins = new Set(getAllowedCorsOrigins());

  void app.register(cors, {
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type"],
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowedCorsOrigins.has(origin));
    }
  });

  void app.register(rawBodyPlugin, {
    field: "rawBody",
    global: false,
    encoding: false,
    routes: ["/v1/github/webhooks"]
  });

  app.addHook("onClose", async () => {
    if (store.close) {
      await store.close();
    }
  });

  registerGitHubRoutes(app, store, githubConfig);
  registerHostedCliRoutes(app, store, githubConfig);
  registerTrackingRoutes(app, store);

  return app;
}
