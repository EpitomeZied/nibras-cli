'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { apiFetch } from '../../../../../lib/session';
import { getLevelLabel, getLevelBadgeSuffix, MAX_LEVEL } from '../../../../../lib/levels';
import styles from '../../../instructor.module.css';

type Member = {
  id: string;
  userId: string;
  username: string;
  githubLogin: string;
  role: 'student' | 'instructor' | 'ta';
  level: number;
  createdAt: string;
};

export default function CourseMembersPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addLogin, setAddLogin] = useState('');
  const [addRole, setAddRole] = useState<'student' | 'ta'>('student');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLevel, setBulkLevel] = useState<number>(2);
  const [bulkPromoting, setBulkPromoting] = useState(false);
  const [inviteRole, setInviteRole] = useState<'student' | 'ta'>('student');
  const [inviteExpiry, setInviteExpiry] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadMembers();
  }, [courseId]);

  async function loadMembers() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/v1/tracking/courses/${courseId}/members`, { auth: true });
      if (!res.ok) throw new Error('Failed to load members.');
      setMembers((await res.json()) as Member[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      const res = await apiFetch(`/v1/tracking/courses/${courseId}/members`, {
        method: 'POST',
        auth: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ githubLogin: addLogin.trim(), role: addRole }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || `Request failed (${res.status}).`);
      }
      const member = (await res.json()) as Member;
      setMembers((prev) => [...prev, member]);
      setAddLogin('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setAdding(false);
    }
  }

  async function handleGenerateInvite() {
    setInviteError(null);
    setInviteUrl(null);
    setCopied(false);
    setGeneratingInvite(true);
    try {
      const body: Record<string, unknown> = { role: inviteRole };
      if (inviteExpiry) body.expiresAt = new Date(inviteExpiry).toISOString();
      const res = await apiFetch(`/v1/tracking/courses/${courseId}/invites`, {
        method: 'POST',
        auth: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || `Request failed (${res.status}).`);
      }
      const data = (await res.json()) as { code: string; inviteUrl: string };
      const webUrl = `${window.location.origin}/join/${data.code}`;
      setInviteUrl(webUrl);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to generate invite.');
    } finally {
      setGeneratingInvite(false);
    }
  }

  function handleCopy() {
    if (!inviteUrl) return;
    void navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId);
    try {
      const res = await apiFetch(`/v1/tracking/courses/${courseId}/members/${userId}`, {
        method: 'DELETE',
        auth: true,
      });
      if (!res.ok) throw new Error('Failed to remove member.');
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch {
      // Silently re-fetch on error
      void loadMembers();
    } finally {
      setRemovingId(null);
    }
  }

  async function handlePromote(userId: string) {
    const member = members.find((m) => m.userId === userId);
    if (!member) return;
    const nextLevel = Math.min((member.level ?? 1) + 1, MAX_LEVEL);
    setPromotingId(userId);
    try {
      await apiFetch(`/v1/tracking/courses/${courseId}/members/${userId}/level`, {
        method: 'PATCH',
        auth: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ level: nextLevel }),
      });
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, level: nextLevel } : m)));
    } catch {
      // Silently ignore promote errors
    } finally {
      setPromotingId(null);
    }
  }

  async function handleBulkPromote() {
    if (selectedIds.size === 0) return;
    setBulkPromoting(true);
    try {
      await Promise.all(
        [...selectedIds].map((uid) =>
          apiFetch(`/v1/tracking/courses/${courseId}/members/${uid}/level`, {
            method: 'PATCH',
            auth: true,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ level: bulkLevel }),
          })
        )
      );
      setMembers((prev) =>
        prev.map((m) => (selectedIds.has(m.userId) ? { ...m, level: bulkLevel } : m))
      );
      setSelectedIds(new Set());
    } catch {
      // Silently ignore bulk errors
    } finally {
      setBulkPromoting(false);
    }
  }

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleSelectAll(students: Member[]) {
    if (students.every((s) => selectedIds.has(s.userId))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.userId)));
    }
  }

  function roleClass(role: string) {
    if (role === 'instructor') return styles.roleInstructor;
    if (role === 'ta') return styles.roleTa;
    return styles.roleStudent;
  }

  return (
    <div className={styles.page}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href="/instructor">Instructor</Link> /{' '}
            <Link href={`/instructor/courses/${courseId}`}>Course</Link> / Members
          </p>
          <h1>Course Members</h1>
        </div>
      </div>

      {/* Add member form */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Add Member</h2>
        </div>
        <form
          onSubmit={(e) => void handleAdd(e)}
          style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <input
            type="text"
            placeholder="GitHub login"
            value={addLogin}
            onChange={(e) => setAddLogin(e.target.value)}
            required
            style={{
              padding: '8px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '14px',
              minWidth: '180px',
            }}
          />
          <select
            value={addRole}
            onChange={(e) => setAddRole(e.target.value as 'student' | 'ta')}
            style={{
              padding: '8px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '14px',
            }}
          >
            <option value="student">Student</option>
            <option value="ta">TA</option>
          </select>
          <button type="submit" className={styles.btnPrimary} disabled={adding}>
            {adding ? 'Adding…' : 'Add'}
          </button>
          {addError && <span className={styles.errorText}>{addError}</span>}
        </form>
      </div>

      {/* Invite link generator */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Generate Invite Link</h2>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: inviteUrl ? 12 : 0,
          }}
        >
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'student' | 'ta')}
            style={{
              padding: '8px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '14px',
            }}
          >
            <option value="student">Student</option>
            <option value="ta">TA</option>
          </select>
          <input
            type="datetime-local"
            value={inviteExpiry}
            onChange={(e) => setInviteExpiry(e.target.value)}
            title="Optional expiry"
            style={{
              padding: '8px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '14px',
            }}
          />
          <button
            className={styles.btnSecondary}
            disabled={generatingInvite}
            onClick={() => void handleGenerateInvite()}
          >
            {generatingInvite ? 'Generating…' : 'Generate Link'}
          </button>
        </div>
        {inviteError && <p className={styles.errorText}>{inviteError}</p>}
        {inviteUrl && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              marginTop: 8,
              flexWrap: 'wrap',
            }}
          >
            <code
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
                wordBreak: 'break-all',
              }}
            >
              {inviteUrl}
            </code>
            <button
              className={styles.btnPrimary}
              onClick={handleCopy}
              style={{ whiteSpace: 'nowrap' }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Members table */}
      {loading && <p className={styles.muted}>Loading members…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && !error && (
        <div className={styles.panel} style={{ overflowX: 'auto' }}>
          {members.length === 0 ? (
            <p className={styles.muted}>No members yet.</p>
          ) : (
            <>
              {/* Filter + bulk toolbar */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginBottom: 14,
                }}
              >
                <select
                  value={levelFilter ?? ''}
                  onChange={(e) =>
                    setLevelFilter(e.target.value === '' ? null : Number(e.target.value))
                  }
                  style={{
                    padding: '6px 10px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text)',
                    fontSize: '13px',
                  }}
                >
                  <option value="">All Years</option>
                  {[1, 2, 3, 4].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {getLevelLabel(lvl)}
                    </option>
                  ))}
                </select>

                {selectedIds.size > 0 && (
                  <>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {selectedIds.size} selected —
                    </span>
                    <select
                      value={bulkLevel}
                      onChange={(e) => setBulkLevel(Number(e.target.value))}
                      style={{
                        padding: '6px 10px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--text)',
                        fontSize: '13px',
                      }}
                    >
                      {[1, 2, 3, 4].map((lvl) => (
                        <option key={lvl} value={lvl}>
                          Set to {getLevelLabel(lvl)}
                        </option>
                      ))}
                    </select>
                    <button
                      className={styles.btnPrimary}
                      onClick={() => void handleBulkPromote()}
                      disabled={bulkPromoting}
                      style={{ padding: '6px 14px', fontSize: 13 }}
                    >
                      {bulkPromoting ? 'Updating…' : 'Apply'}
                    </button>
                    <button
                      className={styles.btnSecondary}
                      onClick={() => setSelectedIds(new Set())}
                      style={{ padding: '6px 10px', fontSize: 13 }}
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>

              {(() => {
                const students = members.filter((m) => m.role === 'student');
                const filtered = levelFilter
                  ? members.filter((m) => (m.level ?? 1) === levelFilter)
                  : members;
                const allStudentsSelected =
                  students.length > 0 && students.every((s) => selectedIds.has(s.userId));

                return (
                  <table className={styles.submissionTable}>
                    <thead>
                      <tr>
                        <th style={{ width: 32 }}>
                          <input
                            type="checkbox"
                            checked={allStudentsSelected}
                            onChange={() => toggleSelectAll(students)}
                            title="Select all students"
                          />
                        </th>
                        <th>GitHub Login</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Academic Year</th>
                        <th>Joined</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((member) => {
                        const lvl = member.level ?? 1;
                        const badgeClass =
                          styles[`levelBadge${getLevelBadgeSuffix(lvl)}`] ?? styles.levelBadge1;
                        return (
                          <tr key={member.id}>
                            <td>
                              {member.role === 'student' && (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(member.userId)}
                                  onChange={() => toggleSelect(member.userId)}
                                />
                              )}
                            </td>
                            <td className={styles.mono}>@{member.githubLogin}</td>
                            <td>{member.username}</td>
                            <td>
                              <span className={`${styles.roleBadge} ${roleClass(member.role)}`}>
                                {member.role}
                              </span>
                            </td>
                            <td>
                              {member.role === 'student' ? (
                                <span className={`${styles.levelBadge} ${badgeClass}`}>
                                  {getLevelLabel(lvl)}
                                </span>
                              ) : (
                                <span className={styles.muted}>—</span>
                              )}
                            </td>
                            <td className={styles.mono}>
                              {new Date(member.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                            <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {member.role === 'student' && lvl < MAX_LEVEL && (
                                <button
                                  className={styles.btnPromote}
                                  onClick={() => void handlePromote(member.userId)}
                                  disabled={promotingId === member.userId}
                                  title={`Promote to ${getLevelLabel(lvl + 1)}`}
                                >
                                  {promotingId === member.userId ? '…' : `↑ Year ${lvl + 1}`}
                                </button>
                              )}
                              {member.role !== 'instructor' && (
                                <button
                                  className={styles.btnRemoveRow}
                                  onClick={() => void handleRemove(member.userId)}
                                  disabled={removingId === member.userId}
                                  title="Remove member"
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
