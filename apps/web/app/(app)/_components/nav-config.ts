export type NavVisibility = 'all' | 'instructor' | 'admin';

export type AppNavItem = {
  href: string;
  label: string;
  description: string;
  visibility: NavVisibility;
  matchPrefixes?: string[];
};

export type ShellMembership = { courseId: string; role: string; level: number };

export type ShellSessionUser = {
  systemRole?: string;
  memberships?: ShellMembership[];
};

export const appNavItems: AppNavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Track account, projects, and milestones.',
    visibility: 'all',
  },
  {
    href: '/projects',
    label: 'Projects',
    description: 'Manage submissions, progress, and reviews.',
    visibility: 'all',
    matchPrefixes: ['/submissions'],
  },
  {
    href: '/catalog',
    label: 'Catalog',
    description: 'Browse project templates and apply across all courses.',
    visibility: 'all',
  },
  {
    href: '/planner',
    label: 'Planner',
    description: 'Plan your academic path, track petitions, and generate a sheet.',
    visibility: 'all',
  },
  {
    href: '/tutor',
    label: 'Tutor',
    description: 'Chat, insights, smart routing, and recommendations.',
    visibility: 'all',
  },
  {
    href: '/community',
    label: 'Community',
    description: 'Ask questions, share answers, and join course discussions.',
    visibility: 'all',
  },
  {
    href: '/competitions',
    label: 'Competitions',
    description: 'Contests, practice problems, ranking, and competitive history.',
    visibility: 'all',
  },
  {
    href: '/achievements',
    label: 'Achievements',
    description: 'Badges, reputation, leaderboards, and level progression.',
    visibility: 'all',
    matchPrefixes: ['/levels'],
  },
  {
    href: '/instructor',
    label: 'Instructor',
    description: 'Manage courses, templates, team formation, and programs.',
    visibility: 'instructor',
    matchPrefixes: ['/instructor/programs'],
  },
  {
    href: '/instructor/analytics',
    label: 'Analytics',
    description: 'Aggregate signal across courses — submissions, pass rate, engagement.',
    visibility: 'instructor',
    matchPrefixes: [
      '/instructor/analytics/courses',
      '/instructor/analytics/engagement',
      '/instructor/analytics/students',
    ],
  },
  {
    href: '/admin',
    label: 'Admin',
    description: 'System-wide submissions, projects, and oversight.',
    visibility: 'admin',
  },
];

export function canAccessNavItem(item: AppNavItem, user: ShellSessionUser | null): boolean {
  if (item.visibility === 'all') return true;
  if (item.visibility === 'admin') return user?.systemRole === 'admin';
  return (
    user?.systemRole === 'admin' ||
    (user?.memberships?.some((membership) => {
      const role = membership.role.toLowerCase();
      return role === 'instructor' || role === 'ta';
    }) ??
      false)
  );
}

export function isNavItemActive(item: AppNavItem, pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (
    item.matchPrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) ?? false
  );
}

export const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Track your current course operations and GitHub-linked progress.',
  },
  '/projects': {
    title: 'Projects',
    subtitle: 'Review milestones, role applications, submissions, and grading details.',
  },
  '/submissions': {
    title: 'Submissions',
    subtitle: 'Review your submission history, statuses, and detailed feedback.',
  },
  '/catalog': {
    title: 'Project Catalog',
    subtitle: 'Discover projects, browse templates, and apply.',
  },
  '/planner': {
    title: 'Planner',
    subtitle: 'Track your academic program, petitions, approvals, and printable sheet.',
  },
  '/planner/track': {
    title: 'Track Selection',
    subtitle: 'Choose the specialization track for your program plan.',
  },
  '/planner/petitions': {
    title: 'Planner Petitions',
    subtitle: 'Review academic petitions and the current approval status.',
  },
  '/planner/sheet': {
    title: 'Program Sheet',
    subtitle: 'Generate and review the printable version of your program plan.',
  },
  '/instructor': {
    title: 'Instructor',
    subtitle: 'Manage courses, templates, team formation, and student submissions.',
  },
  '/instructor/courses': {
    title: 'Courses',
    subtitle: 'Review course activity, projects, templates, and review queues.',
  },
  '/instructor/programs': {
    title: 'Programs',
    subtitle: 'Build academic programs, requirements, tracks, and petitions.',
  },
  '/admin': {
    title: 'Admin',
    subtitle: 'System-wide oversight of submissions, projects, and activity.',
  },
  '/install/complete': {
    title: 'GitHub App',
    subtitle: 'Finish linking the installation to unlock repository provisioning.',
  },
  '/instructor/onboarding': {
    title: 'CLI Setup Guide',
    subtitle: 'Install the Nibras CLI, authenticate, and submit your first project.',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Manage your account preferences and connected services.',
  },
  '/achievements': {
    title: 'Achievements',
    subtitle: 'Track the badges you have earned and the milestones still ahead.',
  },
  '/achievements/leaderboard': {
    title: 'Leaderboard',
    subtitle: 'Compare your standing against the rest of the cohort.',
  },
  '/achievements/reputation': {
    title: 'Reputation',
    subtitle: 'Detailed breakdown of reputation changes over time.',
  },
  '/levels': {
    title: 'Levels',
    subtitle: 'Tier progression based on reputation and contributions.',
  },
  '/tutor': {
    title: 'AI Tutor',
    subtitle: 'Chat with the tutor about any topic you’re working through.',
  },
  '/tutor/insights': {
    title: 'Learning Insights',
    subtitle: 'Where you’re strong, where you’re struggling, and what to study next.',
  },
  '/tutor/routing': {
    title: 'Smart Routing',
    subtitle: 'Map a learning goal to a step-by-step study plan.',
  },
  '/tutor/recommendations': {
    title: 'Recommendations',
    subtitle: 'Specialization and track suggestions tailored to your grades.',
  },
  '/community': {
    title: 'Community',
    subtitle: 'Ask questions, share answers, and learn from your peers.',
  },
  '/community/discussions': {
    title: 'Course Discussions',
    subtitle: 'Long-form threads scoped to your enrolled courses.',
  },
  '/competitions': {
    title: 'Competitions',
    subtitle: 'Upcoming contests and linked accounts.',
  },
  '/competitions/practice': {
    title: 'Practice',
    subtitle: 'Problems from Codeforces, LeetCode, and AtCoder.',
  },
  '/competitions/ranking': {
    title: 'Ranking',
    subtitle: 'How you rank across linked competitive platforms.',
  },
  '/competitions/history': {
    title: 'Contest History',
    subtitle: 'Your past contest performance and rating trend.',
  },
  '/instructor/analytics': {
    title: 'Analytics',
    subtitle: 'Aggregate cross-course signal and risk callouts.',
  },
  '/instructor/analytics/courses': {
    title: 'Course Analytics',
    subtitle: 'Per-course completion, average grade, and pass rate.',
  },
  '/instructor/analytics/engagement': {
    title: 'Engagement',
    subtitle: 'Time-on-task broken down by day and course.',
  },
  '/instructor/analytics/students': {
    title: 'Students',
    subtitle: 'Per-student engagement, grades, and risk classification.',
  },
};

export function getPageTitle(pathname: string | null): { title: string; subtitle: string } | null {
  if (!pathname) return null;
  const matches = Object.entries(pageTitles)
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((left, right) => right[0].length - left[0].length);
  return matches[0]?.[1] ?? null;
}
