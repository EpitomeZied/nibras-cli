import { FastifyInstance } from 'fastify';
import {
  LocalTestResultRequestSchema,
  MeResponseSchema,
  PingResponseSchema,
  ProjectSetupResponseSchema,
  ProjectTaskResponseSchema,
  SubmissionPrepareRequestSchema,
  SubmissionPrepareResponseSchema,
  SubmissionStatusResponseSchema,
  TokenRefreshRequestSchema,
  TokenRefreshResponseSchema,
} from '@nibras/contracts';
import { GitHubAppConfig } from '@nibras/github';
import { PrismaStore } from '../../prisma-store';
import { AppStore } from '../../store';
import { Errors } from '../../lib/errors';
import { validateId } from '../../lib/validate';
import { getWebSessionToken, requireUser } from '../../lib/auth';
import { requestBaseUrl } from '../../lib/request-base-url';
import { clearWebSessionCookie } from '../../lib/web-session';

export function registerHostedCliRoutes(
  app: FastifyInstance,
  store: AppStore,
  githubConfig: GitHubAppConfig | null
): void {
  app.get(
    '/v1/health',
    { schema: { tags: ['system'], summary: 'API health check' } },
    async () => ({ ok: true })
  );

  app.get(
    '/v1/ping',
    { schema: { tags: ['system'], summary: 'Ping — checks auth and GitHub link status' } },
    async (request) => {
      const authHeader = request.headers.authorization;
      const token =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice('Bearer '.length).trim()
          : null;
      const user = token ? await store.getUserByToken(requestBaseUrl(request), token) : null;
      return PingResponseSchema.parse({
        ok: true,
        api: 'reachable',
        auth: token ? (user ? 'valid' : 'invalid') : 'missing',
        github: user?.githubLinked ? 'linked' : 'missing',
        githubApp: user?.githubAppInstalled ? 'installed' : 'missing',
      });
    }
  );

  app.post(
    '/v1/auth/refresh',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: { tags: ['auth'], summary: 'Refresh CLI access token' },
    },
    async (request, reply) => {
      const payload = TokenRefreshRequestSchema.parse(request.body);
      const session = await store.refreshCliSession(requestBaseUrl(request), payload.refreshToken);
      if (!session) {
        reply.code(401).send(Errors.invalidSession());
        return;
      }
      return TokenRefreshResponseSchema.parse({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
    }
  );

  app.post(
    '/v1/logout',
    { schema: { tags: ['auth'], summary: 'Revoke CLI session' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (auth.authKind === 'bearer') {
        await store.deleteSession(requestBaseUrl(request), auth.token);
      } else {
        await store.deleteWebSession(requestBaseUrl(request), auth.token);
        void reply.header('Set-Cookie', clearWebSessionCookie(request));
      }
      return { ok: true };
    }
  );

  app.get(
    '/v1/me',
    { schema: { tags: ['auth'], summary: 'Get current authenticated user' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      return MeResponseSchema.parse({
        user: auth.user,
        apiBaseUrl: requestBaseUrl(request),
      });
    }
  );

  /**
   * GET /v1/me/submissions
   * List all submissions belonging to the authenticated user.
   * Supports optional ?limit=N&offset=N pagination; returns X-Total-Count header.
   */
  app.get(
    '/v1/me/submissions',
    {
      schema: {
        tags: ['submissions'],
        summary: "List the authenticated user's own submissions",
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 200 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const apiBaseUrl = requestBaseUrl(request);
      const query = request.query as { limit?: number; offset?: number };
      const opts =
        query.limit !== undefined || query.offset !== undefined
          ? { limit: query.limit, offset: query.offset }
          : undefined;
      const [submissions, total] = await Promise.all([
        store.listUserSubmissions(apiBaseUrl, auth.user.id, opts),
        store.countUserSubmissions(apiBaseUrl, auth.user.id),
      ]);
      void reply.header('X-Total-Count', String(total));
      return reply.send(submissions);
    }
  );

  app.get(
    '/v1/web/session',
    { schema: { tags: ['auth'], summary: 'Get current web session user' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      return MeResponseSchema.parse({
        user: auth.user,
        apiBaseUrl: requestBaseUrl(request),
      });
    }
  );

  app.post(
    '/v1/web/logout',
    { schema: { tags: ['auth'], summary: 'Revoke web session cookie' } },
    async (request, reply) => {
      const sessionToken = getWebSessionToken(request);
      if (sessionToken) {
        await store.deleteWebSession(requestBaseUrl(request), sessionToken);
      }
      void reply.header('Set-Cookie', clearWebSessionCookie(request));
      return { ok: true };
    }
  );

  app.get(
    '/v1/projects/:projectKey/manifest',
    { schema: { tags: ['projects'], summary: 'Get project manifest' } },
    async (request, reply) => {
      const params = request.params as { projectKey: string };
      const project = await store.getProject(requestBaseUrl(request), params.projectKey);
      if (!project) {
        reply.code(404).send(Errors.notFound('Project'));
        return;
      }
      project.manifest.apiBaseUrl = requestBaseUrl(request);
      return project.manifest;
    }
  );

  app.get(
    '/v1/projects/:projectKey/task',
    { schema: { tags: ['projects'], summary: 'Get project task instructions' } },
    async (request, reply) => {
      const params = request.params as { projectKey: string };
      const project = await store.getProject(requestBaseUrl(request), params.projectKey);
      if (!project) {
        reply.code(404).send(Errors.notFound('Project'));
        return;
      }
      return ProjectTaskResponseSchema.parse({
        projectKey: project.projectKey,
        task: project.task,
      });
    }
  );

  app.post(
    '/v1/projects/:projectKey/setup',
    { schema: { tags: ['projects'], summary: 'Provision student project repo' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectKey: string };
      const project = await store.getProject(requestBaseUrl(request), params.projectKey);
      if (!project) {
        reply.code(404).send(Errors.notFound('Project'));
        return;
      }
      let repo = await store.provisionProjectRepo(
        requestBaseUrl(request),
        params.projectKey,
        auth.user.id
      );
      if (githubConfig && store instanceof PrismaStore) {
        const account = await store.getGithubAccountForUser(auth.user.id);
        // Only need the user's OAuth token — installationId not required for repo creation
        if (account?.userAccessToken) {
          repo = await store.provisionProjectRepoFromGitHub(
            requestBaseUrl(request),
            params.projectKey,
            auth.user.id,
            githubConfig
          );
        }
      }
      project.manifest.apiBaseUrl = requestBaseUrl(request);
      const templateCloneUrl =
        githubConfig?.templateOwner && githubConfig?.templateRepo
          ? `https://github.com/${githubConfig.templateOwner}/${githubConfig.templateRepo}`
          : null;
      return ProjectSetupResponseSchema.parse({
        projectKey: project.projectKey,
        repo,
        templateCloneUrl,
        manifest: project.manifest,
        task: project.task,
      });
    }
  );

  app.post(
    '/v1/submissions/prepare',
    { schema: { tags: ['projects'], summary: 'Create or reuse a submission' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const payload = SubmissionPrepareRequestSchema.parse(request.body);
      const submission = await store.createOrReuseSubmission(requestBaseUrl(request), {
        ...payload,
        userId: auth.user.id,
      });
      return SubmissionPrepareResponseSchema.parse({
        submissionId: submission.id,
        status: submission.status,
      });
    }
  );

  app.post(
    '/v1/submissions/:submissionId/local-test-result',
    { schema: { tags: ['projects'], summary: 'Record local test result' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;
      const payload = LocalTestResultRequestSchema.parse(request.body);
      const submission = await store.updateLocalTestResult(
        requestBaseUrl(request),
        params.submissionId,
        auth.user.id,
        payload.exitCode,
        payload.summary
      );
      if (!submission) {
        const existing = await store.getSubmissionForAdmin(
          requestBaseUrl(request),
          params.submissionId
        );
        if (existing) {
          reply.code(403).send(Errors.forbidden());
        } else {
          reply.code(404).send(Errors.notFound('Submission'));
        }
        return;
      }
      return { ok: true };
    }
  );

  app.get(
    '/v1/submissions/:submissionId/stream',
    { schema: { tags: ['projects'], summary: 'Stream submission status via SSE', hide: true } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;

      const TERMINAL = new Set(['passed', 'failed', 'needs_review']);
      const POLL_MS = 2_000;
      const TIMEOUT_MS = 5 * 60 * 1_000;

      void reply
        .header('Content-Type', 'text/event-stream')
        .header('Cache-Control', 'no-cache')
        .header('Connection', 'keep-alive')
        .header('X-Accel-Buffering', 'no');

      const send = (event: string, data: unknown) => {
        const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        void reply.raw.write(chunk);
      };

      const deadline = Date.now() + TIMEOUT_MS;
      let lastStatus: string | undefined;

      const tick = async () => {
        if (Date.now() >= deadline) {
          send('timeout', { message: 'Stream closed after 5 minutes.' });
          reply.raw.end();
          return;
        }
        const submission = await store.getSubmission(
          requestBaseUrl(request),
          params.submissionId,
          auth.user.id
        );
        if (!submission) {
          // Try admin fetch for instructors
          const any = await store.getSubmissionForAdmin(
            requestBaseUrl(request),
            params.submissionId
          );
          if (!any) {
            send('error', { error: 'Submission not found.' });
            reply.raw.end();
            return;
          }
          // Check access
          const project = await store.getTrackingProjectById(
            requestBaseUrl(request),
            any.projectId
          );
          const { canManageProject } = await import('../tracking/policies/access');
          const hasAccess =
            auth.user.systemRole === 'admin' || (project && canManageProject(auth, project));
          if (!hasAccess) {
            send('error', { error: 'Forbidden.' });
            reply.raw.end();
            return;
          }
          if (any.status !== lastStatus) {
            lastStatus = any.status;
            send('status', { submissionId: any.id, status: any.status, summary: any.summary });
          }
          if (TERMINAL.has(any.status)) {
            send('done', { submissionId: any.id, status: any.status });
            reply.raw.end();
            return;
          }
        } else {
          if (submission.status !== lastStatus) {
            lastStatus = submission.status;
            send('status', {
              submissionId: submission.id,
              status: submission.status,
              summary: submission.summary,
            });
          }
          if (TERMINAL.has(submission.status)) {
            send('done', { submissionId: submission.id, status: submission.status });
            reply.raw.end();
            return;
          }
        }
        setTimeout(() => void tick(), POLL_MS);
      };

      reply.raw.on('close', () => {
        // Client disconnected — nothing to clean up for polling approach
      });

      // Send initial heartbeat
      send('connected', { submissionId: params.submissionId });
      void tick();
    }
  );

  app.get(
    '/v1/submissions/:submissionId',
    { schema: { tags: ['projects'], summary: 'Get submission status' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;
      const submission = await store.getSubmission(
        requestBaseUrl(request),
        params.submissionId,
        auth.user.id
      );
      if (!submission) {
        const existing = await store.getSubmissionForAdmin(
          requestBaseUrl(request),
          params.submissionId
        );
        if (existing) {
          reply.code(403).send(Errors.forbidden());
        } else {
          reply.code(404).send(Errors.notFound('Submission'));
        }
        return;
      }
      return SubmissionStatusResponseSchema.parse({
        submissionId: submission.id,
        projectKey: submission.projectKey,
        status: submission.status,
        commitSha: submission.commitSha,
        summary: submission.summary,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      });
    }
  );

  /**
   * DELETE /v1/me/account
   * GDPR right-to-erasure: permanently delete all personal data for the authenticated user.
   * Revokes all sessions, anonymises submissions, deletes profile data.
   * Requires confirmation body: { confirm: "DELETE MY ACCOUNT" }
   */
  app.delete(
    '/v1/me/account',
    { schema: { tags: ['auth'], summary: 'Delete account and all personal data (GDPR erasure)' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const body = request.body as { confirm?: string };
      if (body?.confirm !== 'DELETE MY ACCOUNT') {
        return reply
          .code(400)
          .send(Errors.validation('Send { "confirm": "DELETE MY ACCOUNT" } to confirm erasure.'));
      }
      await store.deleteUserAccount(requestBaseUrl(request), auth.user.id);
      void reply.header('Set-Cookie', clearWebSessionCookie(request));
      return { ok: true, message: 'Your account and all associated data have been deleted.' };
    }
  );
}
