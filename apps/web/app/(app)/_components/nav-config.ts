export type AppNavItem = {
  href: string;
  label: string;
  description: string;
};

export const appNavItems: AppNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Track account, projects, and milestones."
  },
  {
    href: "/projects",
    label: "Projects",
    description: "Manage submissions, progress, and reviews."
  },
  {
    href: "/instructor",
    label: "Instructor",
    description: "Manage courses, projects, and review submissions."
  },
  {
    href: "/admin",
    label: "Admin",
    description: "System-wide submissions, projects, and oversight."
  }
];

export const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Track your current course operations and GitHub-linked progress."
  },
  "/projects": {
    title: "Projects",
    subtitle: "Review milestones, submissions, and grading details."
  },
  "/instructor": {
    title: "Instructor",
    subtitle: "Manage courses, projects, and review student submissions."
  },
  "/admin": {
    title: "Admin",
    subtitle: "System-wide oversight of submissions, projects, and activity."
  },
  "/install/complete": {
    title: "GitHub App",
    subtitle: "Finish linking the installation to unlock repository provisioning."
  }
};
