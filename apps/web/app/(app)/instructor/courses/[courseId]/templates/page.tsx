'use client';

import Link from 'next/link';
import { use } from 'react';
import { useFetch } from '../../../../../lib/use-fetch';
import styles from '../../../instructor.module.css';

type Template = {
  id: string;
  title: string;
  status: string;
  teamSize: number | null;
  roles: Array<{ id: string }>;
};

export default function CourseTemplatesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const {
    data: templates,
    loading,
    error,
  } = useFetch<Template[]>(`/v1/tracking/courses/${courseId}/templates`);

  return (
    <div className={styles.page}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href="/instructor">Instructor</Link> /{' '}
            <Link href={`/instructor/courses/${courseId}`}>Course</Link> / Templates
          </p>
          <h1>Project Templates</h1>
          <p className={styles.subtitle}>
            Reusable project blueprints that carry team size, role structure, and repeatable setup
            into future project launches.
          </p>
        </div>
        <Link href={`/instructor/courses/${courseId}/templates/new`} className={styles.btnPrimary}>
          + New Template
        </Link>
      </div>

      {loading && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && !error && (
        <>
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Templates</span>
              <strong>{templates?.length ?? 0}</strong>
              <p>Reusable blueprints in this course</p>
            </article>
            <article className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Team-ready</span>
              <strong>{(templates ?? []).filter((template) => template.teamSize).length}</strong>
              <p>Include team size or role configuration</p>
            </article>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Templates</h2>
              <span className={styles.muted}>{templates?.length ?? 0} total</span>
            </div>
            {!templates?.length ? (
              <p className={styles.muted}>No templates created for this course yet.</p>
            ) : (
              <div className={styles.projectList}>
                {templates.map((template) => (
                  <div key={template.id} className={`${styles.projectRow} ${styles.templateRow}`}>
                    <div>
                      <span className={styles.statusBadge}>{template.status}</span>
                      <strong style={{ display: 'block', marginTop: 8 }}>{template.title}</strong>
                      <p className={styles.muted}>
                        {template.teamSize
                          ? `${template.teamSize} students · ${template.roles.length} roles`
                          : 'Individual blueprint'}
                      </p>
                    </div>
                    <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                      {template.teamSize ? 'Team template' : 'Individual template'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
