const test = require('node:test');
const assert = require('node:assert/strict');

test('web auth callback derives the public origin from forwarded headers', async () => {
  const { resolvePublicOrigin } = await import('../apps/web/app/api/auth/callback/core.js');
  const headers = new Headers({
    'x-forwarded-proto': 'https',
    'x-forwarded-host': 'nibras-web.fly.dev',
  });

  assert.equal(
    resolvePublicOrigin(headers, 'https://fallback.example'),
    'https://nibras-web.fly.dev'
  );
});

test('web auth callback preserves the session token from relative redirects', async () => {
  const { resolveCallbackRedirect } = await import('../apps/web/app/api/auth/callback/core.js');

  assert.equal(
    resolveCallbackRedirect('/auth/complete?st=web_123', 'https://nibras-web.fly.dev'),
    'https://nibras-web.fly.dev/auth/complete?st=web_123'
  );
});

test('web auth callback rebases API-origin redirects onto the public web origin', async () => {
  const { resolveCallbackRedirect } = await import('../apps/web/app/api/auth/callback/core.js');

  assert.equal(
    resolveCallbackRedirect(
      'https://nibras-api.fly.dev/auth/complete?st=web_123',
      'https://nibras-web.fly.dev'
    ),
    'https://nibras-web.fly.dev/auth/complete?st=web_123'
  );
});

test('web auth callback falls back to the default completion page for unsafe redirects', async () => {
  const { resolveCallbackRedirect } = await import('../apps/web/app/api/auth/callback/core.js');

  assert.equal(
    resolveCallbackRedirect('javascript:alert(1)', 'https://nibras-web.fly.dev'),
    'https://nibras-web.fly.dev/auth/complete'
  );
});
