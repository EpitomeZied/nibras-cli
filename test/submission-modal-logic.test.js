const test = require('node:test');
const assert = require('node:assert/strict');

test('submission modal logic normalizes GitHub repo URLs', async () => {
  const { normalizeGitHubRepositoryCandidate } =
    await import('../apps/web/app/(app)/projects/_components/submission-modal.logic.js');

  assert.equal(
    normalizeGitHubRepositoryCandidate('https://github.com/demo/repo.git'),
    'https://github.com/demo/repo'
  );
  assert.equal(
    normalizeGitHubRepositoryCandidate('https://github.com/demo/repo/'),
    'https://github.com/demo/repo'
  );
  assert.equal(normalizeGitHubRepositoryCandidate('https://example.com/demo/repo'), '');
});

test('submission modal logic clears verified repo state when the input changes', async () => {
  const { shouldClearVerifiedRepo } =
    await import('../apps/web/app/(app)/projects/_components/submission-modal.logic.js');

  assert.equal(
    shouldClearVerifiedRepo('https://github.com/demo/repo', 'https://github.com/demo/repo'),
    false
  );
  assert.equal(
    shouldClearVerifiedRepo('https://github.com/demo/repo', 'https://github.com/demo/repo-new'),
    true
  );
});

test('submission modal logic enforces submit gating for all submission types', async () => {
  const { canSubmitSubmission } =
    await import('../apps/web/app/(app)/projects/_components/submission-modal.logic.js');

  assert.equal(
    canSubmitSubmission({
      submissionType: 'github',
      submissionValue: 'https://github.com/demo/repo',
      githubLinked: true,
      githubAppInstalled: true,
      repoValidationState: 'valid',
    }),
    true
  );
  assert.equal(
    canSubmitSubmission({
      submissionType: 'github',
      submissionValue: 'https://github.com/demo/repo',
      githubLinked: true,
      githubAppInstalled: false,
      repoValidationState: 'valid',
    }),
    false
  );
  assert.equal(
    canSubmitSubmission({
      submissionType: 'link',
      submissionValue: 'https://example.com/demo',
    }),
    true
  );
  assert.equal(
    canSubmitSubmission({
      submissionType: 'link',
      submissionValue: 'notaurl',
    }),
    false
  );
  assert.equal(
    canSubmitSubmission({
      submissionType: 'text',
      submissionValue: 'Short write-up',
    }),
    true
  );
  assert.equal(
    canSubmitSubmission({
      submissionType: 'text',
      submissionValue: '   ',
    }),
    false
  );
});
