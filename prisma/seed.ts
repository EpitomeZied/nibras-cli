import { PrismaClient, SystemRole, ProjectStatus, DeliveryMode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── 1. Admin user ─────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'admin@nibras.local' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@nibras.local',
      systemRole: SystemRole.admin,
    },
  });
  console.log('✅ Admin user: admin@nibras.local (systemRole: admin)');

  // ── 2. Demo Subject ───────────────────────────────────────────────────────
  const subject = await prisma.subject.upsert({
    where: { slug: 'cs161' },
    update: {},
    create: {
      slug: 'cs161',
      name: 'Introduction to Computer Science',
    },
  });
  console.log('✅ Subject: cs161 — Introduction to Computer Science');

  // ── 3. Demo Course ────────────────────────────────────────────────────────
  const course = await prisma.course.upsert({
    where: { slug: 'cs161' },
    update: {},
    create: {
      slug: 'cs161',
      title: 'CS161 — Introduction to Computer Science',
      termLabel: 'Spring 2026',
      courseCode: 'CS161',
      isActive: true,
    },
  });
  console.log('✅ Course: CS161 — Introduction to Computer Science (Spring 2026)');

  // ── 4. Demo Project ───────────────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { slug: 'cs161/exam1' },
    update: {},
    create: {
      subjectId: subject.id,
      courseId: course.id,
      slug: 'cs161/exam1',
      name: 'Exam 1',
      description: 'First exam: implement basic JavaScript functions and pass the automated test suite.',
      status: ProjectStatus.published,
      deliveryMode: DeliveryMode.individual,
      defaultBranch: 'main',
    },
  });
  console.log('✅ Project: cs161/exam1 — Exam 1 (published, individual)');

  // ── 5. Demo Project Release (manifest + task) ─────────────────────────────
  const manifest = {
    projectKey: 'cs161/exam1',
    releaseVersion: '2026-03-01',
    apiBaseUrl: 'https://nibras-api.fly.dev',
    defaultBranch: 'main',
    buildpack: { node: '20' },
    test: {
      mode: 'public-grading',
      command: 'npm test',
      supportsPrevious: true,
    },
    submission: {
      allowedPaths: ['.nibras/**', 'src/**', 'test/**', 'README.md', 'package.json'],
      waitForVerificationSeconds: 30,
    },
  };

  const taskText = `# Exam 1 — JavaScript Fundamentals

## Overview

Complete the three functions in \`src/solution.js\`. Each function is tested automatically when you submit.

---

## Part 1 — Sum

Implement a function that returns the sum of two numbers.

\`\`\`js
// src/solution.js
function sum(a, b) {
  // TODO: your code here
}
\`\`\`

**Example:**
\`\`\`
sum(2, 3)  → 5
sum(-1, 1) → 0
\`\`\`

---

## Part 2 — Factorial

Implement a function that returns the factorial of a non-negative integer.

\`\`\`js
function factorial(n) {
  // TODO: your code here
}
\`\`\`

**Example:**
\`\`\`
factorial(0) → 1
factorial(5) → 120
\`\`\`

---

## Part 3 — Palindrome

Implement a function that returns \`true\` if the given string is a palindrome (reads the same forwards and backwards, case-insensitive), \`false\` otherwise.

\`\`\`js
function isPalindrome(str) {
  // TODO: your code here
}
\`\`\`

**Example:**
\`\`\`
isPalindrome("racecar") → true
isPalindrome("hello")   → false
isPalindrome("Madam")   → true
\`\`\`

---

## How to Submit

1. Run \`nibras test\` to check your work locally
2. Run \`nibras submit\` when your tests pass

Good luck! 🚀
`;

  await prisma.projectRelease.upsert({
    where: { projectId_version: { projectId: project.id, version: '2026-03-01' } },
    update: {},
    create: {
      projectId: project.id,
      version: '2026-03-01',
      taskText,
      manifestJson: manifest,
      publicAssetRef: 'public://seed',
      privateAssetRef: 'private://seed',
    },
  });
  console.log('✅ Project release: 2026-03-01');

  // ── 6. Demo Milestone ─────────────────────────────────────────────────────
  await prisma.milestone.upsert({
    where: { projectId_order: { projectId: project.id, order: 1 } },
    update: {},
    create: {
      projectId: project.id,
      title: 'Submission 1',
      description: 'Complete all three functions and pass the automated test suite.',
      order: 1,
      dueAt: new Date('2026-05-01T23:59:59Z'),
      isFinal: true,
    },
  });
  console.log('✅ Milestone: "Submission 1" (due 2026-05-01, final)');

  console.log('');
  console.log('🎉 Demo seed complete!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Fill in GitHub App credentials in .env');
  console.log('  2. Set GITHUB_TEMPLATE_OWNER and GITHUB_TEMPLATE_REPO in .env');
  console.log('  3. Run: npm run build && npm run dev');
  console.log('  4. Open http://localhost:3000 and log in with GitHub');
  console.log('  5. Student: nibras login → nibras setup --project cs161/exam1');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
