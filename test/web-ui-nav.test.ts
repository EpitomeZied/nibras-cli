import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVisibleNavGroups,
  isNavItemActive,
} from '../apps/web/app/(app)/_components/nav-config';
import {
  plannerSections,
  programSections,
} from '../apps/web/app/(app)/_components/workspace-sections';

test('student navigation only shows student and system groups', () => {
  const groups = getVisibleNavGroups({
    username: 'student',
    email: 'student@example.com',
    githubLogin: 'student-gh',
    githubLinked: true,
    githubAppInstalled: true,
    memberships: [{ courseId: 'course-1', role: 'student', level: 1 }],
  });

  assert.deepEqual(
    groups.map((group) => group.label),
    ['Student', 'System']
  );
  assert.deepEqual(
    groups[0].items.map((item) => item.label),
    ['Dashboard', 'Projects', 'Planner', 'Submissions']
  );
});

test('instructor navigation exposes instructor workspace links', () => {
  const groups = getVisibleNavGroups({
    username: 'instructor',
    email: 'instructor@example.com',
    githubLogin: 'instructor-gh',
    githubLinked: true,
    githubAppInstalled: true,
    memberships: [{ courseId: 'course-1', role: 'instructor', level: 4 }],
  });

  const instructorGroup = groups.find((group) => group.label === 'Instructor');
  assert.ok(instructorGroup);
  assert.deepEqual(
    instructorGroup.items.map((item) => item.label),
    ['Courses', 'Templates', 'Team Projects', 'Programs']
  );
});

test('admin navigation includes admin group', () => {
  const groups = getVisibleNavGroups({
    username: 'admin',
    email: 'admin@example.com',
    githubLogin: 'admin-gh',
    githubLinked: true,
    githubAppInstalled: true,
    systemRole: 'admin',
    memberships: [],
  });

  assert.ok(groups.some((group) => group.label === 'Admin'));
});

test('hash-based instructor shortcut is active on instructor anchors', () => {
  const groups = getVisibleNavGroups({
    username: 'instructor',
    email: 'instructor@example.com',
    githubLogin: 'instructor-gh',
    githubLinked: true,
    githubAppInstalled: true,
    memberships: [{ courseId: 'course-1', role: 'instructor', level: 4 }],
  });
  const templates = groups
    .flatMap((group) => group.items)
    .find((item) => item.label === 'Templates');

  assert.ok(templates);
  assert.equal(isNavItemActive(templates, '/instructor', '#templates'), true);
  assert.equal(isNavItemActive(templates, '/instructor', '#team-projects'), false);
});

test('planner and program section configs expose the expected tabs', () => {
  assert.deepEqual(plannerSections.map((item) => item.label), [
    'Overview',
    'Track',
    'Petitions',
    'Sheet',
  ]);

  assert.deepEqual(
    programSections('program-123').map((item) => item.href),
    [
      '/instructor/programs/program-123',
      '/instructor/programs/program-123/requirements',
      '/instructor/programs/program-123/tracks',
      '/instructor/programs/program-123/petitions',
    ]
  );
});
