'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { useFormSubmit } from '../../../../../../lib/use-form-submit';
import { useFetch } from '../../../../../../lib/use-fetch';
import { getLevelLabel } from '../../../../../../lib/levels';
import styles from '../../../../instructor.module.css';

type RubricRow = { criterion: string; maxScore: number };
type ResourceRow = { label: string; url: string };

export default function NewProjectPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const [level, setLevel] = useState(1);
  const [templateId, setTemplateId] = useState('');
  const [rubric, setRubric] = useState<RubricRow[]>([{ criterion: '', maxScore: 10 }]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const { data: templates } = useFetch<
    Array<{ id: string; title: string; teamSize: number | null }>
  >(`/v1/tracking/courses/${courseId}/templates`);
  const { submitting, error, submit } = useFormSubmit({
    url: '/v1/tracking/projects',
    onSuccess: () => router.push(`/instructor/courses/${courseId}`),
  });

  function addRubricRow() {
    setRubric((prev) => [...prev, { criterion: '', maxScore: 10 }]);
  }

  function removeRubricRow(index: number) {
    setRubric((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRubricRow(index: number, field: keyof RubricRow, value: string | number) {
    setRubric((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addResourceRow() {
    setResources((prev) => [...prev, { label: '', url: '' }]);
  }

  function removeResourceRow(index: number) {
    setResources((prev) => prev.filter((_, i) => i !== index));
  }

  function updateResourceRow(index: number, field: keyof ResourceRow, value: string) {
    setResources((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const slug = (form.get('title') as string)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    void submit({
      courseId,
      slug,
      title: (form.get('title') as string).trim(),
      description: (form.get('description') as string).trim(),
      status: 'draft',
      level,
      templateId: templateId || null,
      deliveryMode: form.get('deliveryMode') as string,
      rubric: rubric
        .filter((row) => row.criterion.trim())
        .map((row) => ({
          criterion: row.criterion.trim(),
          maxScore: Number(row.maxScore),
        })),
      resources: resources
        .filter((row) => row.label.trim() && row.url.trim())
        .map((row) => ({
          label: row.label.trim(),
          url: row.url.trim(),
        })),
    });
  }

  return (
    <div className={styles.formPage}>
      <div>
        <p className={styles.breadcrumb}>
          <Link href="/instructor">Instructor</Link> /{' '}
          <Link href={`/instructor/courses/${courseId}`}>Course</Link> / New Project
        </p>
        <h1>Create Project</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className={styles.formSection}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Start from a template</h2>
            <Link href={`/instructor/courses/${courseId}/templates`} className={styles.backLink}>
              Manage templates
            </Link>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="templateId">Project blueprint</label>
            <select
              id="templateId"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">Create from scratch</option>
              {(templates ?? []).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                  {template.teamSize ? ` · ${template.teamSize} students` : ''}
                </option>
              ))}
            </select>
            <p className={styles.muted}>
              Templates carry reusable milestones, rubric structure, team size, and role definitions
              into new project launches.
            </p>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="title">Project Title</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="e.g. Project 1: Buffer Overflow"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            placeholder="Brief description shown to students."
            rows={3}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="level">Academic Year Level</label>
          <select id="level" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {[1, 2, 3, 4].map((lvl) => (
              <option key={lvl} value={lvl}>
                {getLevelLabel(lvl)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="deliveryMode">Delivery Mode</label>
          <select id="deliveryMode" name="deliveryMode" defaultValue="individual">
            <option value="individual">Individual</option>
            <option value="team">Team</option>
          </select>
        </div>

        {/* Rubric */}
        <div className={styles.dynamicSection}>
          <div className={styles.dynamicSectionHeader}>
            <span className={styles.dynamicSectionLabel}>Grading Rubric</span>
            <button type="button" className={styles.btnAddRow} onClick={addRubricRow}>
              + Add criterion
            </button>
          </div>
          {rubric.length === 0 && (
            <p className={styles.muted} style={{ fontSize: '13px' }}>
              No rubric criteria. Project will not be graded by criterion.
            </p>
          )}
          {rubric.map((row, index) => (
            <div key={index} className={styles.dynamicRow}>
              <input
                type="text"
                placeholder="Criterion description"
                value={row.criterion}
                onChange={(e) => updateRubricRow(index, 'criterion', e.target.value)}
                className={styles.dynamicRowMain}
              />
              <input
                type="number"
                min={0}
                max={1000}
                value={row.maxScore}
                onChange={(e) =>
                  updateRubricRow(index, 'maxScore', parseFloat(e.target.value) || 0)
                }
                className={styles.dynamicRowScore}
                title="Max score"
              />
              <span className={styles.dynamicRowUnit}>pts</span>
              <button
                type="button"
                className={styles.btnRemoveRow}
                onClick={() => removeRubricRow(index)}
                aria-label="Remove criterion"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Resources */}
        <div className={styles.dynamicSection}>
          <div className={styles.dynamicSectionHeader}>
            <span className={styles.dynamicSectionLabel}>Resources</span>
            <button type="button" className={styles.btnAddRow} onClick={addResourceRow}>
              + Add resource
            </button>
          </div>
          {resources.map((row, index) => (
            <div key={index} className={styles.dynamicRow}>
              <input
                type="text"
                placeholder="Label"
                value={row.label}
                onChange={(e) => updateResourceRow(index, 'label', e.target.value)}
                className={styles.dynamicRowLabel}
              />
              <input
                type="url"
                placeholder="https://…"
                value={row.url}
                onChange={(e) => updateResourceRow(index, 'url', e.target.value)}
                className={styles.dynamicRowMain}
              />
              <button
                type="button"
                className={styles.btnRemoveRow}
                onClick={() => removeResourceRow(index)}
                aria-label="Remove resource"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Project'}
          </button>
          <Link href={`/instructor/courses/${courseId}`} className={styles.backLink}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
