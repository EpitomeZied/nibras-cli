'use client';
import React, { createContext, useContext } from 'react';

export interface ShellUser {
  username: string;
  email: string;
  githubLogin: string | null;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  systemRole?: string | null;
  yearLevel?: number;
  memberships?: Array<{ courseId: string; role: string; level: number }>;
}

interface SessionContextValue {
  user: ShellUser | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextValue>({ user: null, loading: true });

export function SessionProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: SessionContextValue;
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
