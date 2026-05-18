'use client';

import { useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../_components/widgets/EmptyState';
import { serviceFetch } from '../../../lib/api-clients/service-fetch';
import { friendlyMessage } from '../../../lib/api-clients/errors';

type RouteStep = {
  id: string;
  title: string;
  description?: string;
  course?: string;
  estimatedMinutes?: number;
  ready: boolean;
  resourceUrl?: string;
};

type SmartRoutingResponse = {
  goal: string;
  steps: RouteStep[];
  summary?: string;
};

export default function SmartRoutingPage() {
  const [goal, setGoal] = useState('');
  const [route, setRoute] = useState<SmartRoutingResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function computeRoute() {
    const trimmed = goal.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await serviceFetch<SmartRoutingResponse>(
        'community',
        '/chatbot/routing',
        {
          method: 'POST',
          auth: true,
          body: { goal: trimmed },
        }
      );
      setRoute(response);
    } catch (err) {
      setError(friendlyMessage(err));
      setRoute(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleRoute(event: React.FormEvent) {
    event.preventDefault();
    await computeRoute();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Smart Routing</h1>
        <p className={styles.subtitle}>
          The tutor maps your goal to the right material, picking the shortest path through prerequisites.
        </p>
      </header>

      <form className={styles.goalCard} onSubmit={handleRoute}>
        <span className={styles.goalLabel}>Your learning goal</span>
        <input
          className={styles.goalInput}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="e.g. Pass the CS-202 midterm by reviewing trees and dynamic programming"
        />
        <div className={styles.goalActions}>
          <span className={styles.hint}>Be specific — courses, topics, exam dates all help.</span>
          <button type="submit" className={styles.routeBtn} disabled={busy || !goal.trim()}>
            {busy ? 'Routing…' : 'Plan a route'}
          </button>
        </div>
      </form>

      {error ? (
        <EmptyState
          title="Routing failed"
          description={error}
          tone="error"
          action={{ label: 'Retry', onClick: () => void computeRoute() }}
        />
      ) : !route ? (
        <EmptyState
          title="No route computed"
          description="Describe a goal above and the tutor will plan a path through topics and exercises."
        />
      ) : (
        <>
          {route.summary && <p className={styles.subtitle}>{route.summary}</p>}
          <ol className={styles.steps}>
            {route.steps.map((step) => (
              <li key={step.id} className={styles.step}>
                <span className={styles.stepDot} />
                <h2 className={styles.stepTitle}>{step.title}</h2>
                {step.description && <p className={styles.stepDescription}>{step.description}</p>}
                <div className={styles.stepMeta}>
                  {step.course && <span>{step.course}</span>}
                  {step.estimatedMinutes !== undefined && <span>· {step.estimatedMinutes} min</span>}
                  <span
                    className={`${styles.stepStatus} ${
                      step.ready ? styles.statusReady : styles.statusLocked
                    }`}
                  >
                    {step.ready ? 'Ready' : 'Locked'}
                  </span>
                  {step.resourceUrl && (
                    <a href={step.resourceUrl} target="_blank" rel="noopener noreferrer">
                      Open
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
