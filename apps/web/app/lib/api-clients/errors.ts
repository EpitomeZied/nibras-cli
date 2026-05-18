import type { ApiServiceName } from './registry';

export type ApiErrorInit = {
  service: ApiServiceName;
  status: number;
  code?: string;
  body?: unknown;
};

export class ApiError extends Error {
  readonly service: ApiServiceName;
  readonly status: number;
  readonly code?: string;
  readonly body?: unknown;

  constructor(message: string, init: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.service = init.service;
    this.status = init.status;
    this.code = init.code;
    this.body = init.body;
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) return false;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('load failed') ||
      msg.includes('aborted')
    );
  }
  return false;
}

export function friendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (isAuthError(error)) {
      return 'You need to sign in again to load this data.';
    }
    if (error.status >= 500) {
      return 'The service is temporarily unavailable. Please try again in a moment.';
    }
    if (error.message) return error.message;
    return `Request failed (${error.status}).`;
  }
  if (isNetworkError(error)) {
    return 'Could not reach the service. Check your connection and retry.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong loading this view.';
}
