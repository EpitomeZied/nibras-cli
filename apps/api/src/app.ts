import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import * as Sentry from '@sentry/node';
import rawBodyPlugin from 'fastify-raw-body';
import { Counter, Registry, collectDefaultMetrics } from 'prom-client';
import { PrismaClient } from '@prisma/client';
import { loadGitHubAppConfig } from '@nibras/github';
import { PrismaStore } from './prisma-store';
import { AppStore, FileStore, getStorePath } from './store';
import { registerGitHubRoutes } from './features/github/routes';
import { registerHostedCliRoutes } from './features/hosted-cli/routes';
import { registerTrackingRoutes } from './features/tracking/routes';
import { registerAdminRoutes } from './features/admin/routes';
import { registerNotificationRoutes } from './features/notifications/routes';
import { registerProgramRoutes } from './features/programs/routes';

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
    ? configuredOrigins.split(',')
    : [
        process.env.NIBRAS_WEB_BASE_URL,
        process.env.NEXT_PUBLIC_NIBRAS_WEB_BASE_URL,
        'http://127.0.0.1:3000',
        'http://localhost:3000',
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
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
    genReqId: () => `req_${Math.random().toString(36).slice(2, 10)}`,
    connectionTimeout: Number(process.env.CONNECTION_TIMEOUT_MS ?? 10_000),
    requestTimeout: Number(process.env.REQUEST_TIMEOUT_MS ?? 30_000),
    // 512 KB default — configurable via BODY_LIMIT_BYTES
    bodyLimit: Number(process.env.BODY_LIMIT_BYTES ?? 524_288),
  });

  const githubConfig = loadGitHubAppConfig();
  const allowedCorsOrigins = new Set(getAllowedCorsOrigins());

  // Security headers — registered first so they apply to all routes
  void app.register(helmet, { contentSecurityPolicy: false });

  // ── OpenAPI / Swagger ────────────────────────────────────────────────────
  // Docs available at /docs (UI) and /docs/json (raw spec).
  // Disabled in production unless NIBRAS_SWAGGER_ENABLED=true is explicitly set.
  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' || process.env.NIBRAS_SWAGGER_ENABLED === 'true';

  if (swaggerEnabled) {
    void app.register(swagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'Nibras API',
          description: 'REST API for the Nibras educational submission and verification platform.',
          version: '1.0.0',
        },
        servers: [{ url: process.env.NIBRAS_API_BASE_URL || 'http://127.0.0.1:4848' }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              description: 'CLI session token obtained via device flow.',
            },
            cookieAuth: {
              type: 'apiKey',
              in: 'cookie',
              name: 'nibras_session',
              description: 'Web session cookie set after GitHub OAuth.',
            },
          },
        },
        security: [{ bearerAuth: [] }],
        tags: [
          { name: 'auth', description: 'Device login, token refresh, logout' },
          { name: 'github', description: 'GitHub App OAuth and webhooks' },
          { name: 'projects', description: 'Project setup and submission' },
          { name: 'tracking', description: 'Courses, milestones, and student progress' },
          { name: 'programs', description: 'Academic programs, tracks, and program sheets' },
          { name: 'admin', description: 'Admin-only operations' },
          { name: 'system', description: 'Health, readiness, and metrics' },
        ],
      },
    });

    void app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
      staticCSP: false,
    });
  }

  // Propagate Request-Id to response for tracing
  app.addHook('onSend', async (request, reply) => {
    void reply.header('X-Request-Id', request.id);
  });

  const globalRateMax = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 100;
  void app.register(rateLimit, {
    global: true,
    max: globalRateMax,
    timeWindow: '1 minute',
    // Expose quota headers so clients know how many requests they have left.
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    // Use Bearer token as rate-limit key for authenticated requests so each
    // user gets their own quota; fall back to IP for unauthenticated callers.
    keyGenerator: (request) => {
      const auth = request.headers.authorization;
      if (auth?.startsWith('Bearer ')) return auth.slice(7);
      return request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      error: `Too many requests. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
      statusCode: 429,
    }),
  });

  void app.register(cors, {
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
    exposedHeaders: [
      'x-request-id',
      'x-total-count',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
    ],
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowedCorsOrigins.has(origin));
    },
  });

  void app.register(rawBodyPlugin, {
    field: 'rawBody',
    global: false,
    encoding: false,
    routes: ['/v1/github/webhooks'],
  });

  // ── Health & readiness ────────────────────────────────────────────────────
  app.get(
    '/healthz',
    { schema: { tags: ['system'], summary: 'Liveness probe' } },
    async (_request, reply) => {
      return reply.send({ ok: true });
    }
  );

  app.get(
    '/readyz',
    { schema: { tags: ['system'], summary: 'Readiness probe — checks DB connectivity' } },
    async (_request, reply) => {
      if (process.env.DATABASE_URL) {
        try {
          const prisma = new PrismaClient();
          await prisma.$queryRaw`SELECT 1`;
          await prisma.$disconnect();
        } catch {
          return reply.status(503).send({ ok: false, reason: 'database unavailable' });
        }
      }
      return reply.send({ ok: true });
    }
  );

  // ── Prometheus-compatible metrics ─────────────────────────────────────────
  // Use a fresh per-app Registry so multiple buildApp() calls (e.g. in tests)
  // don't collide on the global default registry.
  const promRegistry = new Registry();
  collectDefaultMetrics({ register: promRegistry });

  const httpRequestsTotal = new Counter({
    name: 'nibras_http_requests_total',
    help: 'Total HTTP requests by method and status',
    labelNames: ['method', 'status'] as const,
    registers: [promRegistry],
  });

  app.addHook('onResponse', async (request, reply) => {
    httpRequestsTotal.inc({ method: request.method, status: String(reply.statusCode) });
  });

  app.get(
    '/metrics',
    { schema: { tags: ['system'], summary: 'Prometheus-compatible metrics' } },
    async (request, reply) => {
      // Optional static bearer token to protect the metrics endpoint.
      // Set NIBRAS_METRICS_TOKEN in production; leave unset for local dev.
      const metricsToken = process.env.NIBRAS_METRICS_TOKEN;
      if (metricsToken) {
        const auth = request.headers.authorization;
        if (auth !== `Bearer ${metricsToken}`) {
          return reply.code(401).send({ error: 'Unauthorized.', code: 'AUTH_REQUIRED' });
        }
      }

      // prom-client handles nibras_http_requests_total + all default process metrics.
      let output = await promRegistry.metrics();

      // DB-sourced gauges appended as raw Prometheus text — always fresh from the DB,
      // not subject to counter-reset issues on process restart.
      if (process.env.DATABASE_URL) {
        try {
          const prisma = new PrismaClient();
          const [queueDepth, passedCount, failedCount, reviewCount] = await Promise.all([
            prisma.verificationJob.count({ where: { status: 'queued' } }),
            prisma.verificationJob.count({ where: { status: 'passed' } }),
            prisma.verificationJob.count({ where: { status: 'failed' } }),
            prisma.verificationJob.count({ where: { status: 'needs_review' } }),
          ]);
          await prisma.$disconnect();
          output +=
            [
              '',
              '# HELP nibras_verification_queue_depth Number of queued verification jobs',
              '# TYPE nibras_verification_queue_depth gauge',
              `nibras_verification_queue_depth ${queueDepth}`,
              '',
              '# HELP nibras_verification_by_status Verifications grouped by final status',
              '# TYPE nibras_verification_by_status gauge',
              `nibras_verification_by_status{status="passed"} ${passedCount}`,
              `nibras_verification_by_status{status="failed"} ${failedCount}`,
              `nibras_verification_by_status{status="needs_review"} ${reviewCount}`,
            ].join('\n') + '\n';
        } catch {
          output += '# ERROR: could not query DB for verification metrics\n';
        }
      }

      return reply.header('Content-Type', promRegistry.contentType).send(output);
    }
  );

  // Capture unhandled errors in Sentry when DSN is configured
  app.setErrorHandler(async (error: { statusCode?: number; message?: string }, request, reply) => {
    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setTag('requestId', request.id);
        scope.setTag('method', request.method);
        scope.setTag('url', request.url);
        Sentry.captureException(error);
      });
    }
    const statusCode = error.statusCode || 500;
    const code =
      statusCode === 429 ? 'RATE_LIMITED' : statusCode >= 500 ? 'INTERNAL_ERROR' : 'INTERNAL_ERROR';
    void reply.status(statusCode).send({ error: error.message || 'Internal server error.', code });
  });

  app.addHook('onClose', async () => {
    if (store.close) {
      await store.close();
    }
    const { closeQueue } = await import('./lib/queue');
    await closeQueue();
  });

  registerGitHubRoutes(app, store, githubConfig);
  registerHostedCliRoutes(app, store, githubConfig);
  registerTrackingRoutes(app, store);
  registerProgramRoutes(app, store);
  registerAdminRoutes(app, store);
  registerNotificationRoutes(app, store);

  return app;
}
