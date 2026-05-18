'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import EmptyState from '../../../_components/widgets/EmptyState';
import { listVideos, setVideoProgress, type CourseVideo } from '../../../../lib/services/backend-courses';
import { friendlyMessage } from '../../../../lib/api-clients/errors';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function CourseVideosPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId ?? '';
  const [videos, setVideos] = useState<CourseVideo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listVideos(courseId);
      const sorted = [...list].sort((a, b) => a.order - b.order);
      setVideos(sorted);
      if (sorted.length > 0) setActiveId(sorted[0].id);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(
    () => videos.find((v) => v.id === activeId) ?? null,
    [videos, activeId]
  );

  async function markWatched(video: CourseVideo) {
    try {
      const result = await setVideoProgress(video.id, { watched: true, watchedProgress: 1 });
      setVideos((prev) =>
        prev.map((v) =>
          v.id === video.id
            ? { ...v, watched: result.watched, watchedProgress: result.watchedProgress }
            : v
        )
      );
    } catch {
      /* swallow — UI stays optimistic */
    }
  }

  function advanceToNext(current: CourseVideo) {
    const idx = videos.findIndex((v) => v.id === current.id);
    const next = videos[idx + 1];
    if (next) setActiveId(next.id);
  }

  useEffect(() => {
    if (!active) return;
    const current = active;
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'j' || event.key === 'J' || event.key === 'ArrowDown') {
        event.preventDefault();
        const idx = videos.findIndex((v) => v.id === current.id);
        const next = videos[idx + 1] ?? videos[idx];
        if (next) setActiveId(next.id);
      } else if (event.key === 'k' || event.key === 'K' || event.key === 'ArrowUp') {
        event.preventDefault();
        const idx = videos.findIndex((v) => v.id === current.id);
        const prev = videos[idx - 1] ?? videos[idx];
        if (prev) setActiveId(prev.id);
      } else if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        void markWatched(current);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, videos]);

  return (
    <div className={styles.page}>
      <header className={styles.breadcrumb}>
        <Link href={`/catalog/${courseId}`}>← Back to course</Link>
      </header>
      <h1 className={styles.title}>Videos</h1>

      {loading ? (
        <div style={{ height: 320, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
      ) : error || videos.length === 0 ? (
        <EmptyState
          title={error ? 'Could not load videos' : 'No videos'}
          description={error ?? 'Lecture videos will appear here.'}
          tone={error ? 'error' : 'default'}
          action={error ? { label: 'Retry', onClick: () => void load() } : undefined}
        />
      ) : (
        <div className={styles.layout}>
          <div className={styles.list}>
            {videos.map((video) => (
              <button
                key={video.id}
                type="button"
                className={`${styles.listItem} ${video.id === activeId ? styles.listItemActive : ''}`}
                onClick={() => setActiveId(video.id)}
              >
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={video.thumbnailUrl} alt="" className={styles.thumb} />
                ) : (
                  <div className={styles.thumb} />
                )}
                <div className={styles.itemBody}>
                  <span className={styles.itemTitle}>{video.title}</span>
                  <span className={styles.itemMeta}>{formatDuration(video.durationSeconds)}</span>
                </div>
                {video.watched && <span className={styles.watchedDot} aria-label="Watched" />}
              </button>
            ))}
          </div>
          <div className={styles.player}>
            {active && (
              <>
                <div className={styles.videoFrame}>
                  {active.url.includes('youtube.com') || active.url.includes('youtu.be') ? (
                    <iframe
                      src={active.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                      title={active.title}
                      allow="accelerometer; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      key={active.id}
                      src={active.url}
                      controls
                      onEnded={() => {
                        void markWatched(active);
                        advanceToNext(active);
                      }}
                    />
                  )}
                </div>
                <div className={styles.videoHeader}>
                  <h2 className={styles.videoTitle}>{active.title}</h2>
                  {active.description && (
                    <p className={styles.videoDescription}>{active.description}</p>
                  )}
                  <div className={styles.shortcuts}>
                    <span>
                      <kbd>J</kbd> / <kbd>↓</kbd> next
                    </span>
                    <span>
                      <kbd>K</kbd> / <kbd>↑</kbd> previous
                    </span>
                    <span>
                      <kbd>M</kbd> mark watched
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
