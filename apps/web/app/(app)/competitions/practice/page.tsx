'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../_components/widgets/EmptyState';
import { listProblems, type PracticeProblem } from '../../../lib/services/competitions';
import { friendlyMessage } from '../../../lib/api-clients/errors';

const POPULAR_TAGS = [
  'dp',
  'graphs',
  'greedy',
  'math',
  'strings',
  'two-pointers',
  'binary-search',
  'trees',
];

export default function PracticePage() {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<'easy' | 'med' | 'hard' | 'any'>('any');
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ranges = {
        any: {} as Record<string, number | undefined>,
        easy: { difficultyMin: 0, difficultyMax: 1200 },
        med: { difficultyMin: 1200, difficultyMax: 2000 },
        hard: { difficultyMin: 2000, difficultyMax: 4000 },
      } as const;
      const response = await listProblems({
        q: q.trim() || undefined,
        tag: tag ?? undefined,
        ...ranges[difficulty],
        limit: 50,
      });
      setProblems(response.items ?? []);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [q, tag, difficulty]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Practice</h1>
        <p className={styles.subtitle}>
          Browse problems from Codeforces, LeetCode, and others. Filter by tag and difficulty.
        </p>
      </header>

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="Search problems"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <div className={styles.difficultyPicker} role="tablist" aria-label="Difficulty">
          {(['any', 'easy', 'med', 'hard'] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={difficulty === d}
              className={`${styles.difficultyChip} ${difficulty === d ? styles.difficultyChipActive : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {d === 'med' ? 'Medium' : d[0].toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tagsRow}>
        {POPULAR_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tagChip} ${tag === t ? styles.tagChipActive : ''}`}
            onClick={() => setTag(tag === t ? null : t)}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ height: 280, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error || problems.length === 0 ? (
        <EmptyState
          title={error ? 'Could not load problems' : 'No problems match'}
          description={error ?? 'Try a different tag, difficulty, or search term.'}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      ) : (
        <div className={styles.list}>
          {problems.map((problem) => (
            <article
              key={problem.id}
              className={`${styles.row} ${problem.solved ? styles.rowSolved : ''}`}
            >
              <span className={styles.difficultyBadge}>{problem.difficulty}</span>
              <div>
                <h2 className={styles.problemTitle}>
                  <a href={problem.url} target="_blank" rel="noopener noreferrer">
                    {problem.title}
                  </a>
                </h2>
                <div className={styles.problemMeta}>
                  <span className={styles.hostTag}>{problem.host}</span>
                  {problem.tags.slice(0, 4).map((tagName) => (
                    <span key={tagName} style={{ marginLeft: 6 }}>
                      #{tagName}
                    </span>
                  ))}
                </div>
              </div>
              {problem.solved && <span className={styles.solvedBadge}>Solved</span>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
