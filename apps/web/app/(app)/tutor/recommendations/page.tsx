'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../_components/widgets/EmptyState';
import {
  getGradesPayload,
  recommendTrack,
  type RecommendationResponse,
} from '../../../lib/services/recommendation';
import { friendlyMessage } from '../../../lib/api-clients/errors';

export default function RecommendationsPage() {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compute = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const payload = await getGradesPayload();
      const recommendations = await recommendTrack(payload);
      setData(recommendations);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void compute();
  }, [compute]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Recommendations</h1>
          <p className={styles.subtitle}>
            Track and specialization suggestions based on your grade sheet, refreshed on demand.
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => void compute()}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh sheet'}
        </button>
      </header>

      {loading ? (
        <div style={{ height: 220, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error ? (
        <EmptyState
          title="Couldn't compute recommendations"
          description={error}
          tone="error"
          action={{ label: 'Retry', onClick: () => void compute() }}
        />
      ) : !data || data.recommended.length === 0 ? (
        <EmptyState
          title="No recommendation yet"
          description="Click Refresh sheet to pull your latest grades and compute recommendations."
          action={{ label: 'Refresh now', onClick: () => void compute() }}
        />
      ) : (
        <>
          {data.rationale && <div className={styles.rationale}>{data.rationale}</div>}
          <div className={styles.tracks}>
            {data.recommended.map((track) => (
              <article key={track.trackId} className={styles.trackCard}>
                <div className={styles.trackHead}>
                  <h2 className={styles.trackName}>{track.name}</h2>
                  <span className={styles.trackScore}>{Math.round(track.score * 100)}%</span>
                </div>
                {track.description && <p className={styles.trackDescription}>{track.description}</p>}
                {track.matchedSkills && track.matchedSkills.length > 0 && (
                  <div className={styles.skillsRow}>
                    <span className={styles.skillsLabel}>You already have</span>
                    <div className={styles.skillsList}>
                      {track.matchedSkills.slice(0, 8).map((s) => (
                        <span key={s} className={styles.chip}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {track.missingSkills && track.missingSkills.length > 0 && (
                  <div className={styles.skillsRow}>
                    <span className={styles.skillsLabel}>Suggested next</span>
                    <div className={styles.skillsList}>
                      {track.missingSkills.slice(0, 8).map((s) => (
                        <span key={s} className={`${styles.chip} ${styles.chipMissing}`}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {track.suggestedCourses && track.suggestedCourses.length > 0 && (
                  <div className={styles.courses}>
                    <span className={styles.coursesLabel}>Courses to consider</span>
                    {track.suggestedCourses.slice(0, 4).map((c) => (
                      <div key={c.courseId} className={styles.courseRow}>
                        <span className={styles.courseCode}>{c.code}</span>
                        <span className={styles.courseTitle}>{c.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
