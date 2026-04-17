'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { useFormSubmit } from '../../../../../../lib/use-form-submit';
import styles from '../../../../instructor.module.css';

type RoleRow = { key: string; label: string; count: number };
type RubricRow = { criterion: string; maxScore: number };
type ResourceRow = { label: string; url: string };
type MilestoneRow = {
  title: string;
  description: string;
  order: number;
  dueAt: string;
  isFinal: boolean;
};

export default function NewTemplatePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const [teamSize, setTeamSize] = useState(3);
  const [roles, setRoles] = useState<RoleRow[]>([
    { key: 'backend', label: 'Backend', count: 1 },
    { key: 'frontend', label: 'Frontend', count: 1 },
    { key: 'pm', label: 'Project Manager', count: 1 },
  ]);
  const rubric: RubricRow[] = [];
  const resources: ResourceRow[] = [];
  const [milestones, setMilestones] = useState<MilestoneRow[]>([
    { title: 'Design Review', description: '', order: 1, dueAt: '', isFinal: false },
    { title: 'Final Delivery', description: '', order: 2, dueAt: '', isFinal: true },
  ]);
  const { submitting, error, submit } = useFormSubmit({
    url: `/v1/tracking/courses/${courseId}/templates`,
    onSuccess: () => router.push(`/instructor/courses/${courseId}/templates`),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const slug =
      String(form.get('slug') || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    void submit({
      slug,
      title,
      description: String(form.get('description') || '').trim(),
      deliveryMode: 'team',
      teamSize,
      status: 'active',
      roles: roles
        .filter((role) => role.key.trim() && role.label.trim())
        .map((role, index) => ({
          key: role.key.trim(),
          label: role.label.trim(),
          count: Number(role.count) || 1,
          sortOrder: index,
        })),
      rubric: rubric
        .filter((row) => row.criterion.trim())
        .map((row) => ({ criterion: row.criterion.trim(), maxScore: Number(row.maxScore) || 0 })),
      resources: resources
        .filter((row) => row.label.trim() && row.url.trim())
        .map((row) => ({ label: row.label.trim(), url: row.url.trim() })),
      milestones: milestones
        .filter((row) => row.title.trim())
        .map((row, index) => ({
          title: row.title.trim(),
          description: row.description.trim(),
          order: row.order || index + 1,
          dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
          isFinal: row.isFinal,
        })),
    });
  }

  return (
    <div className={styles.formPage}>
      <div>
        <p className={styles.breadcrumb}>
          <Link href="/instructor">Instructor</Link> /{' '}
          <Link href={`/instructor/courses/${courseId}`}>Course</Link> /{' '}
          <Link href={`/instructor/courses/${courseId}/templates`}>Templates</Link> / New
        </p>
        <h1>Create Project Template</h1>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className={styles.formSection}>
        <div className={styles.formGroup}>
          <label htmlFor="title">Template Title</label>
          <input id="title" name="title" type="text" required placeholder="Capstone Team Project" />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="slug">Slug</label>
          <input id="slug" name="slug" type="text" placeholder="capstone-team-project" />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={3} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="teamSize">Exact Team Size</label>
          <input
            id="teamSize"
            type="number"
            min={2}
            max={8}
            value={teamSize}
            onChange={(event) => setTeamSize(Number(event.target.value) || 2)}
          />
        </div>

        <div className={styles.dynamicSection}>
          <div className={styles.dynamicSectionHeader}>
            <span className={styles.dynamicSectionLabel}>Role Slots</span>
            <button
              type="button"
              className={styles.btnAddRow}
              onClick={() => setRoles((current) => [...current, { key: '', label: '', count: 1 }])}
            >
              + Add role
            </button>
          </div>
          {roles.map((role, index) => (
            <div key={index} className={styles.dynamicRow}>
              <input
                type="text"
                placeholder="role-key"
                value={role.key}
                onChange={(event) =>
                  setRoles((current) =>
                    current.map((entry, currentIndex) =>
                      currentIndex === index ? { ...entry, key: event.target.value } : entry
                    )
                  )
                }
                className={styles.dynamicRowLabel}
              />
              <input
                type="text"
                placeholder="Role label"
                value={role.label}
                onChange={(event) =>
                  setRoles((current) =>
                    current.map((entry, currentIndex) =>
                      currentIndex === index ? { ...entry, label: event.target.value } : entry
                    )
                  )
                }
                className={styles.dynamicRowMain}
              />
              <input
                type="number"
                min={1}
                value={role.count}
                onChange={(event) =>
                  setRoles((current) =>
                    current.map((entry, currentIndex) =>
                      currentIndex === index
                        ? { ...entry, count: Number(event.target.value) || 1 }
                        : entry
                    )
                  )
                }
                className={styles.dynamicRowScore}
              />
            </div>
          ))}
        </div>

        <div className={styles.dynamicSection}>
          <div className={styles.dynamicSectionHeader}>
            <span className={styles.dynamicSectionLabel}>Milestones</span>
            <button
              type="button"
              className={styles.btnAddRow}
              onClick={() =>
                setMilestones((current) => [
                  ...current,
                  {
                    title: '',
                    description: '',
                    order: current.length + 1,
                    dueAt: '',
                    isFinal: false,
                  },
                ])
              }
            >
              + Add milestone
            </button>
          </div>
          {milestones.map((milestone, index) => (
            <div key={index} className={styles.formSection}>
              <div className={styles.formGroup}>
                <label>Title</label>
                <input
                  type="text"
                  value={milestone.title}
                  onChange={(event) =>
                    setMilestones((current) =>
                      current.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, title: event.target.value } : entry
                      )
                    )
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label>Description</label>
                <textarea
                  rows={2}
                  value={milestone.description}
                  onChange={(event) =>
                    setMilestones((current) =>
                      current.map((entry, currentIndex) =>
                        currentIndex === index
                          ? { ...entry, description: event.target.value }
                          : entry
                      )
                    )
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label>Due date</label>
                <input
                  type="datetime-local"
                  value={milestone.dueAt}
                  onChange={(event) =>
                    setMilestones((current) =>
                      current.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, dueAt: event.target.value } : entry
                      )
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Template'}
          </button>
          <Link href={`/instructor/courses/${courseId}/templates`} className={styles.backLink}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
