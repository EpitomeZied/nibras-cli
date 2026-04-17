export type ShellSessionUser = {
  username: string;
  email: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  systemRole?: string;
  memberships?: Array<{ courseId: string; role: string; level: number }>;
};

export type AppNavVisibility = 'all' | 'student' | 'instructor' | 'admin';

export type AppNavItem = {
  id: string;
  href: string;
  label: string;
  description: string;
  matchPrefixes: string[];
  visibility: AppNavVisibility;
};

export type AppNavGroup = {
  id: string;
  label: string;
  visibility: AppNavVisibility;
  items: AppNavItem[];
};

export const appNavGroups: AppNavGroup[] = [
  {
    id: 'student',
    label: 'Student',
    visibility: 'student',
    items: [
      {
        id: 'dashboard',
        href: '/dashboard',
        label: 'Dashboard',
        description: 'See what needs action across courses, projects, and reviews.',
        matchPrefixes: ['/dashboard'],
        visibility: 'student',
      },
      {
        id: 'projects',
        href: '/projects',
        label: 'Projects',
        description: 'Submit work, manage milestones, and track project progress.',
        matchPrefixes: ['/projects'],
        visibility: 'student',
      },
      {
        id: 'planner',
        href: '/planner',
        label: 'Planner',
        description: 'Plan your degree path, choose tracks, and manage petitions.',
        matchPrefixes: ['/planner'],
        visibility: 'student',
      },
      {
        id: 'submissions',
        href: '/submissions',
        label: 'Submissions',
        description: 'Review recent submissions, grading, and resubmission history.',
        matchPrefixes: ['/submissions'],
        visibility: 'student',
      },
    ],
  },
  {
    id: 'instructor',
    label: 'Instructor',
    visibility: 'instructor',
    items: [
      {
        id: 'courses',
        href: '/instructor',
        label: 'Courses',
        description: 'Manage courses, milestones, and instructor operations.',
        matchPrefixes: ['/instructor/courses'],
        visibility: 'instructor',
      },
      {
        id: 'templates',
        href: '/instructor#templates',
        label: 'Templates',
        description: 'Reuse project blueprints with team roles and team sizes.',
        matchPrefixes: [],
        visibility: 'instructor',
      },
      {
        id: 'team-projects',
        href: '/instructor#team-projects',
        label: 'Team Projects',
        description: 'Review role applications, generate teams, and lock formation.',
        matchPrefixes: [],
        visibility: 'instructor',
      },
      {
        id: 'programs',
        href: '/instructor/programs',
        label: 'Programs',
        description: 'Build academic programs, tracks, requirements, and petitions.',
        matchPrefixes: ['/instructor/programs'],
        visibility: 'instructor',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    visibility: 'admin',
    items: [
      {
        id: 'admin-home',
        href: '/admin',
        label: 'Admin',
        description: 'Inspect system-wide courses, projects, and submissions.',
        matchPrefixes: ['/admin'],
        visibility: 'admin',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    visibility: 'all',
    items: [
      {
        id: 'settings',
        href: '/settings',
        label: 'Settings',
        description: 'Manage account settings and linked services.',
        matchPrefixes: ['/settings'],
        visibility: 'all',
      },
    ],
  },
];

function isInstructorUser(user: ShellSessionUser | null): boolean {
  if (!user) return false;
  if (user.systemRole === 'admin') return true;
  return (
    user.memberships?.some(
      (membership) => membership.role === 'instructor' || membership.role === 'ta'
    ) ?? false
  );
}

export function canAccessVisibility(
  visibility: AppNavVisibility,
  user: ShellSessionUser | null
): boolean {
  if (visibility === 'all' || visibility === 'student') return true;
  if (visibility === 'admin') return user?.systemRole === 'admin';
  return isInstructorUser(user);
}

export function getVisibleNavGroups(user: ShellSessionUser | null): AppNavGroup[] {
  return appNavGroups
    .filter((group) => canAccessVisibility(group.visibility, user))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessVisibility(item.visibility, user)),
    }))
    .filter((group) => group.items.length > 0);
}

function normalizeHref(href: string): { pathname: string; hash: string } {
  const [pathname, hash = ''] = href.split('#');
  return { pathname, hash: hash ? `#${hash}` : '' };
}

export function isNavItemActive(item: AppNavItem, pathname: string, hash = ''): boolean {
  const { pathname: itemPathname, hash: itemHash } = normalizeHref(item.href);
  const pathMatched = item.matchPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!itemHash) return pathname === itemPathname || pathMatched;
  if (pathname === itemPathname) return hash === itemHash;
  return pathMatched;
}

export function getActiveNavItem(
  pathname: string,
  user: ShellSessionUser | null,
  hash = ''
): AppNavItem | null {
  for (const group of getVisibleNavGroups(user)) {
    const active = group.items.find((item) => isNavItemActive(item, pathname, hash));
    if (active) return active;
  }
  return null;
}

export const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Student Dashboard',
    subtitle: 'See the work, reviews, and course actions that matter right now.',
  },
  '/projects': {
    title: 'Projects',
    subtitle: 'Track milestones, team workflows, and final submissions.',
  },
  '/planner': {
    title: 'Program Planner',
    subtitle: 'Plan courses, select tracks, file petitions, and generate a printable sheet.',
  },
  '/submissions': {
    title: 'Submissions',
    subtitle: 'Review submitted work, grading status, and revision history.',
  },
  '/instructor': {
    title: 'Instructor Workspace',
    subtitle: 'Run courses, reuse templates, manage team projects, and oversee delivery.',
  },
  '/instructor/programs': {
    title: 'Program Builder',
    subtitle: 'Design academic programs, tracks, requirements, and petition review flows.',
  },
  '/admin': {
    title: 'Admin',
    subtitle: 'System-wide oversight across submissions, projects, and activity.',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Manage account preferences and connected services.',
  },
  '/install/complete': {
    title: 'GitHub App',
    subtitle: 'Finish linking the installation to unlock repository provisioning.',
  },
  '/instructor/onboarding': {
    title: 'CLI Setup Guide',
    subtitle: 'Install the Nibras CLI, authenticate, and submit your first project.',
  },
};
