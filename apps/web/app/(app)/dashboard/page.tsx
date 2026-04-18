'use client';

import { startTransition, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardHomeResponse, DashboardMode } from '@nibras/contracts';
import { apiFetch } from '../../lib/session';
import { useSession } from '../_components/session-context';
import DashboardContent, {
  DashboardErrorState,
  DashboardSkeleton,
} from './_components/dashboard-content';
import { loadDashboardRouteData } from './dashboard-runtime';

type FetchError = Error & { status?: number };

function buildDashboardUrl(
  pathname: string,
  searchParams: { toString(): string },
  mode: DashboardMode | null
): string {
  const params = new URLSearchParams(searchParams.toString());
  if (mode) {
    params.set('mode', mode);
  } else {
    params.delete('mode');
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

async function fetchJson(path: string, init: RequestInit & { auth?: boolean } = {}) {
  const response = await apiFetch(path, {
    ...init,
    auth: init.auth ?? true,
  });

  if (!response.ok) {
    let message = `Dashboard request failed with status ${response.status}.`;
    try {
      const payload = await response.json();
      const payloadMessage =
        typeof payload?.error?.message === 'string'
          ? payload.error.message
          : typeof payload?.message === 'string'
            ? payload.message
            : '';
      if (payloadMessage) {
        message = payloadMessage;
      }
    } catch {
      const fallbackText = await response.text().catch(() => '');
      if (fallbackText) {
        message = fallbackText;
      }
    }

    const error = new Error(message) as FetchError;
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Could not connect to the dashboard API.';
}

export default function DashboardPage() {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get('mode');

  const [dashboard, setDashboard] = useState<DashboardHomeResponse | null>(null);
  const [activeMode, setActiveMode] = useState<DashboardMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  function replaceMode(mode: DashboardMode | null) {
    const nextUrl = buildDashboardUrl(pathname, searchParams, mode);
    startTransition(() => {
      router.replace(nextUrl);
    });
  }

  useEffect(() => {
    let alive = true;

    void (async () => {
      setLoading(true);
      setError('');

      try {
        const result = await loadDashboardRouteData({
          fetchJson,
          requestedMode,
        });
        if (!alive) return;

        setDashboard(result.dashboard);
        setActiveMode(result.activeMode);

        if (result.resetModeQuery && requestedMode !== null) {
          const nextUrl = buildDashboardUrl(pathname, searchParams, null);
          startTransition(() => {
            router.replace(nextUrl);
          });
        }
      } catch (loadError) {
        if (!alive) return;
        setDashboard(null);
        setActiveMode(null);
        setError(toErrorMessage(loadError));
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [pathname, reloadToken, requestedMode, router, searchParams]);

  function handleRetry() {
    setReloadToken((value) => value + 1);
  }

  function handleModeChange(mode: DashboardMode) {
    if (mode === requestedMode || mode === activeMode) return;
    setLoading(true);
    replaceMode(mode);
  }

  if (loading && !dashboard) {
    return <DashboardSkeleton />;
  }

  if (error && !dashboard) {
    return <DashboardErrorState message={error} onRetry={handleRetry} />;
  }

  if (!dashboard || !activeMode) {
    return (
      <DashboardErrorState
        message="The dashboard did not return a usable state."
        onRetry={handleRetry}
      />
    );
  }

  return (
    <DashboardContent
      dashboard={dashboard}
      activeMode={activeMode}
      user={user}
      onModeChange={handleModeChange}
    />
  );
}
