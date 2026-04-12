export function normalizeGitHubRepositoryCandidate(value) {
  const raw = value.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (hostname !== 'github.com' && hostname !== 'www.github.com') return '';
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) return '';
    const owner = parts[0];
    const name = parts[1].replace(/\.git$/i, '');
    if (!owner || !name) return '';
    return `https://github.com/${owner}/${name}`;
  } catch {
    return '';
  }
}

export function isValidAbsoluteHttpUrl(value) {
  const raw = value.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function shouldClearVerifiedRepo(previousInput, nextInput) {
  return previousInput.trim() !== nextInput.trim();
}

export function getSubmissionSubmitLabel(submissionType) {
  if (submissionType === 'github') return 'Submit GitHub Repo';
  if (submissionType === 'link') return 'Submit Link';
  return 'Submit Write-up';
}

export function canSubmitSubmission({
  submissionType,
  submissionValue,
  isSubmitting = false,
  isVerifyingRepo = false,
  githubLinked = false,
  githubAppInstalled = false,
  repoValidationState = 'idle',
}) {
  if (isSubmitting) return false;
  if (submissionType === 'github') {
    return (
      !isVerifyingRepo && githubLinked && githubAppInstalled && repoValidationState === 'valid'
    );
  }
  if (submissionType === 'link') {
    return isValidAbsoluteHttpUrl(submissionValue);
  }
  return submissionValue.trim().length > 0;
}
