'use client';

import { type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormSubmit } from '../../../../lib/use-form-submit';
import styles from '../../instructor.module.css';

export default function NewProgramPage() {
  const router = useRouter();
  const { submitting, error, submit } = useFormSubmit({
    url: '/v1/programs',
    onSuccess: () => router.push('/instructor/programs'),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit({
      slug: String(form.get('slug') || '')
        .trim()
        .toLowerCase(),
      title: String(form.get('title') || '').trim(),
      code: String(form.get('code') || '').trim(),
      academicYear: String(form.get('academicYear') || '').trim(),
      totalUnitRequirement: Number(form.get('totalUnitRequirement') || 120),
      status: 'draft',
    });
  }

  return (
    <div className={styles.formPage}>
      <div>
        <p className={styles.breadcrumb}>
          <Link href="/instructor/programs">Programs</Link> / New
        </p>
        <h1>Create Program</h1>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className={styles.formSection}>
        <div className={styles.formGroup}>
          <label htmlFor="title">Program title</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="Computer Science Program"
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="code">Program code</label>
          <input id="code" name="code" type="text" required placeholder="CS" />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="slug">Slug</label>
          <input id="slug" name="slug" type="text" required placeholder="cs-program" />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="academicYear">Academic year</label>
          <input
            id="academicYear"
            name="academicYear"
            type="text"
            required
            placeholder="2026-2027"
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="totalUnitRequirement">Total unit requirement</label>
          <input
            id="totalUnitRequirement"
            name="totalUnitRequirement"
            type="number"
            min="1"
            defaultValue="120"
          />
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create program'}
          </button>
          <Link href="/instructor/programs" className={styles.backLink}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
