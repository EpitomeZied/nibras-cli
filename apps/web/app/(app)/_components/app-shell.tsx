"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/session";
import Sidebar from "./sidebar";
import TopHeader from "./top-header";
import styles from "./app-shell.module.css";

type ShellSessionPayload = {
  user: {
    username: string;
    email: string;
    githubLogin: string;
    githubLinked: boolean;
    githubAppInstalled: boolean;
    systemRole?: string;
  };
};

export type ShellUser = ShellSessionPayload["user"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ShellUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const response = await apiFetch("/v1/web/session", { auth: true });
        if (!response.ok) {
          throw new Error("Session unavailable.");
        }
        const payload = await response.json() as ShellSessionPayload;
        if (alive) {
          setSession(payload.user);
        }
      } catch {
        if (alive) {
          setSession(null);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className={styles.appShell}>
      <Sidebar user={session} loading={loading} />
      <div className={styles.mainArea}>
        <TopHeader user={session} loading={loading} />
        <div className={styles.pageBody}>{children}</div>
      </div>
    </div>
  );
}
