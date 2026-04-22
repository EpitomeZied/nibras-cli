'use client';

import { useState } from 'react';
import type { TrackRecommendation } from '@nibras/contracts';
import { apiFetch } from '../../../lib/session';
import styles from '../../instructor/instructor.module.css';
import bannerStyles from './recommendation-banner.module.css';

type RecommendationBannerProps = {
  recommendations: TrackRecommendation[];
  year1CourseCount: number;
  canSelectTrack: boolean;
  onTrackSelected: () => void;
};

type ModalProps = {
  recommendation: TrackRecommendation;
  onConfirm: () => void;
  onCancel: () => void;
  selecting: boolean;
};

function ScoreBar({ score }: { score: number }) {
  return (
    <div className={bannerStyles.scoreBarWrap}>
      <div className={bannerStyles.scoreBar} style={{ width: `${score}%` }} />
    </div>
  );
}

function ConfirmModal({ recommendation, onConfirm, onCancel, selecting }: ModalProps) {
  return (
    <div className={bannerStyles.modalOverlay}>
      <div className={bannerStyles.modal}>
        <div className={bannerStyles.modalHeader}>
          <h3>Confirm Track Selection</h3>
          <button type="button" className={bannerStyles.modalClose} onClick={onCancel}>
            ×
          </button>
        </div>

        <div className={bannerStyles.modalBody}>
          <p className={bannerStyles.modalTrackName}>{recommendation.trackTitle}</p>
          <div className={bannerStyles.modalScore}>
            <span className={bannerStyles.scorePill}>{recommendation.matchScore}% match</span>
            <span className={styles.muted}>
              {recommendation.matchedUnits} / {recommendation.totalTrackUnits} units aligned
            </span>
          </div>
          <ScoreBar score={recommendation.matchScore} />
          <p className={bannerStyles.modalReason}>{recommendation.reason}</p>
          {recommendation.trackDescription && (
            <p className={styles.muted}>{recommendation.trackDescription}</p>
          )}
          <p className={bannerStyles.modalWarning}>
            You can change your track later if the selection window is still open.
          </p>
        </div>

        <div className={bannerStyles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onConfirm}
            disabled={selecting}
          >
            {selecting ? 'Selecting…' : `Select ${recommendation.trackTitle}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecommendationBanner({
  recommendations,
  year1CourseCount,
  canSelectTrack,
  onTrackSelected,
}: RecommendationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [pendingRec, setPendingRec] = useState<TrackRecommendation | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);

  if (dismissed || recommendations.length === 0) return null;

  async function confirmSelect() {
    if (!pendingRec) return;
    setSelecting(true);
    setSelectError(null);
    try {
      const response = await apiFetch('/v1/programs/student/me/select-track', {
        method: 'POST',
        auth: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trackId: pendingRec.trackId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }
      setPendingRec(null);
      onTrackSelected();
    } catch (err) {
      setSelectError(err instanceof Error ? err.message : 'Failed to select track.');
    } finally {
      setSelecting(false);
    }
  }

  return (
    <>
      <div className={bannerStyles.banner}>
        <div className={bannerStyles.bannerHeader}>
          <div>
            <span className={bannerStyles.bannerEyebrow}>Track Recommendation</span>
            <p className={bannerStyles.bannerSub}>
              Based on your {year1CourseCount} Year 1 course
              {year1CourseCount !== 1 ? 's' : ''}, here are your best-matching tracks:
            </p>
          </div>
          <button
            type="button"
            className={bannerStyles.dismissBtn}
            onClick={() => setDismissed(true)}
            aria-label="Dismiss recommendations"
          >
            ×
          </button>
        </div>

        {selectError && <p className={styles.errorText}>{selectError}</p>}

        <div className={bannerStyles.cards}>
          {recommendations.map((rec, idx) => (
            <div key={rec.trackId} className={bannerStyles.recCard}>
              <div className={bannerStyles.recRank}>#{idx + 1}</div>
              <div className={bannerStyles.recBody}>
                <div className={bannerStyles.recTop}>
                  <strong className={bannerStyles.recTitle}>{rec.trackTitle}</strong>
                  <span className={bannerStyles.scorePill}>{rec.matchScore}% match</span>
                </div>
                <ScoreBar score={rec.matchScore} />
                <p className={bannerStyles.recReason}>{rec.reason}</p>
              </div>
              {canSelectTrack && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => setPendingRec(rec)}
                >
                  Select
                </button>
              )}
            </div>
          ))}
        </div>

        {!canSelectTrack && (
          <p className={styles.muted} style={{ marginTop: 8, fontSize: 12 }}>
            Track selection is not open yet. Recommendations are shown for reference.
          </p>
        )}
      </div>

      {pendingRec && (
        <ConfirmModal
          recommendation={pendingRec}
          onConfirm={() => void confirmSelect()}
          onCancel={() => setPendingRec(null)}
          selecting={selecting}
        />
      )}
    </>
  );
}
